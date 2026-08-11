import assert from "node:assert/strict";
import test from "node:test";
import { SAMPLE_RECORDS } from "../lib/audit-engine.mjs";
import { createPasswordHash, verifyPassword } from "../platform/auth.mjs";

async function fetchWorker(pathname, init = {}, env = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("admin-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`https://3ve4.example${pathname}`, init),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) }, ...env },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function createLead() {
  return fetchWorker("/api/leads/sample-audit", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": `198.51.100.${Math.floor(Math.random() * 200) + 1}` },
    body: JSON.stringify({
      email: "inbox-buyer@example.com",
      company: "Inbox Media",
      fileName: "inbox-sample.json",
      source: JSON.stringify(SAMPLE_RECORDS),
      consent: true,
      website: "",
    }),
  });
}

test("protects the lead inbox and returns aggregate lead data to an allowlisted owner", async () => {
  assert.equal((await createLead()).status, 200);
  const headers = { "oai-authenticated-user-id": "owner-id", "oai-authenticated-user-email": "owner@example.com" };
  const response = await fetchWorker("/api/admin/leads", { headers }, { ADMIN_EMAILS: "owner@example.com" });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.viewer.email, "owner@example.com");
  assert.equal(body.integrations.telegram, false);
  const lead = body.leads.find((item) => item.email === "inbox-buyer@example.com");
  assert.ok(lead);
  assert.equal(lead.company, "Inbox Media");
  assert.equal(lead.recordCount, 6);
  assert.equal("source" in lead, false);
});

test("rejects anonymous and non-allowlisted lead-inbox requests", async () => {
  const anonymous = await fetchWorker("/api/admin/leads", {}, { ADMIN_EMAILS: "owner@example.com" });
  assert.equal(anonymous.status, 401);
  const denied = await fetchWorker("/api/admin/leads", { headers: { "oai-authenticated-user-id": "other-id", "oai-authenticated-user-email": "other@example.com" } }, { ADMIN_EMAILS: "owner@example.com" });
  assert.equal(denied.status, 403);
});

test("serves the protected control-center overview and account directory", async () => {
  const headers = { "oai-authenticated-user-id": "owner-id", "oai-authenticated-user-email": "owner@example.com" };
  const overview = await fetchWorker("/api/admin/overview", { headers }, { ADMIN_EMAILS: "owner@example.com" });
  assert.equal(overview.status, 200);
  const overviewBody = await overview.json();
  assert.equal(overviewBody.overview.system.persistence, "ephemeral");
  assert.deepEqual(overviewBody.overview.metrics, { accounts: 0, projects: 0, runs: 0, leads: 0, processedRows: 0, uploadBytes: 0, usageRuns: 0 });

  const accounts = await fetchWorker("/api/admin/accounts", { headers }, { ADMIN_EMAILS: "owner@example.com" });
  assert.equal(accounts.status, 200);
  assert.deepEqual((await accounts.json()).accounts, []);
});

test("updates customer role, plan, and status through the protected admin API", async () => {
  const row = {
    user_id: "customer-1", email: "buyer@example.com", role: "member", plan: "trial", status: "active",
    trial_ends_at: "2026-08-24T00:00:00.000Z", created_at: "2026-08-10T00:00:00.000Z", updated_at: "2026-08-10T00:00:00.000Z",
    project_count: 2, processed_rows: 1200, upload_bytes: 2048, run_count: 3,
  };
  const database = {
    prepare(sql) {
      let bound = [];
      return {
        bind(...values) { bound = values; return this; },
        async all() { return { results: sql.includes("FROM accounts a") ? [row] : [] }; },
        async first() { return null; },
        async run() {
          if (sql.startsWith("UPDATE accounts SET")) {
            [row.role, row.plan, row.status, row.updated_at] = bound;
            return { changes: 1 };
          }
          return { changes: 0 };
        },
      };
    },
    async batch() { return []; },
  };
  const headers = { "oai-authenticated-user-id": "owner-id", "oai-authenticated-user-email": "owner@example.com", "content-type": "application/json" };
  const response = await fetchWorker("/api/admin/accounts/customer-1", { method: "PATCH", headers, body: JSON.stringify({ role: "manager", plan: "enterprise", status: "suspended" }) }, { ADMIN_EMAILS: "owner@example.com", DB: database });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.account.role, "manager");
  assert.equal(body.account.plan, "enterprise");
  assert.equal(body.account.status, "suspended");
});

test("issues invite-only customer access without storing the temporary password", async () => {
  const accounts = [];
  const credentials = [];
  const database = {
    prepare(sql) {
      let bound = [];
      return {
        bind(...values) { bound = values; return this; },
        async first() {
          if (sql.startsWith("SELECT account_user_id FROM customer_credentials WHERE email_normalized")) return credentials.find((item) => item.email_normalized === bound[0]) ?? null;
          if (sql.startsWith("SELECT user_id FROM accounts WHERE LOWER(email)")) return accounts.find((item) => item.email.toLowerCase() === bound[0]) ?? null;
          return null;
        },
        async all() {
          if (!sql.includes("FROM accounts a")) return { results: [] };
          return { results: accounts.map((account) => {
            const credential = credentials.find((item) => item.account_user_id === account.user_id);
            return { ...account, project_count: 0, processed_rows: 0, upload_bytes: 0, run_count: 0, has_credentials: Boolean(credential), must_change_password: credential?.must_change_password ?? 0, last_login_at: credential?.last_login_at ?? null };
          }) };
        },
        async run() {
          if (sql.startsWith("INSERT INTO accounts")) {
            accounts.push({ user_id: bound[0], email: bound[1], role: bound[2], plan: bound[3], status: "active", trial_ends_at: bound[4], created_at: bound[5], updated_at: bound[6] });
            return { changes: 1 };
          }
          if (sql.startsWith("INSERT INTO customer_credentials")) {
            credentials.push({ account_user_id: bound[0], email_normalized: bound[1], password_hash: bound[2], must_change_password: 1, session_version: 1, last_login_at: null, created_at: bound[3], updated_at: bound[4] });
            return { changes: 1 };
          }
          return { changes: 0 };
        },
      };
    },
    async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); },
  };
  const headers = { "oai-authenticated-user-id": "owner-id", "oai-authenticated-user-email": "owner@example.com", "content-type": "application/json" };
  const response = await fetchWorker("/api/admin/accounts", { method: "POST", headers, body: JSON.stringify({ email: "Pilot@Example.com", role: "manager", plan: "trial" }) }, { ADMIN_EMAILS: "owner@example.com", DB: database });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.account.email, "pilot@example.com");
  assert.equal(body.account.role, "manager");
  assert.equal(body.account.hasCredentials, true);
  assert.equal(body.account.mustChangePassword, true);
  assert.match(body.temporaryPassword, /^3V!.+a9$/);
  assert.equal(credentials[0].password_hash.includes(body.temporaryPassword), false);
  assert.equal(await verifyPassword(body.temporaryPassword, credentials[0].password_hash), true);

  const duplicate = await fetchWorker("/api/admin/accounts", { method: "POST", headers, body: JSON.stringify({ email: "pilot@example.com" }) }, { ADMIN_EMAILS: "owner@example.com", DB: database });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).code, "ACCOUNT_EXISTS");
});

test("creates a signed admin session that unlocks the inbox", async () => {
  const env = {
    ADMIN_USERNAME: "admin",
    ADMIN_EMAIL: "owner@example.com",
    ADMIN_PASSWORD_HASH: await createPasswordHash("a-secure-test-password"),
    ADMIN_SESSION_SECRET: "test-session-secret-that-is-longer-than-thirty-two-characters",
  };
  const rejected = await fetchWorker("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", password: "wrong-password" }) }, env);
  assert.equal(rejected.status, 401);

  const login = await fetchWorker("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", password: "a-secure-test-password" }) }, env);
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
  assert.match(cookie, /^3ve4_admin=/);

  const session = await fetchWorker("/api/auth/session", { headers: { cookie } }, env);
  assert.equal(session.status, 200);
  assert.equal((await session.json()).authenticated, true);

  const inbox = await fetchWorker("/api/admin/leads", { headers: { cookie } }, env);
  assert.equal(inbox.status, 200);
  assert.equal((await inbox.json()).viewer.email, "owner@example.com");

  const platform = await fetchWorker("/api/platform/access", { headers: { cookie } }, env);
  const platformBody = await platform.json();
  assert.equal(platform.status, 200);
  assert.equal(platformBody.access.role, "admin");
  assert.equal(platformBody.access.plan, "enterprise");
  assert.equal(platformBody.access.canUsePaidFeatures, true);
});
