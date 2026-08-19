"use client";

import { FormEvent, useState } from "react";
import { SAMPLE_RECORDS } from "@/lib/audit-engine.mjs";

type AuditReport = {
  summary: { total: number; allow: number; watch: number; block: number; averageScore: number };
  reviewRate: number;
  topFindings: Array<{ code: string; title: string; count: number }>;
  preview: Array<{ id: string; decision: "ALLOW" | "WATCH" | "BLOCK"; score: number; primaryReason: { title: string; evidence: string } | null }>;
  limited: true;
};

const MAX_FILE_BYTES = 256 * 1024;

export default function SampleAuditLead() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [state, setState] = useState<"idle" | "submitting" | "complete" | "error">("idle");
  const [error, setError] = useState("");

  function selectFile(nextFile: File | null) {
    setReport(null);
    setError("");
    setState("idle");
    if (nextFile && nextFile.size > MAX_FILE_BYTES) {
      setFile(null);
      setError("The free sample is limited to 256 KB.");
      setState("error");
      return;
    }
    setFile(nextFile);
  }

  function useSyntheticSample() {
    selectFile(new File([JSON.stringify(SAMPLE_RECORDS, null, 2)], "synthetic-openrtb-sample.json", { type: "application/json" }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose a JSON, JSONL, or CSV sample first.");
      setState("error");
      return;
    }
    setState("submitting");
    setError("");
    setReport(null);
    try {
      const response = await fetch("/api/leads/sample-audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, company, consent, website, fileName: file.name, source: await file.text() }),
      });
      const body = await response.json() as { report?: AuditReport; error?: string };
      if (!response.ok || !body.report) throw new Error(body.error ?? "The sample audit could not be completed.");
      setReport(body.report);
      setState("complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The sample audit could not be completed.");
      setState("error");
    }
  }

  return <section className="sample-audit-section shell" id="sample-audit" aria-labelledby="sample-audit-title">
    <div className="sample-audit-copy">
      <p className="section-label">Free traffic check</p>
      <h2 id="sample-audit-title">Upload a small sample.<br />See the risk immediately.</h2>
      <p>Get a limited, explainable preview before commissioning a full audit. We process the sample server-side, keep no raw file, and store only the contact and aggregate result.</p>
      <ul>
        <li>Up to 1,000 JSON, JSONL, or CSV rows</li>
        <li>ALLOW / WATCH / BLOCK distribution</li>
        <li>Top reason codes and five riskiest rows</li>
        <li>No automatic blocking or DSP access</li>
      </ul>
    </div>

    <div className="sample-audit-card">
      {!report ? <form onSubmit={submit} className="sample-audit-form">
        <div className="sample-form-head"><div><b>Run limited audit</b><small>256 KB · 1,000 rows · no raw-file storage</small></div></div>
        <div className="sample-fields">
          <label><span>Work email</span><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label>
          <label><span>Company / team <small>optional</small></span><input type="text" maxLength={80} autoComplete="organization" value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Media team" /></label>
        </div>
        <label className={`sample-file${file ? " has-file" : ""}`}>
          <input type="file" required={!file} accept=".json,.jsonl,.ndjson,.csv,application/json,text/csv" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} />
          <span aria-hidden="true">↑</span>
          <div><b>{file ? file.name : "Choose traffic sample"}</b><small>{file ? `${Math.max(1, Math.ceil(file.size / 1024))} KB selected` : "JSON, JSONL, or CSV"}</small></div>
        </label>
        <button className="sample-use-demo" type="button" onClick={useSyntheticSample}>Use synthetic sample instead</button>
        <label className="sample-consent"><input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I agree to be contacted about the complete audit. My raw sample is not stored.</span></label>
        <label className="sample-honeypot" aria-hidden="true">Website<input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
        {error ? <p className="sample-error" role="alert">{error}</p> : null}
        <button className="sample-submit" type="submit" disabled={state === "submitting"}>{state === "submitting" ? "Analyzing sample…" : "Run free sample audit →"}</button>
        <p className="sample-privacy">The result appears immediately. Your email is retained only for audit follow-up.</p>
      </form> : <div className="sample-report" aria-live="polite">
        <div className="sample-report-head"><div><span><i /> ANALYSIS COMPLETE</span><h3>{report.reviewRate}% requires review.</h3><p>This is a limited preview. A full engagement includes every scored row, evidence export, economic impact, and recommendations.</p></div><b>{report.summary.averageScore}<small>AVG RISK</small></b></div>
        <div className="sample-report-metrics"><span>Total <b>{report.summary.total}</b></span><span>Allow <b>{report.summary.allow}</b></span><span>Watch <b>{report.summary.watch}</b></span><span>Block <b>{report.summary.block}</b></span></div>
        <div className="sample-report-grid">
          <div><span className="sample-report-label">TOP FINDINGS</span>{report.topFindings.length ? report.topFindings.map((finding) => <p key={finding.code}><b>{finding.title}</b><small>{finding.count} row{finding.count === 1 ? "" : "s"}</small></p>) : <p><b>No configured risk signals found</b><small>Low-risk sample</small></p>}</div>
          <div><span className="sample-report-label">RISK PREVIEW</span>{report.preview.map((row) => <p key={row.id}><span className={`sample-decision sample-${row.decision.toLowerCase()}`}>{row.decision}</span><b>{row.id}</b><small>{row.score} · {row.primaryReason?.title ?? "No finding"}</small></p>)}</div>
        </div>
        <div className="sample-report-actions"><a href="https://adminez.sh/" target="_blank" rel="noreferrer">Discuss the full audit ↗</a><button type="button" onClick={() => { setReport(null); setFile(null); setState("idle"); }}>Analyze another sample</button></div>
      </div>}
    </div>
  </section>;
}
