import type { HistoryDatabase } from "./history";
import { getAdminSession } from "./auth.mjs";

type Plan = "demo" | "trial" | "pro" | "enterprise";
type Account = { userId: string; email: string; plan: Plan; status: "active" | "expired" | "suspended"; trialEndsAt: string | null; createdAt: string; updatedAt: string };
type Usage = { processedRows: number; uploadBytes: number; runCount: number };

export type PlatformAccess = {
  authenticated: boolean;
  userId: string | null;
  email: string | null;
  plan: Plan;
  status: "demo" | "active" | "expired" | "suspended";
  trialEndsAt: string | null;
  canUsePaidFeatures: boolean;
  isLocalDevelopment: boolean;
  limits: { rowsPerRun: number; rowsPerMonth: number; uploadBytesPerMonth: number };
  usage: Usage;
  role: "anonymous" | "member" | "admin";
};

type MemoryState = { accounts: Map<string, Account>; usage: Map<string, Usage> };
const MEMORY_KEY = "__3ve4PlatformAccess";

function memoryState(): MemoryState {
  const root = globalThis as typeof globalThis & { [MEMORY_KEY]?: MemoryState };
  root[MEMORY_KEY] ??= { accounts: new Map(), usage: new Map() };
  return root[MEMORY_KEY];
}

function period() { return new Date().toISOString().slice(0, 7); }

function identity(request: Request) {
  const userId = request.headers.get("oai-authenticated-user-id");
  if (userId) return { userId, email: request.headers.get("oai-authenticated-user-email") ?? "" , local: false };
  const hostname = new URL(request.url).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") return { userId: "local-owner", email: "owner@local.3ve4", local: true };
  return null;
}

function limits(plan: Plan) {
  if (plan === "enterprise") return { rowsPerRun: 1_000_000, rowsPerMonth: 50_000_000, uploadBytesPerMonth: 100 * 1024 ** 3 };
  if (plan === "pro") return { rowsPerRun: 250_000, rowsPerMonth: 5_000_000, uploadBytesPerMonth: 10 * 1024 ** 3 };
  if (plan === "trial") return { rowsPerRun: 100_000, rowsPerMonth: 250_000, uploadBytesPerMonth: 250 * 1024 ** 2 };
  return { rowsPerRun: 0, rowsPerMonth: 0, uploadBytesPerMonth: 0 };
}

async function ensureAccount(database: HistoryDatabase | undefined, userId: string, email: string, local: boolean): Promise<Account> {
  const now = new Date();
  if (!database) {
    const store = memoryState();
    const current = store.accounts.get(userId);
    if (current) return current;
    const account: Account = { userId, email, plan: local ? "pro" : "trial", status: "active", trialEndsAt: local ? null : new Date(now.getTime() + 14 * 86400000).toISOString(), createdAt: now.toISOString(), updatedAt: now.toISOString() };
    store.accounts.set(userId, account);
    return account;
  }
  const row = await database.prepare("SELECT user_id, email, plan, status, trial_ends_at, created_at, updated_at FROM accounts WHERE user_id = ?").bind(userId).first<{ user_id: string; email: string; plan: Plan; status: Account["status"]; trial_ends_at: string | null; created_at: string; updated_at: string }>();
  if (row) return { userId: row.user_id, email: row.email, plan: row.plan, status: row.status, trialEndsAt: row.trial_ends_at, createdAt: row.created_at, updatedAt: row.updated_at };
  const account: Account = { userId, email, plan: "trial", status: "active", trialEndsAt: new Date(now.getTime() + 14 * 86400000).toISOString(), createdAt: now.toISOString(), updatedAt: now.toISOString() };
  await database.prepare("INSERT INTO accounts (user_id, email, plan, status, trial_ends_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(account.userId, account.email, account.plan, account.status, account.trialEndsAt, account.createdAt, account.updatedAt).run();
  return account;
}

async function getUsage(database: HistoryDatabase | undefined, userId: string): Promise<Usage> {
  if (!database) return memoryState().usage.get(`${userId}:${period()}`) ?? { processedRows: 0, uploadBytes: 0, runCount: 0 };
  const row = await database.prepare("SELECT processed_rows, upload_bytes, run_count FROM usage_periods WHERE user_id = ? AND period = ?").bind(userId, period()).first<{ processed_rows: number; upload_bytes: number; run_count: number }>();
  return row ? { processedRows: row.processed_rows, uploadBytes: row.upload_bytes, runCount: row.run_count } : { processedRows: 0, uploadBytes: 0, runCount: 0 };
}

export async function getPlatformAccess(database: HistoryDatabase | undefined, request: Request, env: Record<string, unknown> = {}): Promise<PlatformAccess> {
  const admin = await getAdminSession(request, env);
  if (admin) {
    const userId = `admin:${admin.username}`;
    return { authenticated: true, userId, email: admin.email, plan: "enterprise", status: "active", trialEndsAt: null, canUsePaidFeatures: true, isLocalDevelopment: false, limits: limits("enterprise"), usage: await getUsage(database, userId), role: "admin" };
  }
  const viewer = identity(request);
  if (!viewer) return { authenticated: false, userId: null, email: null, plan: "demo", status: "demo", trialEndsAt: null, canUsePaidFeatures: false, isLocalDevelopment: false, limits: limits("demo"), usage: { processedRows: 0, uploadBytes: 0, runCount: 0 }, role: "anonymous" };
  const account = await ensureAccount(database, viewer.userId, viewer.email, viewer.local);
  const trialExpired = account.plan === "trial" && !!account.trialEndsAt && Date.parse(account.trialEndsAt) <= Date.now();
  const status = trialExpired ? "expired" : account.status;
  return { authenticated: true, userId: account.userId, email: account.email, plan: account.plan, status, trialEndsAt: account.trialEndsAt, canUsePaidFeatures: status === "active", isLocalDevelopment: viewer.local, limits: limits(account.plan), usage: await getUsage(database, account.userId), role: "member" };
}

export function assertUsageAllowed(access: PlatformAccess, rows: number, uploadBytes = 0) {
  if (!access.canUsePaidFeatures || !access.userId) throw new Error("A paid workspace or active trial is required.");
  if (rows > access.limits.rowsPerRun) throw new Error(`This plan allows up to ${access.limits.rowsPerRun} rows per run.`);
  if (access.usage.processedRows + rows > access.limits.rowsPerMonth) throw new Error("Monthly processed-row limit reached.");
  if (access.usage.uploadBytes + uploadBytes > access.limits.uploadBytesPerMonth) throw new Error("Monthly upload limit reached.");
}

export async function recordUsage(database: HistoryDatabase | undefined, userId: string, rows: number, uploadBytes = 0, incrementRun = true) {
  const now = new Date().toISOString();
  if (!database) {
    const store = memoryState();
    const key = `${userId}:${period()}`;
    const current = store.usage.get(key) ?? { processedRows: 0, uploadBytes: 0, runCount: 0 };
    store.usage.set(key, { processedRows: current.processedRows + rows, uploadBytes: current.uploadBytes + uploadBytes, runCount: current.runCount + (incrementRun ? 1 : 0) });
    return;
  }
  await database.prepare(
    `INSERT INTO usage_periods (user_id, period, processed_rows, upload_bytes, run_count, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, period) DO UPDATE SET processed_rows = usage_periods.processed_rows + excluded.processed_rows,
       upload_bytes = usage_periods.upload_bytes + excluded.upload_bytes,
       run_count = usage_periods.run_count + excluded.run_count, updated_at = excluded.updated_at`,
  ).bind(userId, period(), rows, uploadBytes, incrementRun ? 1 : 0, now).run();
}
