import type { HistoryDatabase } from "./history";
import { SAMPLE_AUDIT_LEADS_CREATED_INDEX_SQL, SAMPLE_AUDIT_LEADS_TABLE_SQL } from "../db/schema";

export type SampleAuditLead = {
  id: string;
  email: string;
  company: string;
  sourceName: string;
  sourceFingerprint: string;
  recordCount: number;
  allowCount: number;
  watchCount: number;
  blockCount: number;
  averageScore: number;
  topFindings: Array<{ code: string; title: string; count: number }>;
  createdAt: string;
};

type SampleAuditLeadRow = {
  id: string;
  email: string;
  company: string;
  source_name: string;
  source_fingerprint: string;
  record_count: number;
  allow_count: number;
  watch_count: number;
  block_count: number;
  average_score: number;
  top_findings_json: string;
  created_at: string;
};

const MEMORY_KEY = Symbol.for("verdict.sampleAuditLeads");

function memoryStore(): SampleAuditLead[] {
  const root = globalThis as typeof globalThis & { [MEMORY_KEY]?: SampleAuditLead[] };
  root[MEMORY_KEY] ??= [];
  return root[MEMORY_KEY];
}

async function ensureLeadSchema(database: HistoryDatabase) {
  await database.batch([
    database.prepare(SAMPLE_AUDIT_LEADS_TABLE_SQL),
    database.prepare(SAMPLE_AUDIT_LEADS_CREATED_INDEX_SQL),
  ]);
}

function mapLead(row: SampleAuditLeadRow): SampleAuditLead {
  let topFindings: SampleAuditLead["topFindings"] = [];
  try {
    const parsed = JSON.parse(row.top_findings_json);
    if (Array.isArray(parsed)) topFindings = parsed;
  } catch {
    topFindings = [];
  }
  return {
    id: row.id,
    email: row.email,
    company: row.company,
    sourceName: row.source_name,
    sourceFingerprint: row.source_fingerprint,
    recordCount: row.record_count,
    allowCount: row.allow_count,
    watchCount: row.watch_count,
    blockCount: row.block_count,
    averageScore: row.average_score,
    topFindings,
    createdAt: row.created_at,
  };
}

export async function saveSampleAuditLead(database: HistoryDatabase | undefined, input: Omit<SampleAuditLead, "id" | "createdAt">) {
  const lead: SampleAuditLead = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  if (!database) {
    memoryStore().unshift(lead);
    return lead;
  }
  await ensureLeadSchema(database);
  await database.prepare(
    `INSERT INTO sample_audit_leads (
      id, email, company, source_name, source_fingerprint, record_count,
      allow_count, watch_count, block_count, average_score, top_findings_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    lead.id, lead.email, lead.company, lead.sourceName, lead.sourceFingerprint, lead.recordCount,
    lead.allowCount, lead.watchCount, lead.blockCount, lead.averageScore, JSON.stringify(lead.topFindings), lead.createdAt,
  ).run();
  return lead;
}

export async function listSampleAuditLeads(database: HistoryDatabase | undefined, requestedLimit = 100): Promise<SampleAuditLead[]> {
  const limit = Math.max(1, Math.min(100, Math.trunc(requestedLimit) || 100));
  if (!database) return memoryStore().slice(0, limit);
  await ensureLeadSchema(database);
  const rows = (await database.prepare(
    `SELECT id, email, company, source_name, source_fingerprint, record_count,
      allow_count, watch_count, block_count, average_score, top_findings_json, created_at
     FROM sample_audit_leads ORDER BY created_at DESC LIMIT ?`,
  ).bind(limit).all<SampleAuditLeadRow>()).results ?? [];
  return rows.map(mapLead);
}
