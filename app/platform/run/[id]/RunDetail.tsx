"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPipelineReportCsv } from "@/platform/input.mjs";

type RejectedRow = { index: number; error: string };
type Decision = { campaignId: string; placementId: string; spend: number; revenue: number; conversions: number; roas: number; cpa: number | null; ivtScore: number; decision: string; reason: string };
type Action = { id: string; connector: string; campaignId: string; placementId: string; action: string; value: number | null; mode: string; reason: string };
type DecisionPolicy = { attributionWindowDays: number; pauseIvtScore: number; watchIvtScore: number; pauseRoasBelow: number; watchRoasBelow: number; scaleRoasAtLeast: number; minSpend: number; scaleBidPercent: number; executionMode: "shadow" | "approval" };
const DEFAULT_POLICY: DecisionPolicy = { attributionWindowDays: 7, pauseIvtScore: 60, watchIvtScore: 30, pauseRoasBelow: 0.65, watchRoasBelow: 1, scaleRoasAtLeast: 1.5, minSpend: 10, scaleBidPercent: 15, executionMode: "shadow" };
type PipelineResult = {
  generatedAt: string;
  policy?: DecisionPolicy;
  modules: { ingestion: { accepted: number; rejected: number; duplicates: number }; postbacks: { accepted: number; rejected: number; duplicates: number }; attribution: { attributed: number; unattributed: number; matchRate: number }; ivt: { scored: number; riskyPlacements: number }; optimizer: { decisions: number; actionable: number }; connector: { id: string; mode: string } };
  summary: { spend: number; revenue: number; roas: number; conversions: number };
  decisions: Decision[];
  actions: Action[];
  diagnostics: { rejectedEvents: RejectedRow[]; duplicateEvents: string[]; rejectedPostbacks: RejectedRow[]; duplicatePostbacks: string[]; unattributedPostbacks: Array<{ postback?: { id?: string; clickId?: string }; reason?: string }> };
};
type Run = { id: string; sourceName: string; connector: string; status: string; eventCount: number; postbackCount: number; createdAt: string; result: PipelineResult };

function usd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

export default function RunDetail({ runId }: { runId: string }) {
  const [run, setRun] = useState<Run | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/platform/runs/${encodeURIComponent(runId)}`);
        const body = await response.json() as { run?: Run; error?: string };
        if (!response.ok || !body.run) throw new Error(body.error ?? "Run not found.");
        if (!active) return;
        setRun(body.run);
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    })();
    return () => { active = false; };
  }, [runId]);

  const diagnostics = useMemo(() => {
    if (!run) return [];
    const source = run.result.diagnostics;
    return [
      ...source.rejectedEvents.map((item) => ({ kind: "Event", row: item.index + 1, message: item.error })),
      ...source.rejectedPostbacks.map((item) => ({ kind: "Postback", row: item.index + 1, message: item.error })),
      ...source.duplicateEvents.map((id) => ({ kind: "Duplicate event", row: null, message: `${id} was skipped.` })),
      ...source.duplicatePostbacks.map((id) => ({ kind: "Duplicate postback", row: null, message: `${id} was skipped.` })),
      ...source.unattributedPostbacks.map((item) => ({ kind: "Unattributed", row: null, message: `${item.postback?.id ?? "Postback"}: ${item.reason ?? "No matching click."}` })),
    ];
  }, [run]);
  const policy = run?.result.policy ?? DEFAULT_POLICY;

  function exportReport() {
    if (!run) return;
    const url = URL.createObjectURL(new Blob([createPipelineReportCsv(run.result)], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${run.sourceName.replace(/\.[^.]+$/, "") || "3ve4-run"}-report.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (state === "loading") return <main className="platform-page run-detail-page"><div className="run-detail-state"><i /> Loading pipeline result…</div></main>;
  if (state === "error" || !run) return <main className="platform-page run-detail-page"><div className="run-detail-state run-detail-error"><b>Run unavailable</b><span>The record may belong to an expired local preview session.</span><Link href="/platform">Back to platform →</Link></div></main>;

  return <main className="platform-page run-detail-page">
    <header className="run-detail-nav"><div className="platform-shell"><Link className="platform-brand" href="/"><span>3V</span><b>3VE.4</b></Link><Link href="/platform">← Platform console</Link></div></header>
    <div className="platform-shell run-detail-shell">
      <section className="run-detail-heading">
        <div><p>PIPELINE RUN · {run.status.toUpperCase()}</p><h1>{run.sourceName}</h1><span>{new Date(run.createdAt).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })} · {run.connector.toUpperCase()} · {run.id}</span></div>
        <button type="button" onClick={exportReport}>Export decisions CSV</button>
      </section>

      <section className="run-detail-metrics">
        <article><span>Input rows</span><strong>{run.eventCount + run.postbackCount}</strong><small>{run.eventCount} events · {run.postbackCount} postbacks</small></article>
        <article><span>Accepted events</span><strong>{run.result.modules.ingestion.accepted}</strong><small>{run.result.modules.ingestion.rejected} rejected</small></article>
        <article><span>Attributed revenue</span><strong>{usd(run.result.summary.revenue)}</strong><small>{run.result.summary.conversions} conversions</small></article>
        <article><span>Blended ROAS</span><strong>{run.result.summary.roas.toFixed(2)}x</strong><small>{usd(run.result.summary.spend)} spend</small></article>
        <article><span>Shadow actions</span><strong>{run.result.modules.optimizer.actionable}</strong><small>{run.result.modules.connector.mode} mode</small></article>
      </section>

      <section className="run-policy-strip">
        <div><span>POLICY SNAPSHOT</span><b>{policy.executionMode.toUpperCase()}</b></div>
        <div><span>Attribution</span><b>{policy.attributionWindowDays} days</b></div>
        <div><span>WATCH / PAUSE IVT</span><b>{policy.watchIvtScore} / {policy.pauseIvtScore}</b></div>
        <div><span>PAUSE / WATCH ROAS</span><b>{policy.pauseRoasBelow.toFixed(2)}x / {policy.watchRoasBelow.toFixed(2)}x</b></div>
        <div><span>SCALE</span><b>≥ {policy.scaleRoasAtLeast.toFixed(2)}x · +{policy.scaleBidPercent}%</b></div>
      </section>

      <section className="run-detail-card">
        <div className="console-card-title"><div><b>Placement decisions</b><span>Commercial performance and IVT evidence</span></div><small>{run.result.decisions.length} PLACEMENTS</small></div>
        <div className="placement-table-wrap"><table className="placement-table"><thead><tr><th>Placement</th><th>Spend</th><th>Revenue</th><th>Conv.</th><th>CPA</th><th>ROAS</th><th>IVT</th><th>Decision</th></tr></thead><tbody>
          {run.result.decisions.map((decision) => <tr key={`${decision.campaignId}-${decision.placementId}`}><td><b>{decision.placementId}</b><small>{decision.campaignId}</small></td><td>{usd(decision.spend)}</td><td>{usd(decision.revenue)}</td><td>{decision.conversions}</td><td>{decision.cpa == null ? "—" : usd(decision.cpa)}</td><td><b>{decision.roas.toFixed(2)}x</b></td><td>{decision.ivtScore}</td><td><span className={`optimizer-action action-${decision.decision.toLowerCase()}`}>{decision.decision}</span><small>{decision.reason}</small></td></tr>)}
        </tbody></table></div>
      </section>

      <div className="run-detail-grid">
        <section className="run-detail-card diagnostics-card"><div className="console-card-title"><div><b>Row diagnostics</b><span>Rejected, duplicate, and unmatched records</span></div><small>{diagnostics.length} FINDINGS</small></div>
          {diagnostics.length ? <div className="diagnostics-list">{diagnostics.map((item, index) => <article key={`${item.kind}-${item.row}-${index}`}><span>{item.kind}</span><b>{item.row ? `Row ${item.row}` : "File-level"}</b><p>{item.message}</p></article>)}</div> : <div className="run-detail-empty"><b>No row-level issues detected.</b><span>Every input record passed the current validation rules.</span></div>}
        </section>
        <section className="run-detail-card actions-card"><div className="console-card-title"><div><b>Shadow action queue</b><span>Nothing is pushed without approval</span></div><small>{run.result.actions.length} ACTIONS</small></div>
          {run.result.actions.length ? <div className="action-queue">{run.result.actions.map((action) => <article key={action.id}><div><span>{action.mode.toUpperCase()}</span><b>{action.action.replaceAll("_", " ")}</b></div><p>{action.placementId} · {action.reason}</p><small>{action.connector.toUpperCase()} · {action.campaignId}</small></article>)}</div> : <div className="run-detail-empty"><b>No action required.</b><span>All placements remain inside the current policy.</span></div>}
        </section>
      </div>
    </div>
  </main>;
}
