export const MAX_EVENT_BATCH = 100000;

function text(value) {
  return value == null ? "" : String(value).trim();
}

function number(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function first(record, ...keys) {
  for (const key of keys) if (record[key] != null) return record[key];
  return undefined;
}

function isoTimestamp(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

export function normalizeEvent(record, index = 0) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return { ok: false, error: `Event ${index + 1} must be an object.` };
  }

  const type = text(first(record, "type", "event_type")).toLowerCase();
  const id = text(first(record, "id", "event_id"));
  const campaignId = text(first(record, "campaignId", "campaign_id"));
  const placementId = text(first(record, "placementId", "placement_id"));
  const timestampSource = first(record, "timestamp", "event_time");
  const timestamp = isoTimestamp(timestampSource);

  if (!id) return { ok: false, error: `Event ${index + 1} is missing id.` };
  if (!new Set(["impression", "click"]).has(type)) return { ok: false, error: `Event ${id} has unsupported type.` };
  if (!campaignId || !placementId) return { ok: false, error: `Event ${id} is missing campaign or placement.` };
  if (!timestampSource || !timestamp) return { ok: false, error: `Event ${id} has an invalid timestamp.` };

  return {
    ok: true,
    event: {
      id,
      type,
      timestamp,
      campaignId,
      placementId,
      sourceId: text(first(record, "sourceId", "source_id")) || "unknown",
      requestId: text(first(record, "requestId", "request_id")),
      clickId: text(first(record, "clickId", "click_id")),
      cost: Math.max(0, number(first(record, "cost", "spend", "win_price"))),
      currency: text(record.currency).toUpperCase() || "USD",
      traffic: {
        site_domain: text(first(record, "site_domain", "siteDomain")),
        page_domain: text(first(record, "page_domain", "pageDomain")),
        schain_nodes: number(first(record, "schain_nodes", "schainNodes")),
        seller_id: text(first(record, "seller_id", "sellerId")),
        user_agent: text(first(record, "user_agent", "userAgent")),
        device_os: text(first(record, "device_os", "deviceOs")),
        requests_per_minute: number(first(record, "requests_per_minute", "requestsPerMinute")),
        duplicate_rate: number(first(record, "duplicate_rate", "duplicateRate")),
        ip_country: text(first(record, "ip_country", "ipCountry")),
        declared_country: text(first(record, "declared_country", "declaredCountry")),
        connection_type: text(first(record, "connection_type", "connectionType")),
      },
    },
  };
}

export function ingestEvents(records) {
  if (!Array.isArray(records)) throw new Error("events must be an array.");
  if (records.length > MAX_EVENT_BATCH) throw new Error(`A batch may contain at most ${MAX_EVENT_BATCH} events.`);

  const events = [];
  const rejected = [];
  const duplicates = [];
  const seen = new Set();

  records.forEach((record, index) => {
    const normalized = normalizeEvent(record, index);
    if (!normalized.ok) {
      rejected.push({ index, error: normalized.error });
      return;
    }
    if (seen.has(normalized.event.id)) {
      duplicates.push(normalized.event.id);
      return;
    }
    seen.add(normalized.event.id);
    events.push(normalized.event);
  });

  return { events, accepted: events.length, rejected, duplicates };
}
