import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  SAMPLE_RECORDS,
  analyzeRecord,
  analyzeRecords,
  createReportCsv,
  parseInput,
  summarize,
} from "../lib/audit-engine.mjs";

test("scores transparent fraud signals and assigns decisions", () => {
  const safe = analyzeRecord(SAMPLE_RECORDS[1]);
  const risky = analyzeRecord(SAMPLE_RECORDS[2]);

  assert.equal(safe.score, 0);
  assert.equal(safe.decision, "ALLOW");
  assert.equal(risky.score, 82);
  assert.equal(risky.decision, "BLOCK");
  assert.deepEqual(risky.reasons.map((reason) => reason.code), [
    "non_residential_network",
    "device_os_ua_mismatch",
    "abnormal_velocity",
    "high_duplicate_rate",
    "geo_mismatch",
  ]);
});

test("parses JSON, wrapped JSON, JSONL and quoted CSV", () => {
  assert.equal(parseInput(JSON.stringify(SAMPLE_RECORDS), "sample.json").length, SAMPLE_RECORDS.length);
  assert.equal(parseInput(JSON.stringify({ records: SAMPLE_RECORDS }), "sample.json").length, SAMPLE_RECORDS.length);
  assert.equal(parseInput('{"id":"a"}\n{"id":"b"}', "sample.jsonl").length, 2);

  const csv = 'id,site_domain,page_domain,seller_id\nreq-1,"news, media.ru","news, media.ru",seller-1';
  const parsed = parseInput(csv, "sample.csv");
  assert.equal(parsed[0].site_domain, "news, media.ru");
  assert.equal(parsed[0].seller_id, "seller-1");
});

test("builds a summary and downloadable CSV report", () => {
  const results = analyzeRecords(SAMPLE_RECORDS);
  const summary = summarize(results);
  const report = createReportCsv(results);

  assert.deepEqual(summary, { total: 6, allow: 2, watch: 1, block: 3, averageScore: 42 });
  assert.match(report, /^id,decision,risk_score,reason_codes,evidence/);
  assert.match(report, /req-31B0CE,BLOCK,82/);
  assert.match(report, /device_os_ua_mismatch/);
});

test("keeps the public verification fixture and evidence export reproducible", async () => {
  const fixture = JSON.parse(await readFile(new URL("../public/samples/synthetic-openrtb-sample.json", import.meta.url), "utf8"));
  const publishedReport = await readFile(new URL("../public/samples/synthetic-ivt-evidence.csv", import.meta.url), "utf8");
  const generatedReport = createReportCsv(analyzeRecords(fixture));

  assert.deepEqual(fixture, SAMPLE_RECORDS);
  assert.equal(publishedReport.replaceAll("\r\n", "\n").trim(), generatedReport.replaceAll("\r\n", "\n").trim());
});
