import assert from "node:assert/strict";
import test from "node:test";
import { SAMPLE_RECORDS } from "../lib/audit-engine.mjs";

async function fetchWorker(body, headers = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("lead-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("https://verdict.example/api/leads/sample-audit", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

function requestBody(overrides = {}) {
  return {
    email: "buyer@example.com",
    company: "Example Media",
    fileName: "traffic-sample.json",
    source: JSON.stringify(SAMPLE_RECORDS),
    consent: true,
    website: "",
    ...overrides,
  };
}

test("captures a lead and returns only a limited audit preview", async () => {
  const response = await fetchWorker(requestBody());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.auditId);
  assert.deepEqual(body.report.summary, { total: 6, allow: 2, watch: 1, block: 3, averageScore: 42 });
  assert.equal(body.report.reviewRate, 66.7);
  assert.equal(body.report.limited, true);
  assert.ok(body.report.topFindings.length > 0);
  assert.ok(body.report.preview.length <= 5);
  assert.equal("email" in body, false);
  assert.equal("source" in body, false);
});

test("validates lead consent, email, and sample limits", async () => {
  const noConsent = await fetchWorker(requestBody({ consent: false }), { "cf-connecting-ip": "203.0.113.10" });
  assert.equal(noConsent.status, 400);
  assert.match((await noConsent.json()).error, /Consent is required/);

  const badEmail = await fetchWorker(requestBody({ email: "not-an-email" }), { "cf-connecting-ip": "203.0.113.11" });
  assert.equal(badEmail.status, 400);
  assert.match((await badEmail.json()).error, /valid work email/);

  const oversized = await fetchWorker(requestBody({ source: "x".repeat(256 * 1024 + 1) }), { "cf-connecting-ip": "203.0.113.12" });
  assert.equal(oversized.status, 413);
  assert.match((await oversized.json()).error, /256 KB/);
});

test("rate-limits repeated free audit submissions", async () => {
  const headers = { "cf-connecting-ip": "203.0.113.99" };
  for (let index = 0; index < 3; index += 1) assert.equal((await fetchWorker(requestBody({ email: `buyer${index}@example.com` }), headers)).status, 200);
  const limited = await fetchWorker(requestBody({ email: "buyer4@example.com" }), headers);
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).code, "RATE_LIMITED");
});
