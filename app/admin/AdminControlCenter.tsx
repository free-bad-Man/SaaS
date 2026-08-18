"use client";

import Link from "next/link";
import VerdictMark from "@/app/components/VerdictMark";
import { useCallback, useEffect, useMemo, useState } from "react";

type AdminAccount = {
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

type RecentRun = {
  id: string;
  projectId: string;
  projectName: string;
  ownerUserId: string;
  sourceName: string;
  connector: string;
  status: string;
  eventCount: number;
  postbackCount: number;
  acceptedEvents: number;
  attributedConversions: number;
  shadowActions: number;
  createdAt: string;
};

type RecentLead = { id: string; email: string; company: string; sourceName: string; recordCount: number; blockCount: number; watchCount: number; createdAt: string };

type Overview = {
  metrics: { accounts: number; projects: number; runs: number; leads: number; processedRows: number; uploadBytes: number; usageRuns: number };
  accountHealth: { active: number; trial: number; suspended: number };
  recentRuns: RecentRun[];
  recentLeads: RecentLead[];
  system: { database: string; connected: boolean; latencyMs: number; persistence: string };
};

type ApiResponse<T> = T & { error?: string; code?: string; viewer?: { email: string; username?: string | null } };

function formatNumber(value: number) { return new Intl.NumberFormat("en-US").format(value); }
function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = value / 1024;
  let unit = units[0];
  for (let index = 1; amount >= 1024 && index < units.length; index += 1) { amount /= 1024; unit = units[index]; }
  return `${amount >= 10 ? amount.toFixed(0) : amount.toFixed(1)} ${unit}`;
}
function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "—";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
function reviewRate(lead: RecentLead) { return lead.recordCount ? ((lead.watchCount + lead.blockCount) / lead.recordCount) * 100 : 0; }

export default function AdminControlCenter() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [viewer, setViewer] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AdminAccount["role"]>("member");
  const [invitePlan, setInvitePlan] = useState<AdminAccount["plan"]>("trial");
  const [inviteState, setInviteState] = useState<"idle" | "creating">("idle");
  const [credential, setCredential] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewResponse, accountsResponse] = await Promise.all([
        fetch("/api/admin/overview", { cache: "no-store", headers: { accept: "application/json" } }),
        fetch("/api/admin/accounts?limit=250", { cache: "no-store", headers: { accept: "application/json" } }),
      ]);
      const overviewBody = await overviewResponse.json() as ApiResponse<{ overview?: Overview }>;
      const accountsBody = await accountsResponse.json() as ApiResponse<{ accounts?: AdminAccount[] }>;
      if (!overviewResponse.ok || !overviewBody.overview) throw new Error(overviewBody.error ?? "Control-center overview could not be loaded.");
      if (!accountsResponse.ok || !accountsBody.accounts) throw new Error(accountsBody.error ?? "Account directory could not be loaded.");
      setOverview(overviewBody.overview);
      setAccounts(accountsBody.accounts);
      setViewer(overviewBody.viewer?.email ?? accountsBody.viewer?.email ?? "Local owner");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Control center could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const conversionCount = useMemo(() => overview?.recentRuns.reduce((sum, run) => sum + run.attributedConversions, 0) ?? 0, [overview]);

  function editAccount(userId: string, field: "role" | "plan" | "status", value: string) {
    setSavedId(null);
    setAccounts((current) => current.map((account) => account.userId === userId ? { ...account, [field]: value } as AdminAccount : account));
  }

  async function saveAccount(account: AdminAccount) {
    setSavingId(account.userId);
    setSavedId(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/accounts/${encodeURIComponent(account.userId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ role: account.role, plan: account.plan, status: account.status }),
      });
      const body = await response.json() as ApiResponse<{ account?: AdminAccount }>;
      if (!response.ok || !body.account) throw new Error(body.error ?? "Account access could not be updated.");
      setAccounts((current) => current.map((item) => item.userId === account.userId ? body.account as AdminAccount : item));
      setSavedId(account.userId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Account access could not be updated.");
    } finally {
      setSavingId(null);
    }
  }

  async function createInvite() {
    setInviteState("creating");
    setError(null);
    setCredential(null);
    try {
      const response = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, plan: invitePlan }),
      });
      const body = await response.json() as ApiResponse<{ account?: AdminAccount; temporaryPassword?: string }>;
      if (!response.ok || !body.account || !body.temporaryPassword) throw new Error(body.error ?? "Customer access could not be created.");
      setAccounts((current) => [body.account as AdminAccount, ...current.filter((item) => item.userId !== body.account?.userId)]);
      setCredential({ email: body.account.email, password: body.temporaryPassword });
      setInviteEmail(""); setInviteRole("member"); setInvitePlan("trial"); setInviteOpen(false); setCopied(false);
      setOverview((current) => current ? { ...current, metrics: { ...current.metrics, accounts: current.metrics.accounts + 1 }, accountHealth: { ...current.accountHealth, active: current.accountHealth.active + 1, trial: current.accountHealth.trial + (body.account?.plan === "trial" ? 1 : 0) } } : current);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Customer access could not be created.");
    } finally {
      setInviteState("idle");
    }
  }

  async function resetPassword(account: AdminAccount) {
    if (!window.confirm(`Issue a new temporary password for ${account.email}? Every current customer session will be revoked.`)) return;
    setSavingId(account.userId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/accounts/${encodeURIComponent(account.userId)}/reset-password`, { method: "POST", headers: { accept: "application/json" } });
      const body = await response.json() as ApiResponse<{ account?: AdminAccount; temporaryPassword?: string }>;
      if (!response.ok || !body.account || !body.temporaryPassword) throw new Error(body.error ?? "Temporary password could not be issued.");
      setAccounts((current) => current.map((item) => item.userId === account.userId ? body.account as AdminAccount : item));
      setCredential({ email: body.account.email, password: body.temporaryPassword });
      setCopied(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Temporary password could not be issued.");
    } finally {
      setSavingId(null);
    }
  }

  async function copyCredential() {
    if (!credential) return;
    const message = `Verdict customer access\nSign in: ${window.location.origin}/login\nEmail: ${credential.email}\nTemporary password: ${credential.password}\n\nYou will be asked to create a private password on first sign-in.`;
    await navigator.clipboard.writeText(message);
    setCopied(true);
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.replace("/admin/login");
  }

  const metrics = overview?.metrics;
  return <main className="admin-page control-page">
    <header className="admin-topbar"><div className="admin-shell admin-nav">
      <Link className="admin-brand" href="/"><VerdictMark /><b>Verdict</b></Link>
      <div className="admin-product"><i /> PRIVATE OPERATIONS <small>CONTROL CENTER</small></div>
      <div className="admin-nav-actions"><Link className="active" href="/admin">Overview</Link><Link href="/admin/leads">Leads</Link><Link href="/platform">Platform</Link><button type="button" onClick={() => void signOut()}>Sign out</button></div>
    </div></header>

    <div className="admin-shell admin-content">
      <section className="admin-heading control-heading"><div><p>SYSTEM OWNER WORKSPACE</p><h1>Admin control center</h1><span>Live product operations, customer access, usage, pipeline activity, and commercial leads in one protected workspace.</span></div><div className="admin-heading-actions"><span className={overview?.system.connected ? "integration-on" : "integration-off"}><i /> {overview?.system.connected ? "Systems operational" : "Checking systems"}</span><button type="button" onClick={() => void refresh()} disabled={loading}>{loading ? "Refreshing…" : "Refresh data"}</button></div></section>

      {error ? <section className="admin-error control-error"><b>Control-center warning</b><p>{error}</p><button type="button" onClick={() => void refresh()}>Retry →</button></section> : null}

      <section className="control-metrics" aria-label="Platform metrics">
        <article><span>Customer accounts</span><strong>{metrics ? formatNumber(metrics.accounts) : "—"}</strong><small>{overview?.accountHealth.active ?? 0} active workspaces</small></article>
        <article><span>Projects</span><strong>{metrics ? formatNumber(metrics.projects) : "—"}</strong><small>persistent workspaces</small></article>
        <article><span>Pipeline runs</span><strong>{metrics ? formatNumber(metrics.runs) : "—"}</strong><small>{metrics?.usageRuns ?? 0} billable runs recorded</small></article>
        <article><span>Processed rows</span><strong>{metrics ? formatNumber(metrics.processedRows) : "—"}</strong><small>lifetime usage ledger</small></article>
        <article><span>Stored uploads</span><strong>{metrics ? formatBytes(metrics.uploadBytes) : "—"}</strong><small>metered customer input</small></article>
        <article><span>Commercial leads</span><strong>{metrics ? formatNumber(metrics.leads) : "—"}</strong><small>sample-audit contacts</small></article>
      </section>

      <section className="control-status-grid">
        <article className="control-panel system-panel"><header><div><span>RUNTIME HEALTH</span><h2>Production system</h2></div><i className={overview?.system.connected ? "health-ok" : ""} /></header><div className="system-rows"><div><span>Database</span><b>{overview?.system.database ?? "Checking…"}</b></div><div><span>Persistence</span><b>{overview?.system.persistence ?? "—"}</b></div><div><span>Query cycle</span><b>{overview ? `${overview.system.latencyMs} ms` : "—"}</b></div><div><span>Application</span><b>6 active modules</b></div></div><footer><i /> Authenticated as <b>{viewer || "checking session"}</b></footer></article>
        <article className="control-panel access-health"><header><div><span>ACCOUNT HEALTH</span><h2>Customer access</h2></div><Link href="#accounts">Manage →</Link></header><div className="access-rings"><div><strong>{overview?.accountHealth.active ?? 0}</strong><span>active</span></div><div><strong>{overview?.accountHealth.trial ?? 0}</strong><span>trial</span></div><div><strong>{overview?.accountHealth.suspended ?? 0}</strong><span>suspended</span></div></div><footer>Control-center owner access is isolated from customer roles.</footer></article>
        <article className="control-panel pulse-panel"><header><div><span>RECENT PULSE</span><h2>Pipeline output</h2></div><span>LAST {overview?.recentRuns.length ?? 0} RUNS</span></header><div><strong>{formatNumber(conversionCount)}</strong><span>attributed conversions</span></div><div><strong>{formatNumber(overview?.recentRuns.reduce((sum, run) => sum + run.shadowActions, 0) ?? 0)}</strong><span>shadow actions</span></div><footer>Run details stay inside each customer project.</footer></article>
      </section>

      <section className="control-activity-grid">
        <article className="control-panel recent-runs"><header><div><span>PLATFORM ACTIVITY</span><h2>Recent pipeline runs</h2></div><Link href="/platform">Open platform ↗</Link></header>
          <div className="activity-table"><div className="activity-head"><span>Source / project</span><span>Events</span><span>Conversions</span><span>Actions</span><span>Time</span></div>{overview?.recentRuns.length ? overview.recentRuns.map((run) => <div className="activity-row" key={run.id}><span><b>{run.sourceName}</b><small>{run.projectName} · {run.connector}</small></span><strong>{formatNumber(run.eventCount)}</strong><strong>{formatNumber(run.attributedConversions)}</strong><strong>{formatNumber(run.shadowActions)}</strong><time>{formatDate(run.createdAt)}</time></div>) : <p className="control-empty">No persistent pipeline runs yet.</p>}</div>
        </article>
        <article className="control-panel recent-leads"><header><div><span>COMMERCIAL SIGNALS</span><h2>Latest leads</h2></div><Link href="/admin/leads">Open inbox →</Link></header><div className="lead-pulse-list">{overview?.recentLeads.length ? overview.recentLeads.map((lead) => <Link href="/admin/leads" key={lead.id}><span>{(lead.company || lead.email).slice(0, 2).toUpperCase()}</span><div><b>{lead.company || lead.email}</b><small>{formatNumber(lead.recordCount)} rows · {reviewRate(lead).toFixed(0)}% review</small></div><time>{formatDate(lead.createdAt)}</time></Link>) : <p className="control-empty">No sample-audit leads yet.</p>}</div></article>
      </section>

      <section className="control-panel accounts-panel" id="accounts"><header><div><span>ACCESS MANAGEMENT</span><h2>Customer accounts</h2><p>Issue invite-only access, change commercial limits, or revoke a customer immediately.</p></div><div className="account-head-actions"><div className="account-legend"><span><i /> Member</span><span><i /> Manager</span></div><button type="button" onClick={() => setInviteOpen((current) => !current)}>{inviteOpen ? "Close" : "Invite customer +"}</button></div></header>
        {inviteOpen ? <div className="invite-form"><label><span>WORK EMAIL</span><input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="buyer@company.com" /></label><label><span>ROLE</span><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as AdminAccount["role"])}><option value="member">Member</option><option value="manager">Manager</option></select></label><label><span>PLAN</span><select value={invitePlan} onChange={(event) => setInvitePlan(event.target.value as AdminAccount["plan"])}><option value="trial">14-day trial</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option></select></label><button type="button" disabled={inviteState === "creating" || !inviteEmail} onClick={() => void createInvite()}>{inviteState === "creating" ? "Creating access…" : "Create secure access →"}</button></div> : null}
        {credential ? <div className="credential-issued"><div><span>ONE-TIME CREDENTIAL</span><b>{credential.email}</b><code>{credential.password}</code><small>Copy it now. Only the password hash is stored, so this value cannot be reopened later.</small></div><div><button type="button" onClick={() => void copyCredential()}>{copied ? "Copied ✓" : "Copy invitation"}</button><button type="button" onClick={() => setCredential(null)}>Dismiss</button></div></div> : null}
        <div className="accounts-scroll"><div className="accounts-table accounts-head"><span>Identity</span><span>Role</span><span>Plan</span><span>Status</span><span>Usage</span><span>Access</span><span>Actions</span></div>{accounts.length ? accounts.map((account) => <div className="accounts-table account-row" key={account.userId}><div><b>{account.email || "No email"}</b><small>{account.userId}</small></div><select aria-label={`Role for ${account.email}`} value={account.role} onChange={(event) => editAccount(account.userId, "role", event.target.value)}><option value="member">Member</option><option value="manager">Manager</option></select><select aria-label={`Plan for ${account.email}`} value={account.plan} onChange={(event) => editAccount(account.userId, "plan", event.target.value)}><option value="trial">Trial</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option></select><select aria-label={`Status for ${account.email}`} className={`status-${account.status}`} value={account.status} onChange={(event) => editAccount(account.userId, "status", event.target.value)}><option value="active">Active</option><option value="expired">Expired</option><option value="suspended">Suspended</option></select><div className="account-usage"><b>{formatNumber(account.processedRows)} rows</b><small>{account.projectCount} projects · {account.runCount} runs · {formatBytes(account.uploadBytes)}</small></div><div className="account-access-state"><b className={account.hasCredentials ? "access-ready" : "access-missing"}>{account.hasCredentials ? account.mustChangePassword ? "Invite pending" : "Secured" : "No login"}</b><small>{account.lastLoginAt ? `Last login ${formatDate(account.lastLoginAt)}` : "Never signed in"}</small></div><div className="account-actions"><button type="button" disabled={savingId === account.userId} onClick={() => void saveAccount(account)}>{savingId === account.userId ? "Working…" : savedId === account.userId ? "Saved ✓" : "Save"}</button><button type="button" disabled={savingId === account.userId} onClick={() => void resetPassword(account)}>{account.hasCredentials ? "Reset" : "Issue login"}</button></div></div>) : <div className="accounts-empty"><span>0</span><div><b>No customer accounts yet</b><p>Invite the first pilot customer. Their temporary password is shown once, and they must replace it before real data access is unlocked.</p></div></div>}</div>
        <footer><span>Roles: managers organize a customer workspace; members use assigned services.</span><span>Plans and status control paid platform access immediately.</span></footer>
      </section>
    </div>
  </main>;
}
