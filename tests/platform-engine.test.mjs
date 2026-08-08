import assert from "node:assert/strict";
import test from "node:test";
import { SAMPLE_PLACEMENTS, analyzePlacements, money, summarizePlatform } from "../lib/platform-engine.mjs";

test("combines IVT risk and commercial performance into optimization decisions", () => {
  const analyzed = analyzePlacements(SAMPLE_PLACEMENTS);
  assert.equal(analyzed.find((item) => item.id === "plc-204").decision, "PAUSE");
  assert.equal(analyzed.find((item) => item.id === "plc-311").decision, "SCALE");
  assert.equal(analyzed.find((item) => item.id === "plc-619").decision, "WATCH");
  assert.equal(analyzed.find((item) => item.id === "plc-101").reason, "Profitable, low-risk traffic");
});

test("summarizes attribution, postback, and optimizer metrics", () => {
  const summary = summarizePlatform(SAMPLE_PLACEMENTS);
  assert.equal(summary.spend, 5170);
  assert.equal(summary.revenue, 6440);
  assert.equal(summary.conversions, 787);
  assert.equal(summary.acceptedPostbacks, 787);
  assert.equal(summary.duplicates, 53);
  assert.equal(summary.pause, 2);
  assert.equal(summary.watch, 1);
  assert.equal(summary.scale, 3);
  assert.equal(summary.roas.toFixed(2), "1.25");
  assert.equal(money(summary.atRiskSpend), "$2,570");
});
