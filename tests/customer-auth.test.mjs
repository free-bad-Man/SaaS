import assert from "node:assert/strict";
import test from "node:test";
import { createPasswordHash } from "../platform/auth.mjs";

class CustomerDatabase {
  constructor(account, credential) {
    this.account = account;
    this.credential = credential;
    this.rates = new Map();
  }

  prepare(sql) {
    const { account, credential, rates } = this;
    let values = [];
    return {
      bind(...input) { values = input; return this; },
      async first() {
        if (sql.includes("FROM api_rate_limits")) return rates.get(values[0]) ?? null;
        if (sql.includes("FROM customer_credentials c JOIN accounts a") && sql.includes("email_normalized")) {
          if (values[0] !== credential.email_normalized) return null;
          return { ...account, ...credential };
        }
        if (sql.includes("FROM accounts a JOIN customer_credentials c")) {
          if (values[0] !== account.user_id) return null;
          return { ...account, ...credential };
        }
        if (sql.startsWith("SELECT password_hash FROM customer_credentials")) return values[0] === account.user_id ? { password_hash: credential.password_hash } : null;
        if (sql.startsWith("SELECT processed_rows")) return null;
        return null;
      },
      async all() { return { results: [] }; },
      async run() {
        if (sql.includes("CREATE TABLE IF NOT EXISTS api_rate_limits")) return { changes: 0 };
        if (sql.startsWith("INSERT INTO api_rate_limits")) {
          rates.set(values[0], { window_start: values[1], request_count: 1 });
          return { changes: 1 };
        }
        if (sql.startsWith("UPDATE api_rate_limits SET request_count")) {
          const current = rates.get(values[1]);
          if (current) current.request_count += 1;
          return { changes: current ? 1 : 0 };
        }
        if (sql.startsWith("UPDATE customer_credentials SET last_login_at")) {
          credential.last_login_at = values[0];
          credential.updated_at = values[1];
          return { changes: 1 };
        }
        if (sql.startsWith("UPDATE customer_credentials SET password_hash")) {
          credential.password_hash = values[0];
          credential.must_change_password = 0;
          credential.session_version = values[1];
          credential.updated_at = values[2];
          return { changes: 1 };
        }
        return { changes: 0 };
      },
    };
  }

  async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); }
}

async function fetchWorker(pathname, init, env) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("customer-auth-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`https://3ve4.example${pathname}`, init),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) }, ...env },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("requires a one-time password change and rotates customer sessions", async () => {
  const temporaryPassword = "Temporary-Access-Password9!";
  const account = {
    user_id: "customer:test", email: "pilot@example.com", role: "manager", plan: "trial", status: "active",
    trial_ends_at: "2099-08-24T00:00:00.000Z",
  };
  const credential = {
    account_user_id: account.user_id, email_normalized: account.email, password_hash: await createPasswordHash(temporaryPassword),
    must_change_password: 1, session_version: 1, last_login_at: null, updated_at: "2026-08-11T00:00:00.000Z",
  };
  const database = new CustomerDatabase(account, credential);
  const env = { DB: database, ADMIN_SESSION_SECRET: "test-session-secret-that-is-longer-than-thirty-two-characters" };
  const headers = { "content-type": "application/json", "cf-connecting-ip": "198.51.100.91" };

  const rejected = await fetchWorker("/api/customer-auth/login", { method: "POST", headers, body: JSON.stringify({ email: account.email, password: "wrong-password" }) }, env);
  assert.equal(rejected.status, 401);

  const login = await fetchWorker("/api/customer-auth/login", { method: "POST", headers, body: JSON.stringify({ email: account.email.toUpperCase(), password: temporaryPassword }) }, env);
  assert.equal(login.status, 200);
  const loginBody = await login.json();
  assert.equal(loginBody.viewer.mustChangePassword, true);
  const oldCookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
  assert.match(oldCookie, /^3ve4_customer=/);

  const lockedAccess = await fetchWorker("/api/platform/access", { headers: { cookie: oldCookie } }, env);
  const lockedBody = await lockedAccess.json();
  assert.equal(lockedBody.access.authenticated, true);
  assert.equal(lockedBody.access.mustChangePassword, true);
  assert.equal(lockedBody.access.canUsePaidFeatures, false);

  const newPassword = "Private-Customer-Password42!";
  const changed = await fetchWorker("/api/customer-auth/password", { method: "POST", headers: { ...headers, cookie: oldCookie }, body: JSON.stringify({ currentPassword: temporaryPassword, newPassword }) }, env);
  assert.equal(changed.status, 200);
  assert.equal((await changed.json()).viewer.mustChangePassword, false);
  const newCookie = changed.headers.get("set-cookie")?.split(";")[0] ?? "";

  assert.equal((await fetchWorker("/api/customer-auth/session", { headers: { cookie: oldCookie } }, env)).status, 200);
  const oldSessionBody = await (await fetchWorker("/api/customer-auth/session", { headers: { cookie: oldCookie } }, env)).json();
  assert.equal(oldSessionBody.authenticated, false);
  const activeAccess = await (await fetchWorker("/api/platform/access", { headers: { cookie: newCookie } }, env)).json();
  assert.equal(activeAccess.access.canUsePaidFeatures, true);
  assert.equal(activeAccess.access.userId, account.user_id);
  assert.equal(activeAccess.access.role, "manager");
});

test("redirects anonymous account-security traffic to customer sign in", async () => {
  const database = new CustomerDatabase({ user_id: "none" }, { email_normalized: "none@example.com" });
  const response = await fetchWorker("/account/security", { headers: { accept: "text/html", "x-forwarded-proto": "https" } }, { DB: database, ADMIN_SESSION_SECRET: "test-session-secret-that-is-longer-than-thirty-two-characters" });
  assert.equal(response.status, 302);
  assert.match(response.headers.get("location") ?? "", /^https:\/\/3ve4\.example\/login\?returnTo=/);
});
