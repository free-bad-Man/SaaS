export const MAX_RECORDS = 5000;

export const SAMPLE_RECORDS = [
  {
    id: "req-8FD2A1",
    site_domain: "news-example.ru",
    page_domain: "premium-publisher.example",
    schain_nodes: 1,
    seller_id: "",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    device_os: "Windows",
    requests_per_minute: 248,
    duplicate_rate: 0.04,
    ip_country: "RU",
    declared_country: "RU",
    connection_type: "residential",
  },
  {
    id: "req-9CA711",
    site_domain: "video-example.ru",
    page_domain: "video-example.ru",
    schain_nodes: 3,
    seller_id: "seller-142",
    user_agent: "Mozilla/5.0 (Linux; Android 14)",
    device_os: "Android",
    requests_per_minute: 28,
    duplicate_rate: 0.01,
    ip_country: "RU",
    declared_country: "RU",
    connection_type: "mobile",
  },
  {
    id: "req-31B0CE",
    site_domain: "sports-example.ru",
    page_domain: "sports-example.ru",
    schain_nodes: 2,
    seller_id: "seller-088",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    device_os: "Android",
    requests_per_minute: 162,
    duplicate_rate: 0.22,
    ip_country: "NL",
    declared_country: "RU",
    connection_type: "datacenter",
  },
  {
    id: "req-A21F77",
    site_domain: "music-example.ru",
    page_domain: "music-example.ru",
    schain_nodes: 2,
    seller_id: "seller-204",
    user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)",
    device_os: "iOS",
    requests_per_minute: 135,
    duplicate_rate: 0.19,
    ip_country: "RU",
    declared_country: "RU",
    connection_type: "residential",
  },
  {
    id: "req-DCA992",
    site_domain: "portal-example.ru",
    page_domain: "portal-example.ru",
    schain_nodes: 0,
    seller_id: "",
    user_agent: "Mozilla/5.0 (X11; Linux x86_64)",
    device_os: "Linux",
    requests_per_minute: 187,
    duplicate_rate: 0.03,
    ip_country: "DE",
    declared_country: "RU",
    connection_type: "hosting",
  },
  {
    id: "req-EF8401",
    site_domain: "games-example.ru",
    page_domain: "games-example.ru",
    schain_nodes: 3,
    seller_id: "seller-331",
    user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)",
    device_os: "macOS",
    requests_per_minute: 61,
    duplicate_rate: 0.03,
    ip_country: "RU",
    declared_country: "RU",
    connection_type: "residential",
  },
];

function text(value) {
  return value == null ? "" : String(value).trim();
}

function number(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedDomain(value) {
  return text(value).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

function osFromUserAgent(userAgent) {
  const ua = text(userAgent).toLowerCase();
  if (/iphone|ipad|ios/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  if (/windows/.test(ua)) return "windows";
  if (/macintosh|mac os/.test(ua)) return "macos";
  if (/linux/.test(ua)) return "linux";
  return "";
}

function normalizeOs(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function addReason(reasons, code, title, weight, evidence) {
  reasons.push({ code, title, weight, evidence });
}

export function analyzeRecord(record, index = 0) {
  const reasons = [];
  const siteDomain = normalizedDomain(record.site_domain);
  const pageDomain = normalizedDomain(record.page_domain);
  const schainNodes = number(record.schain_nodes);
  const sellerId = text(record.seller_id);
  const requestsPerMinute = number(record.requests_per_minute);
  const duplicateRate = number(record.duplicate_rate);
  const ipCountry = text(record.ip_country).toUpperCase();
  const declaredCountry = text(record.declared_country).toUpperCase();
  const connectionType = text(record.connection_type).toLowerCase();
  const uaOs = osFromUserAgent(record.user_agent);
  const deviceOs = normalizeOs(record.device_os);

  if (siteDomain && pageDomain && siteDomain !== pageDomain) {
    addReason(reasons, "domain_mismatch", "Domain mismatch", 35, `${siteDomain} ≠ ${pageDomain}`);
  }
  if (schainNodes < 2 || !sellerId) {
    addReason(reasons, "invalid_supply_chain", "Incomplete supply chain", 20, `${schainNodes} node(s), seller: ${sellerId || "missing"}`);
  }
  if (["datacenter", "hosting", "vpn", "proxy"].some((value) => connectionType.includes(value))) {
    addReason(reasons, "non_residential_network", "Datacenter / proxy network", 20, connectionType || "unknown");
  }
  if (uaOs && deviceOs && uaOs !== deviceOs) {
    addReason(reasons, "device_os_ua_mismatch", "OS and User-Agent mismatch", 20, `${uaOs} ≠ ${deviceOs}`);
  }
  if (requestsPerMinute > 120) {
    addReason(reasons, "abnormal_velocity", "Abnormal request velocity", 15, `${requestsPerMinute} req/min`);
  }
  if (duplicateRate > 0.15) {
    addReason(reasons, "high_duplicate_rate", "High duplicate rate", 15, `${Math.round(duplicateRate * 100)}%`);
  }
  if (ipCountry && declaredCountry && ipCountry !== declaredCountry) {
    addReason(reasons, "geo_mismatch", "Country mismatch", 12, `${ipCountry} ≠ ${declaredCountry}`);
  }

  const score = Math.min(100, reasons.reduce((total, reason) => total + reason.weight, 0));
  const decision = score >= 60 ? "BLOCK" : score >= 30 ? "WATCH" : "ALLOW";

  return {
    id: text(record.id) || `row-${index + 1}`,
    score,
    decision,
    reasons,
    original: record,
  };
}

export function analyzeRecords(records) {
  if (!Array.isArray(records) || records.length === 0) throw new Error("The file contains no records to analyze.");
  if (records.length > MAX_RECORDS) throw new Error(`This demo supports up to ${MAX_RECORDS} records.`);
  return records.map((record, index) => analyzeRecord(record, index));
}

function parseCsvRows(input) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  row.push(value);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

function parseCsv(input) {
  const rows = parseCsvRows(input);
  if (rows.length < 2) throw new Error("The CSV must contain a header and at least one record.");
  const headers = rows[0].map((header) => header.trim().replace(/^\uFEFF/, ""));
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

export function parseInput(input, filename = "") {
  const source = input.trim();
  if (!source) throw new Error("The file is empty.");
  const looksJson = /\.(json|jsonl|ndjson)$/i.test(filename) || source.startsWith("[") || source.startsWith("{");

  if (!looksJson) return parseCsv(source);

  try {
    const parsed = JSON.parse(source);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.records)) return parsed.records;
    return [parsed];
  } catch (error) {
    if (/\.(jsonl|ndjson)$/i.test(filename)) {
      return source.split(/\r?\n/).filter(Boolean).map((line, index) => {
        try { return JSON.parse(line); }
        catch { throw new Error(`Invalid JSON on line ${index + 1}.`); }
      });
    }
    throw new Error(error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON.");
  }
}

function csvCell(value) {
  const source = String(value ?? "");
  return /[",\r\n]/.test(source) ? `"${source.replaceAll('"', '""')}"` : source;
}

export function createReportCsv(results) {
  const header = ["id", "decision", "risk_score", "reason_codes", "evidence"];
  const rows = results.map((result) => [
    result.id,
    result.decision,
    result.score,
    result.reasons.map((reason) => reason.code).join(" | "),
    result.reasons.map((reason) => `${reason.title}: ${reason.evidence}`).join(" | "),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function summarize(results) {
  const summary = { total: results.length, allow: 0, watch: 0, block: 0, averageScore: 0 };
  for (const result of results) summary[result.decision.toLowerCase()] += 1;
  summary.averageScore = Math.round(results.reduce((total, result) => total + result.score, 0) / results.length);
  return summary;
}
