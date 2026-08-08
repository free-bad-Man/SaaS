import { normalizeCurrency } from "./currency.mjs";

function text(value) {
  return value == null ? "" : String(value).trim();
}

function isoTimestamp(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

export function processPostbacks(records) {
  if (!Array.isArray(records)) throw new Error("postbacks must be an array.");
  if (records.length > 100000) throw new Error("A batch may contain at most 100000 postbacks.");

  const postbacks = [];
  const rejected = [];
  const duplicates = [];
  const seen = new Set();

  records.forEach((record, index) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      rejected.push({ index, error: `Postback ${index + 1} must be an object.` });
      return;
    }
    const id = text(record.id ?? record.postback_id);
    const clickId = text(record.clickId ?? record.click_id);
    const campaignId = text(record.campaignId ?? record.campaign_id);
    const timestampSource = record.timestamp ?? record.conversion_time;
    const timestamp = timestampSource ? isoTimestamp(timestampSource) : "";
    const revenue = Number(record.revenue ?? record.payout ?? 0);
    const currency = normalizeCurrency(record.currency);
    if (!id || !clickId || !campaignId || !timestampSource || !timestamp || !Number.isFinite(revenue) || revenue < 0 || !currency) {
      rejected.push({ index, error: `Postback ${id || index + 1} is invalid.` });
      return;
    }
    if (seen.has(id)) {
      duplicates.push(id);
      return;
    }
    seen.add(id);
    postbacks.push({ id, clickId, campaignId, timestamp, revenue, currency });
  });

  return { postbacks, accepted: postbacks.length, rejected, duplicates };
}
