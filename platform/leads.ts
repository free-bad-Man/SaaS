import type { HistoryDatabase } from "./history";

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

const MEMORY_KEY = Symbol.for("3ve4.sampleAuditLeads");

function memoryStore(): SampleAuditLead[] {
  const root = globalThis as typeof globalThis & { [MEMORY_KEY]?: SampleAuditLead[] };
  root[MEMORY_KEY] ??= [];
  return root[MEMORY_KEY];
}

export async function saveSampleAuditLead(database: HistoryDatabase | undefined, input: Omit<SampleAuditLead, "id" | "createdAt">) {
  const lead: SampleAuditLead = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  if (!database) {
    memoryStore().unshift(lead);
    return lead;
  }
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
