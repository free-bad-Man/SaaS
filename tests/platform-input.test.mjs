import assert from "node:assert/strict";
import test from "node:test";
import { createPipelineReportCsv, parsePlatformInput } from "../platform/input.mjs";
import { runPlatformPipeline } from "../platform/pipeline.mjs";
import { PLATFORM_PAYLOAD } from "./fixtures/platform-payload.mjs";

test("parses complete platform JSON and mixed JSONL input", () => {
  const complete = parsePlatformInput(JSON.stringify(PLATFORM_PAYLOAD), "campaign.json");
  assert.equal(complete.events.length, 6);
  assert.equal(complete.postbacks.length, 3);

  const mixed = parsePlatformInput([
    JSON.stringify(PLATFORM_PAYLOAD.events[0]),
    JSON.stringify({ ...PLATFORM_PAYLOAD.postbacks[0], type: "conversion" }),
  ].join("\n"), "campaign.jsonl");
  assert.equal(mixed.events.length, 1);
  assert.equal(mixed.postbacks.length, 1);
});

test("parses CSV rows and exports pipeline decisions", () => {
  const event = PLATFORM_PAYLOAD.events[0];
  const headers = Object.keys(event);
  const csv = `${headers.join(",")}\n${headers.map((key) => event[key]).join(",")}`;
  const payload = parsePlatformInput(csv, "events.csv");
  assert.equal(payload.events.length, 1);

  const report = createPipelineReportCsv(runPlatformPipeline(PLATFORM_PAYLOAD));
  assert.match(report, /^campaign_id,placement_id,spend,revenue/);
  assert.match(report, /cmp-1,plc-risk/);
  assert.match(report, /PAUSE,High IVT risk/);
});
