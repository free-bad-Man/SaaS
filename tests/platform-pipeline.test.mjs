import assert from "node:assert/strict";
import test from "node:test";
import { runPlatformPipeline } from "../platform/pipeline.mjs";
import { PLATFORM_PAYLOAD } from "./fixtures/platform-payload.mjs";

test("runs the complete modular pipeline from raw events to connector actions", () => {
  const result = runPlatformPipeline(PLATFORM_PAYLOAD);
  assert.equal(result.version, "verdict.pipeline.v1");
  assert.deepEqual(result.modules.ingestion, { accepted: 4, rejected: 1, duplicates: 1 });
  assert.deepEqual(result.modules.postbacks, { accepted: 2, rejected: 0, duplicates: 1 });
  assert.equal(result.modules.attribution.attributed, 2);
  assert.equal(result.modules.ivt.riskyPlacements, 1);
  assert.equal(result.summary.spend, 100);
  assert.equal(result.summary.revenue, 110);
  assert.equal(result.summary.currency, "USD");
  assert.equal(result.summary.conversions, 2);
  assert.equal(result.summary.roas, 1.1);
  assert.equal(result.decisions.find((item) => item.placementId === "plc-safe").decision, "SCALE");
  assert.equal(result.decisions.find((item) => item.placementId === "plc-risk").decision, "PAUSE");
  assert.equal(result.actions.length, 2);
  assert.ok(result.actions.every((action) => action.mode === "shadow"));
});

test("rejects mixed spend and revenue currencies before optimization", () => {
  const postbacks = PLATFORM_PAYLOAD.postbacks.map((postback, index) => index === 0 ? { ...postback, currency: "EUR" } : postback);
  assert.throws(
    () => runPlatformPipeline({ ...PLATFORM_PAYLOAD, postbacks }),
    /Mixed currencies are not supported in one run \(EUR, USD\)/,
  );
});

test("keeps malformed and duplicate input visible in diagnostics", () => {
  const result = runPlatformPipeline(PLATFORM_PAYLOAD);
  assert.equal(result.diagnostics.rejectedEvents.length, 1);
  assert.deepEqual(result.diagnostics.duplicateEvents, ["evt-risk-click"]);
  assert.deepEqual(result.diagnostics.duplicatePostbacks, ["pb-risk"]);
});

test("applies a project policy to decisions and connector actions", () => {
  const result = runPlatformPipeline({
    ...PLATFORM_PAYLOAD,
    policy: { scaleRoasAtLeast: 3, scaleBidPercent: 25, executionMode: "approval" },
  });
  assert.equal(result.policy.scaleRoasAtLeast, 3);
  assert.equal(result.modules.connector.mode, "approval");
  assert.equal(result.decisions.find((item) => item.placementId === "plc-safe").decision, "KEEP");
  assert.ok(result.actions.every((action) => action.mode === "approval"));
});
