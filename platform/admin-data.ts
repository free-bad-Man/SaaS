import type { HistoryDatabase } from "./history";
import { listSampleAuditLeads } from "./leads";
import { createPasswordHash } from "./auth.mjs";

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
  hasCredentials: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
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
  has_credentials: boolean | number;
  must_change_password: boolean | number;
  last_login_at: string | null;
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
    hasCredentials: Boolean(row.has_credentials),
    mustChangePassword: Boolean(row.must_change_password),
    lastLoginAt: row.last_login_at,
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
      (SELECT COALESCE(SUM(u.run_count), 0) FROM usage_periods u WHERE u.user_id = a.user_id) AS run_count,
      EXISTS(SELECT 1 FROM customer_credentials c WHERE c.account_user_id = a.user_id) AS has_credentials,
      COALESCE((SELECT c.must_change_password FROM customer_credentials c WHERE c.account_user_id = a.user_id), 0) AS must_change_password,
      (SELECT c.last_login_at FROM customer_credentials c WHERE c.account_user_id = a.user_id) AS last_login_at
     FROM accounts a ORDER BY a.updated_at DESC LIMIT ?`,
  ).bind(limit).all<AccountRow>()).results ?? [];
  return rows.map(accountFromRow);
}

function normalizeEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) throw new AdminDataError("Enter a valid customer email address.");
  return email;
}

function requestedRole(value: unknown): AdminAccount["role"] {
  const role = String(value ?? "member");
  if (role !== "member" && role !== "manager") throw new AdminDataError("Role must be member or manager.");
  return role;
}

function requestedPlan(value: unknown): AdminAccount["plan"] {
  const plan = String(value ?? "trial");
  if (plan !== "trial" && plan !== "pro" && plan !== "enterprise") throw new AdminDataError("Plan must be trial, pro, or enterprise.");
  return plan;
}

function temporaryPassword() {
  return `3V!${crypto.randomUUID().replaceAll("-", "")}a9`;
}

export async function createAdminAccount(database: HistoryDatabase | undefined, input: unknown) {
  if (!database) throw new AdminDataError("Persistent account storage is unavailable.", 503, "STORAGE_UNAVAILABLE");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new AdminDataError("A JSON customer invitation is required.");
  const body = input as Record<string, unknown>;
  const email = normalizeEmail(body.email);
  const role = requestedRole(body.role);
  const plan = requestedPlan(body.plan);
  const existingCredential = await database.prepare("SELECT account_user_id FROM customer_credentials WHERE email_normalized = ?").bind(email).first<{ account_user_id: string }>();
  if (existingCredential) throw new AdminDataError("This email already has customer sign-in access.", 409, "ACCOUNT_EXISTS");
  const existingAccount = await database.prepare("SELECT user_id FROM accounts WHERE LOWER(email) = ?").bind(email).first<{ user_id: string }>();
  const userId = existingAccount?.user_id ?? `customer:${crypto.randomUUID()}`;
  const password = temporaryPassword();
  const passwordHash = await createPasswordHash(password);
  const now = new Date();
  const createdAt = now.toISOString();
  const trialEndsAt = plan === "trial" ? new Date(now.getTime() + 14 * 86400000).toISOString() : null;
  const accountStatement = existingAccount
    ? database.prepare("UPDATE accounts SET email = ?, role = ?, plan = ?, status = 'active', trial_ends_at = ?, updated_at = ? WHERE user_id = ?").bind(email, role, plan, trialEndsAt, createdAt, userId)
    : database.prepare("INSERT INTO accounts (user_id, email, role, plan, status, trial_ends_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?, ?)").bind(userId, email, role, plan, trialEndsAt, createdAt, createdAt);
  await database.batch([
    accountStatement,
    database.prepare("INSERT INTO customer_credentials (account_user_id, email_normalized, password_hash, must_change_password, session_version, last_login_at, created_at, updated_at) VALUES (?, ?, ?, 1, 1, NULL, ?, ?)")
      .bind(userId, email, passwordHash, createdAt, createdAt),
  ]);
  const account = (await listAdminAccounts(database, 250)).find((item) => item.userId === userId);
  if (!account) throw new AdminDataError("Customer account could not be reopened after creation.", 500, "ACCOUNT_CREATE_FAILED");
  return { account, temporaryPassword: password };
}

export async function resetAdminAccountPassword(database: HistoryDatabase | undefined, userId: string) {
  if (!database) throw new AdminDataError("Persistent account storage is unavailable.", 503, "STORAGE_UNAVAILABLE");
  const account = await database.prepare("SELECT user_id, email FROM accounts WHERE user_id = ?").bind(userId).first<{ user_id: string; email: string }>();
  if (!account) throw new AdminDataError("Account not found.", 404, "ACCOUNT_NOT_FOUND");
  const email = normalizeEmail(account.email);
  const password = temporaryPassword();
  const passwordHash = await createPasswordHash(password);
  const now = new Date().toISOString();
  const credential = await database.prepare("SELECT account_user_id FROM customer_credentials WHERE account_user_id = ?").bind(userId).first<{ account_user_id: string }>();
  if (credential) {
    await database.prepare("UPDATE customer_credentials SET password_hash = ?, must_change_password = 1, session_version = session_version + 1, updated_at = ? WHERE account_user_id = ?")
      .bind(passwordHash, now, userId).run();
  } else {
    await database.prepare("INSERT INTO customer_credentials (account_user_id, email_normalized, password_hash, must_change_password, session_version, last_login_at, created_at, updated_at) VALUES (?, ?, ?, 1, 1, NULL, ?, ?)")
      .bind(userId, email, passwordHash, now, now).run();
  }
  const updatedAccount = (await listAdminAccounts(database, 250)).find((item) => item.userId === userId);
  if (!updatedAccount) throw new AdminDataError("Account not found after password reset.", 404, "ACCOUNT_NOT_FOUND");
  return { account: updatedAccount, temporaryPassword: password };
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
