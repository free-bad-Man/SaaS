import { parseInput } from "../lib/audit-engine.mjs";

function text(value) {
  return value == null ? "" : String(value).trim();
}

function recordType(record) {
  return text(record?.record_type ?? record?.recordType ?? record?.kind ?? record?.type).toLowerCase();
}

function isPostback(record) {
  const type = recordType(record);
  return type === "postback" || type === "conversion" || (record?.revenue != null && (record?.click_id != null || record?.clickId != null));
}

function categorize(records) {
  const events = [];
  const postbacks = [];
  for (const record of records) {
    if (isPostback(record)) postbacks.push(record);
    else events.push(record);
  }
  return { events, postbacks };
}

export function parsePlatformInput(source, filename = "") {
  const input = text(source);
  if (!input) throw new Error("The file is empty.");

  if (/\.json$/i.test(filename) || input.startsWith("{") || input.startsWith("[")) {
    try {
      const parsed = JSON.parse(input);
      if (parsed && !Array.isArray(parsed) && (Array.isArray(parsed.events) || Array.isArray(parsed.postbacks))) {
        const events = parsed.events ?? [];
        const postbacks = parsed.postbacks ?? [];
        if (!Array.isArray(events) || !Array.isArray(postbacks)) throw new Error("events and postbacks must be arrays.");
        if (events.length === 0) throw new Error("The payload must contain at least one event.");
        return { connector: text(parsed.connector).toLowerCase() || "openrtb", events, postbacks };
      }
      const records = Array.isArray(parsed) ? parsed : [parsed];
      const categorized = categorize(records);
      if (categorized.events.length === 0) throw new Error("The payload must contain at least one event.");
      return { connector: "openrtb", ...categorized };
    } catch (error) {
      if (!/\.(jsonl|ndjson)$/i.test(filename)) {
        throw new Error(error instanceof Error ? error.message : "Invalid JSON payload.");
      }
    }
  }

  const categorized = categorize(parseInput(input, filename));
  if (categorized.events.length === 0) throw new Error("The payload must contain at least one event.");
  return { connector: "openrtb", ...categorized };
}

function csvCell(value) {
  const source = String(value ?? "");
  return /[",\r\n]/.test(source) ? `"${source.replaceAll('"', '""')}"` : source;
}

export function createPipelineReportCsv(result) {
  const header = ["campaign_id", "placement_id", "spend", "revenue", "conversions", "roas", "cpa", "ivt_score", "decision", "reason"];
  const rows = (result?.decisions ?? []).map((decision) => [
    decision.campaignId,
    decision.placementId,
    decision.spend,
    decision.revenue,
    decision.conversions,
    Number(decision.roas ?? 0).toFixed(4),
    decision.cpa == null ? "" : Number(decision.cpa).toFixed(4),
    decision.ivtScore,
    decision.decision,
    decision.reason,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
