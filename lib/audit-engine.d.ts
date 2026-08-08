export type AuditSourceRecord = Record<string, unknown>;
export type AuditReason = { code: string; title: string; weight: number; evidence: string };
export type AuditResult = { id: string; score: number; decision: "ALLOW" | "WATCH" | "BLOCK"; reasons: AuditReason[]; original: AuditSourceRecord };
export type AuditSummary = { total: number; allow: number; watch: number; block: number; averageScore: number };

export const MAX_RECORDS: number;
export const SAMPLE_RECORDS: AuditSourceRecord[];
export function analyzeRecord(record: AuditSourceRecord, index?: number): AuditResult;
export function analyzeRecords(records: AuditSourceRecord[]): AuditResult[];
export function parseInput(input: string, filename?: string): AuditSourceRecord[];
export function createReportCsv(results: AuditResult[]): string;
export function summarize(results: AuditResult[]): AuditSummary;
