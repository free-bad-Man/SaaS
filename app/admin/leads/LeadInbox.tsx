"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Finding = { code: string; title: string; count: number };
type Lead = {
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
  topFindings: Finding[];
  createdAt: string;
};

type InboxResponse = {
  leads?: Lead[];
  viewer?: { email: string };
  integrations?: { telegram: boolean };
  error?: string;
  code?: string;
};

function reviewRate(lead: Lead) {
  return lead.recordCount ? ((lead.watchCount + lead.blockCount) / lead.recordCount) * 100 : 0;
}

function formatDate(value: string, includeTime = true) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", includeTime
    ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export default function LeadInbox() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [telegram, setTelegram] = useState(false);
  const [viewer, setViewer] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/leads?limit=100", { cache: "no-store", headers: { accept: "application/json" } });
      const body = await response.json() as InboxResponse;
      if (!response.ok || !body.leads) throw Object.assign(new Error(body.error ?? "Lead inbox could not be loaded."), { code: body.code });
      setError(null);
      setErrorCode(null);
      setLeads(body.leads);
      setSelectedId((current) => current && body.leads?.some((lead) => lead.id === current) ? current : body.leads?.[0]?.id ?? null);
      setTelegram(Boolean(body.integrations?.telegram));
      setViewer(body.viewer?.email ?? "");
    } catch (caught) {
      const failure = caught as Error & { code?: string };
      setError(failure.message);
      setErrorCode(failure.code ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const visibleLeads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return leads;
    return leads.filter((lead) => [lead.email, lead.company, lead.sourceName, lead.id].some((value) => value.toLowerCase().includes(needle)));
  }, [leads, query]);

  const selected = leads.find((lead) => lead.id === selectedId) ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const receivedToday = leads.filter((lead) => lead.createdAt.slice(0, 10) === today).length;
  const rowsAnalyzed = leads.reduce((sum, lead) => sum + lead.recordCount, 0);
  const averageReview = leads.length ? leads.reduce((sum, lead) => sum + reviewRate(lead), 0) / leads.length : 0;

  function exportCsv() {
    const header = ["created_at", "email", "company", "source", "records", "allow", "watch", "block", "average_risk", "review_rate", "audit_id"];
    const rows = leads.map((lead) => [lead.createdAt, lead.email, lead.company, lead.sourceName, lead.recordCount, lead.allowCount, lead.watchCount, lead.blockCount, lead.averageScore, reviewRate(lead).toFixed(1), lead.id]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `3ve4-leads-${today}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <main className="admin-page">
    <header className="admin-topbar"><div className="admin-shell admin-nav">
      <Link className="admin-brand" href="/"><span>3V</span><b>3VE.4</b></Link>
      <div className="admin-product"><i /> PRIVATE OPERATIONS <small>LEAD INBOX</small></div>
      <div className="admin-nav-actions"><Link href="/platform">Platform</Link><a href="/signout-with-chatgpt?return_to=%2F">Sign out</a></div>
    </div></header>

    <div className="admin-shell admin-content">
      <section className="admin-heading"><div><p>COMMERCIAL WORKSPACE</p><h1>Sample-audit leads</h1><span>Every contact and aggregate result in one protected queue. Raw customer files are never stored here.</span></div><div className="admin-heading-actions"><span className={telegram ? "integration-on" : "integration-off"}><i /> Telegram {telegram ? "connected" : "not configured"}</span><button type="button" onClick={() => { setLoading(true); setError(null); void refresh(); }} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></div></section>

      {error ? <section className="admin-error"><b>{errorCode === "AUTH_REQUIRED" ? "Authentication required" : "Inbox unavailable"}</b><p>{error}</p>{errorCode === "AUTH_REQUIRED" ? <a href="/signin-with-chatgpt?return_to=%2Fadmin%2Fleads">Sign in with ChatGPT →</a> : null}</section> : <>
        <section className="admin-metrics" aria-label="Lead metrics">
          <article><span>Total leads</span><strong>{leads.length}</strong><small>latest 100 submissions</small></article>
          <article><span>Received today</span><strong>{receivedToday}</strong><small>UTC reporting day</small></article>
          <article><span>Rows analyzed</span><strong>{rowsAnalyzed.toLocaleString("en-US")}</strong><small>aggregate only</small></article>
          <article><span>Average review</span><strong>{averageReview.toFixed(1)}%</strong><small>watch + block</small></article>
        </section>

        <section className="inbox-toolbar"><label><span>Search leads</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Email, company, source, audit ID" /></label><div><span>{viewer ? `Signed in as ${viewer}` : "Local owner mode"}</span><button type="button" onClick={exportCsv} disabled={leads.length === 0}>Export CSV ↓</button></div></section>

        <section className="lead-workspace">
          <div className="lead-list" aria-label="Sample-audit leads">
            <div className="lead-list-head"><b>QUEUE</b><span>{visibleLeads.length} lead{visibleLeads.length === 1 ? "" : "s"}</span></div>
            {loading ? <p className="lead-empty">Loading protected lead data…</p> : visibleLeads.length === 0 ? <p className="lead-empty">No matching leads yet.</p> : visibleLeads.map((lead) => <button type="button" key={lead.id} className={lead.id === selectedId ? "selected" : ""} onClick={() => setSelectedId(lead.id)}>
              <span className="lead-avatar">{(lead.company || lead.email).slice(0, 2).toUpperCase()}</span>
              <span className="lead-list-copy"><b>{lead.company || lead.email}</b><small>{lead.company ? lead.email : lead.sourceName}</small><i>{formatDate(lead.createdAt)}</i></span>
              <span className={reviewRate(lead) >= 50 ? "lead-risk high" : "lead-risk"}>{reviewRate(lead).toFixed(0)}%</span>
            </button>)}
          </div>

          <article className="lead-detail">
            {!selected ? <div className="lead-detail-empty"><span>3V</span><h2>Select a lead</h2><p>The full aggregate sample result will appear here.</p></div> : <>
              <header><div><span>AUDIT {selected.id.slice(0, 8).toUpperCase()}</span><h2>{selected.company || "Independent buyer"}</h2><p>Received {formatDate(selected.createdAt)} · {selected.sourceName}</p></div><a href={`mailto:${selected.email}?subject=${encodeURIComponent("Your 3VE.4 sample audit")}`}>Email lead ↗</a></header>
              <div className="lead-contact"><div><span>CONTACT</span><a href={`mailto:${selected.email}`}>{selected.email}</a></div><div><span>COMPANY</span><b>{selected.company || "Not provided"}</b></div><div><span>SUBMITTED</span><b>{formatDate(selected.createdAt, false)}</b></div></div>
              <div className="lead-score-grid"><article><span>Records</span><strong>{selected.recordCount}</strong></article><article><span>Allow</span><strong className="score-allow">{selected.allowCount}</strong></article><article><span>Watch</span><strong className="score-watch">{selected.watchCount}</strong></article><article><span>Block</span><strong className="score-block">{selected.blockCount}</strong></article><article><span>Avg risk</span><strong>{selected.averageScore}</strong></article><article><span>Review</span><strong>{reviewRate(selected).toFixed(1)}%</strong></article></div>
              <div className="lead-findings"><div className="lead-section-title"><b>Top findings</b><span>{selected.topFindings.length} detected</span></div>{selected.topFindings.length ? selected.topFindings.map((finding) => <div key={finding.code}><span><i /> {finding.title}<small>{finding.code}</small></span><b>{finding.count}</b></div>) : <p>No configured risk signals found.</p>}</div>
              <footer><div><span>Source fingerprint</span><code>{selected.sourceFingerprint}</code></div><small>Only contact details, filename, fingerprint, and aggregate findings are retained.</small></footer>
            </>}
          </article>
        </section>
      </>}
    </div>
  </main>;
}
