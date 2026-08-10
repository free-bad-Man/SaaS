import type { HistoryDatabase } from "./history";
import { listSampleAuditLeads } from "./leads";

export type AdminAccount = {
  userId: string;
  email: string;
  role: "member" | "manager";
  plan: "trial" | "pro" | "enterprise";
  status: "active" | "expired" | "suspended";
  trialEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
  projectCount: number;
  processedRows: number;
  uploadBytes: number;
  runCount: number;
};

type AccountRow = {
  user_id: string;
  email: string;
  role: AdminAccount["role"];
  plan: AdminAccount["plan"];
  status: AdminAccount["status"];
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
  project_count: number;
  processed_rows: number;
  upload_bytes: number;
  run_count: number;
};

type CountRow = { total: number };
type UsageRow = { processed_rows: number; upload_bytes: number; run_count: number };

export class AdminDataError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "INVALID_ADMIN_INPUT") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function accountFromRow(row: AccountRow): AdminAccount {
  return {
    userId: row.user_id,
    email: row.email,
    role: row.role,
    plan: row.plan,
    status: row.status,
    trialEndsAt: row.trial_ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    projectCount: Number(row.project_count ?? 0),
    processedRows: Number(row.processed_rows ?? 0),
    uploadBytes: Number(row.upload_bytes ?? 0),
    runCount: Number(row.run_count ?? 0),
  };
}

async function count(database: HistoryDatabase, table: string) {
  const allowed = new Set(["accounts", "projects", "pipeline_runs", "sample_audit_leads"]);
  if (!allowed.has(table)) throw new Error("Unsupported admin metric.");
  const row = await database.prepare(`SELECT COUNT(*) AS total FROM ${table}`).first<CountRow>();
  return Number(row?.total ?? 0);
}

export async function listAdminAccounts(database: HistoryDatabase | undefined, requestedLimit = 100): Promise<AdminAccount[]> {
  if (!database) return [];
  const limit = Math.max(1, Math.min(250, Math.trunc(requestedLimit) || 100));
  const rows = (await database.prepare(
    `SELECT a.user_id, a.email, a.role, a.plan, a.status, a.trial_ends_at, a.created_at, a.updated_at,
      (SELECT COUNT(*) FROM projects p WHERE p.owner_user_id = a.user_id) AS project_count,
      (SELECT COALESCE(SUM(u.processed_rows), 0) FROM usage_periods u WHERE u.user_id = a.user_id) AS processed_rows,
      (SELECT COALESCE(SUM(u.upload_bytes), 0) FROM usage_periods u WHERE u.user_id = a.user_id) AS upload_bytes,
      (SELECT COALESCE(SUM(u.run_count), 0) FROM usage_periods u WHERE u.user_id = a.user_id) AS run_count
     FROM accounts a ORDER BY a.updated_at DESC LIMIT ?`,
  ).bind(limit).all<AccountRow>()).results ?? [];
  return rows.map(accountFromRow);
}

export async function updateAdminAccount(database: HistoryDatabase | undefined, userId: string, input: unknown): Promise<AdminAccount> {
  if (!database) throw new AdminDataError("Persistent account storage is unavailable.", 503, "STORAGE_UNAVAILABLE");
  if (!userId) throw new AdminDataError("Account ID is required.");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new AdminDataError("A JSON account update is required.");
  const body = input as Record<string, unknown>;
  const role = String(body.role ?? "");
  const plan = String(body.plan ?? "");
  const status = String(body.status ?? "");
  if (!["member", "manager"].includes(role)) throw new AdminDataError("Role must be member or manager.");
  if (!["trial", "pro", "enterprise"].includes(plan)) throw new AdminDataError("Plan must be trial, pro, or enterprise.");
  if (!["active", "expired", "suspended"].includes(status)) throw new AdminDataError("Status must be active, expired, or suspended.");
  const updatedAt = new Date().toISOString();
  const result = await database.prepare("UPDATE accounts SET role = ?, plan = ?, status = ?, updated_at = ? WHERE user_id = ?")
    .bind(role, plan, status, updatedAt, userId).run() as { changes?: number; meta?: { changes?: number } };
  if (Number(result?.changes ?? result?.meta?.changes ?? 0) < 1) throw new AdminDataError("Account not found.", 404, "ACCOUNT_NOT_FOUND");
  const accounts = await listAdminAccounts(database, 250);
  const account = accounts.find((item) => item.userId === userId);
  if (!account) throw new AdminDataError("Account not found after update.", 404, "ACCOUNT_NOT_FOUND");
  return account;
}

export async function getAdminOverview(database: HistoryDatabase | undefined, env: Record<string, unknown> = {}) {
  const startedAt = performance.now();
  if (!database) {
    return {
      metrics: { accounts: 0, projects: 0, runs: 0, leads: 0, processedRows: 0, uploadBytes: 0, usageRuns: 0 },
      accountHealth: { active: 0, trial: 0, suspended: 0 },
      recentRuns: [],
      recentLeads: await listSampleAuditLeads(undefined, 6),
      system: { database: "memory", connected: true, latencyMs: Math.max(1, Math.round(performance.now() - startedAt)), persistence: "ephemeral" },
    };
  }

  await database.prepare("SELECT 1 AS ok").first();
  const [accounts, projects, runs, leads, usage, active, trial, suspended, recentRuns, recentLeads] = await Promise.all([
    count(database, "accounts"),
    count(database, "projects"),
    count(database, "pipeline_runs"),
    count(database, "sample_audit_leads"),
    database.prepare("SELECT COALESCE(SUM(processed_rows), 0) AS processed_rows, COALESCE(SUM(upload_bytes), 0) AS upload_bytes, COALESCE(SUM(run_count), 0) AS run_count FROM usage_periods").first<UsageRow>(),
    database.prepare("SELECT COUNT(*) AS total FROM accounts WHERE status = 'active'").first<CountRow>(),
    database.prepare("SELECT COUNT(*) AS total FROM accounts WHERE plan = 'trial'").first<CountRow>(),
    database.prepare("SELECT COUNT(*) AS total FROM accounts WHERE status = 'suspended'").first<CountRow>(),
    database.prepare(
      `SELECT r.id, r.project_id, r.source_name, r.connector, r.status, r.event_count, r.postback_count,
        r.accepted_events, r.attributed_conversions, r.shadow_actions, r.created_at,
        p.name AS project_name, p.owner_user_id
       FROM pipeline_runs r JOIN projects p ON p.id = r.project_id
       ORDER BY r.created_at DESC LIMIT 8`,
    ).all<Record<string, unknown>>(),
    listSampleAuditLeads(database, 6),
  ]);

  return {
    metrics: {
      accounts,
      projects,
      runs,
      leads,
      processedRows: Number(usage?.processed_rows ?? 0),
      uploadBytes: Number(usage?.upload_bytes ?? 0),
      usageRuns: Number(usage?.run_count ?? 0),
    },
    accountHealth: { active: Number(active?.total ?? 0), trial: Number(trial?.total ?? 0), suspended: Number(suspended?.total ?? 0) },
    recentRuns: (recentRuns.results ?? []).map((run) => ({
      id: String(run.id ?? ""),
      projectId: String(run.project_id ?? ""),
      projectName: String(run.project_name ?? ""),
      ownerUserId: String(run.owner_user_id ?? ""),
      sourceName: String(run.source_name ?? ""),
      connector: String(run.connector ?? ""),
      status: String(run.status ?? ""),
      eventCount: Number(run.event_count ?? 0),
      postbackCount: Number(run.postback_count ?? 0),
      acceptedEvents: Number(run.accepted_events ?? 0),
      attributedConversions: Number(run.attributed_conversions ?? 0),
      shadowActions: Number(run.shadow_actions ?? 0),
      createdAt: String(run.created_at ?? ""),
    })),
    recentLeads,
    system: {
      database: env.DATABASE_URL ? "PostgreSQL" : "D1-compatible SQL",
      connected: true,
      latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
      persistence: "persistent",
    },
  };
}
