import assert from "node:assert/strict";
import test from "node:test";
import { PLATFORM_PAYLOAD } from "./fixtures/platform-payload.mjs";

async function fetchWorker(pathname, init = {}, authenticated = true, userId = "test-user") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("api-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  const headers = new Headers(init.headers);
  if (authenticated) {
    headers.set("oai-authenticated-user-id", userId);
    headers.set("oai-authenticated-user-email", "test@verdict.example");
  }
  return worker.fetch(
    new Request(`https://verdict.example${pathname}`, { ...init, headers }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("keeps anonymous visitors in fixed public demo mode", async () => {
  const accessResponse = await fetchWorker("/api/platform/access", {}, false);
  const access = await accessResponse.json();
  assert.equal(access.access.plan, "demo");
  assert.equal(access.access.canUsePaidFeatures, false);

  const projectsResponse = await fetchWorker("/api/platform/projects", {}, false);
  assert.equal(projectsResponse.status, 401);
  assert.equal((await projectsResponse.json()).code, "AUTH_REQUIRED");

  const demoResponse = await fetchWorker("/api/platform/demo", { method: "POST" }, false);
  assert.equal(demoResponse.status, 200);
  const demo = await demoResponse.json();
  assert.equal(demo.demo, true);
  assert.equal(demo.modules.ingestion.accepted, 4);
});

test("rate-limits repeated public demo execution", async () => {
  const headers = { "cf-connecting-ip": "203.0.113.42" };
  for (let index = 0; index < 10; index += 1) {
    const response = await fetchWorker("/api/platform/demo", { method: "POST", headers }, false);
    assert.equal(response.status, 200);
  }
  const limited = await fetchWorker("/api/platform/demo", { method: "POST", headers }, false);
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).code, "RATE_LIMITED");
  assert.ok(Number(limited.headers.get("retry-after")) >= 1);
});

test("exposes module health and connector capabilities", async () => {
  const healthResponse = await fetchWorker("/api/platform/health");
  assert.equal(healthResponse.status, 200);
  assert.equal(healthResponse.headers.get("x-verdict-api"), "v1");
  const health = await healthResponse.json();
  assert.equal(health.status, "operational");
  assert.deepEqual(health.modules, ["ingestion", "postbacks", "attribution", "ivt", "optimizer", "connectors"]);

  const connectorResponse = await fetchWorker("/api/platform/connectors");
  const connectorBody = await connectorResponse.json();
  assert.equal(connectorBody.connectors.length, 4);
  assert.equal(connectorBody.connectors.find((connector) => connector.id === "openrtb").status, "available");
  assert.equal(connectorBody.connectors.find((connector) => connector.id === "dv360").status, "planned");
});

test("runs the complete platform through the server API", async () => {
  const projects = await (await fetchWorker("/api/platform/projects")).json();
  const response = await fetchWorker("/api/platform/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...PLATFORM_PAYLOAD, projectId: projects.projects[0].id, sourceName: "api-test.json" }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.modules.ingestion.accepted, 4);
  assert.equal(body.modules.attribution.attributed, 2);
  assert.equal(body.modules.optimizer.actionable, 2);
  assert.equal(body.actions[0].mode, "shadow");
});

test("persists projects and reopens saved pipeline runs", async () => {
  const projectResponse = await fetchWorker("/api/platform/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Acme media audit" }),
  });
  assert.equal(projectResponse.status, 201);
  const { project } = await projectResponse.json();
  assert.equal(project.name, "Acme media audit");

  const runResponse = await fetchWorker("/api/platform/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...PLATFORM_PAYLOAD, projectId: project.id, sourceName: "august-traffic.jsonl" }),
  });
  assert.equal(runResponse.status, 200);
  const runResult = await runResponse.json();
  assert.ok(runResult.runId);

  const historyResponse = await fetchWorker(`/api/platform/runs?projectId=${encodeURIComponent(project.id)}`);
  assert.equal(historyResponse.status, 200);
  const history = await historyResponse.json();
  assert.equal(history.runs.length, 1);
  assert.equal(history.runs[0].sourceName, "august-traffic.jsonl");
  assert.equal(history.runs[0].acceptedEvents, 4);
  assert.equal(history.runs[0].attributedConversions, 2);
  assert.equal(history.runs[0].shadowActions, 2);

  const detailResponse = await fetchWorker(`/api/platform/runs/${runResult.runId}`);
  assert.equal(detailResponse.status, 200);
  const detail = await detailResponse.json();
  assert.equal(detail.run.id, runResult.runId);
  assert.equal(detail.run.result.modules.optimizer.actionable, 2);
});

test("isolates projects and run history by authenticated owner", async () => {
  const ownerProjects = await (await fetchWorker("/api/platform/projects")).json();
  const ownerProjectId = ownerProjects.projects[0].id;
  const otherProjectsResponse = await fetchWorker("/api/platform/projects", {}, true, "other-user");
  assert.equal(otherProjectsResponse.status, 200);
  const otherProjects = await otherProjectsResponse.json();
  assert.equal(otherProjects.projects.some((project) => project.id === ownerProjectId), false);

  const foreignHistory = await fetchWorker(`/api/platform/runs?projectId=${ownerProjectId}`, {}, true, "other-user");
  assert.equal(foreignHistory.status, 200);
  assert.deepEqual((await foreignHistory.json()).runs, []);
});

test("queues uploaded files, processes them, and records row diagnostics", async () => {
  const projectsResponse = await fetchWorker("/api/platform/projects");
  const projects = await projectsResponse.json();
  const projectId = projects.projects[0].id;

  const uploadResponse = await fetchWorker("/api/platform/uploads", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-project-id": projectId,
      "x-file-name": encodeURIComponent("traffic batch.json"),
      "x-connector": "openrtb",
    },
    body: JSON.stringify(PLATFORM_PAYLOAD),
  });
  assert.equal(uploadResponse.status, 202);
  const upload = await uploadResponse.json();
  assert.equal(upload.job.status, "queued");
  assert.equal(upload.job.fileName, "traffic batch.json");

  const processResponse = await fetchWorker(`/api/platform/uploads/${upload.job.id}/process`, { method: "POST" });
  assert.equal(processResponse.status, 200);
  const processed = await processResponse.json();
  assert.equal(processed.job.status, "complete");
  assert.equal(processed.job.processedRows, 9);
  assert.equal(processed.job.errorCount, 3);
  assert.equal(processed.job.errors[0].row, 6);
  assert.ok(processed.job.runId);
  assert.equal(processed.run.result.modules.ingestion.accepted, 4);

  const statusResponse = await fetchWorker(`/api/platform/uploads/${upload.job.id}`);
  assert.equal(statusResponse.status, 200);
  assert.equal((await statusResponse.json()).job.status, "complete");
});

test("saves project policy and uses it for the next pipeline run", async () => {
  const projects = await (await fetchWorker("/api/platform/projects")).json();
  const projectId = projects.projects[0].id;
  const saveResponse = await fetchWorker("/api/platform/policy", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectId, policy: { scaleRoasAtLeast: 3, scaleBidPercent: 25, executionMode: "approval" } }),
  });
  assert.equal(saveResponse.status, 200);
  const saved = await saveResponse.json();
  assert.equal(saved.policy.scaleRoasAtLeast, 3);
  assert.equal(saved.policy.executionMode, "approval");

  const runResponse = await fetchWorker("/api/platform/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...PLATFORM_PAYLOAD, projectId, sourceName: "policy-check.json" }),
  });
  assert.equal(runResponse.status, 200);
  const result = await runResponse.json();
  assert.equal(result.policy.scaleBidPercent, 25);
  assert.equal(result.modules.connector.mode, "approval");
  assert.equal(result.decisions.find((item) => item.placementId === "plc-safe").decision, "KEEP");
});

test("rejects malformed API input safely", async () => {
  const response = await fetchWorker("/api/platform/run", { method: "POST", headers: { "content-type": "text/plain" }, body: "bad" });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Content-Type/);
});
