import { analyzeRecords, parseInput, summarize } from "../lib/audit-engine.mjs";
import { saveSampleAuditLead } from "./leads.ts";
import { enforceRateLimit, RateLimitError } from "./rate-limit.ts";

const MAX_BODY_BYTES = 384 * 1024;
const MAX_SOURCE_BYTES = 256 * 1024;
const MAX_SAMPLE_RECORDS = 1000;

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-3ve4-leads": "v1", ...extraHeaders },
  });
}

function cleanText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value) && value.length <= 254;
}

async function readBody(request) {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) throw new Error("Content-Type must be application/json.");
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) throw new Error("Sample request is too large.");
  const source = await request.text();
  if (new TextEncoder().encode(source).byteLength > MAX_BODY_BYTES) throw new Error("Sample request is too large.");
  if (!source.trim()) throw new Error("Request body is empty.");
  return JSON.parse(source);
}

async function fingerprint(source) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function topFindings(results) {
  const findings = new Map();
  for (const result of results) {
    for (const reason of result.reasons) {
      const current = findings.get(reason.code) ?? { code: reason.code, title: reason.title, count: 0, weight: reason.weight };
      current.count += 1;
      findings.set(reason.code, current);
    }
  }
  return [...findings.values()].sort((left, right) => right.count - left.count || right.weight - left.weight).slice(0, 5);
}

export async function handleLeadApi(request, database) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/leads")) return null;
  if (url.pathname !== "/api/leads/sample-audit" || request.method !== "POST") return json({ error: "Route not found or method not allowed." }, 405);

  try {
    await enforceRateLimit(database, request, { scope: "sample-audit", limit: 3, windowMs: 60 * 60 * 1000 });
    const input = await readBody(request);
    if (cleanText(input?.website, 200)) return json({ error: "Submission rejected." }, 400);
    const email = cleanText(input?.email, 254).toLowerCase();
    if (!validEmail(email)) throw new Error("Enter a valid work email.");
    if (input?.consent !== true) throw new Error("Consent is required so we can follow up about the full audit.");
    const company = cleanText(input?.company, 80);
    const sourceName = cleanText(input?.fileName, 120) || "traffic-sample.json";
    const source = String(input?.source ?? "");
    const sourceBytes = new TextEncoder().encode(source).byteLength;
    if (!source.trim()) throw new Error("Choose a JSON, JSONL, or CSV sample.");
    if (sourceBytes > MAX_SOURCE_BYTES) return json({ error: "The free sample is limited to 256 KB." }, 413);
    const records = parseInput(source, sourceName);
    if (records.length > MAX_SAMPLE_RECORDS) return json({ error: `The free sample is limited to ${MAX_SAMPLE_RECORDS} records.` }, 413);
    if (!records.every((record) => record && typeof record === "object" && !Array.isArray(record))) throw new Error("Every sample row must be an object.");

    const results = analyzeRecords(records);
    const summary = summarize(results);
    const findings = topFindings(results);
    const lead = await saveSampleAuditLead(database, {
      email,
      company,
      sourceName,
      sourceFingerprint: await fingerprint(source),
      recordCount: summary.total,
      allowCount: summary.allow,
      watchCount: summary.watch,
      blockCount: summary.block,
      averageScore: summary.averageScore,
      topFindings: findings.map(({ code, title, count }) => ({ code, title, count })),
    });

    const preview = [...results].sort((left, right) => right.score - left.score).slice(0, 5).map((result) => ({
      id: result.id,
      decision: result.decision,
      score: result.score,
      primaryReason: result.reasons[0] ? { title: result.reasons[0].title, evidence: result.reasons[0].evidence } : null,
    }));
    return json({
      auditId: lead.id,
      report: {
        summary,
        reviewRate: summary.total ? Number((((summary.watch + summary.block) / summary.total) * 100).toFixed(1)) : 0,
        topFindings: findings.map(({ code, title, count }) => ({ code, title, count })),
        preview,
        limited: true,
      },
    });
  } catch (error) {
    if (error instanceof RateLimitError) return json({ error: error.message, code: "RATE_LIMITED" }, 429, { "retry-after": String(error.retryAfter) });
    return json({ error: error instanceof Error ? error.message : "Sample audit failed." }, 400);
  }
}
