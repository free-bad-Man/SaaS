import assert from "node:assert/strict";
import test from "node:test";
import { SAMPLE_RECORDS } from "../lib/audit-engine.mjs";
import { createPasswordHash } from "../platform/auth.mjs";

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
