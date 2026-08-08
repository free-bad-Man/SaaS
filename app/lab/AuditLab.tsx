"use client";

import { ChangeEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  SAMPLE_RECORDS,
  analyzeRecords,
  createReportCsv,
  parseInput,
  summarize,
} from "@/lib/audit-engine.mjs";

type AuditResult = {
  id: string;
  score: number;
  decision: "ALLOW" | "WATCH" | "BLOCK";
  reasons: Array<{ code: string; title: string; weight: number; evidence: string }>;
  original: Record<string, unknown>;
};

const MAX_FILE_SIZE = 2 * 1024 * 1024;

function download(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function AuditLab() {
  const [results, setResults] = useState<AuditResult[]>(() => analyzeRecords(SAMPLE_RECORDS) as AuditResult[]);
  const [sourceName, setSourceName] = useState("synthetic-openrtb-sample.json");
  const [error, setError] = useState("");
  const summary = useMemo(() => summarize(results), [results]);

  function loadSample() {
    setResults(analyzeRecords(SAMPLE_RECORDS) as AuditResult[]);
    setSourceName("synthetic-openrtb-sample.json");
    setError("");
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setError("For this browser demo, please use a file no larger than 2 MB.");
      event.target.value = "";
      return;
    }

    try {
      const records = parseInput(await file.text(), file.name);
      setResults(analyzeRecords(records) as AuditResult[]);
      setSourceName(file.name);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The file could not be read.");
    } finally {
      event.target.value = "";
    }
  }

  function downloadReport() {
    download("ivt-guard-report.csv", `\uFEFF${createReportCsv(results)}`, "text/csv;charset=utf-8");
  }

  function downloadSample() {
    download("ivt-guard-sample.json", JSON.stringify(SAMPLE_RECORDS, null, 2), "application/json;charset=utf-8");
  }

  return (
    <main className="lab-page">
      <header className="lab-nav-wrap">
        <nav className="lab-shell lab-nav" aria-label="Lab navigation">
          <Link className="brand" href="/" aria-label="IVT Guard — home">
            <span className="brand-mark" aria-hidden="true"><i /><i /></span>
            <span>IVT Guard</span>
          </Link>
          <span className="lab-nav-title">Traffic audit lab</span>
          <Link className="lab-back" href="/">Back home <span aria-hidden="true">↗</span></Link>
        </nav>
      </header>

      <section className="lab-hero lab-shell">
        <div>
          <p className="lab-kicker"><i /> LIVE PRODUCT DEMO</p>
          <h1>Audit an advertising log locally.</h1>
          <p>Upload a small JSON or CSV file. The analysis runs entirely in your browser — your file is never sent to a server.</p>
        </div>
        <div className="privacy-note"><b>Local-only</b><span>Your data stays on your device</span></div>
      </section>

      <section className="lab-workspace lab-shell" aria-label="Traffic audit workspace">
        <aside className="upload-panel">
          <div className="upload-heading"><span>01</span><div><b>Data source</b><small>JSON, JSONL, or CSV · up to 2 MB</small></div></div>
          <label className="file-drop">
            <input type="file" accept=".json,.jsonl,.ndjson,.csv,application/json,text/csv" onChange={handleFile} />
            <span className="upload-icon" aria-hidden="true">↑</span>
            <strong>Choose a file</strong>
            <small>or use the ready-made sample</small>
          </label>
          {error ? <p className="lab-error" role="alert">{error}</p> : null}
          <div className="sample-actions">
            <button type="button" onClick={loadSample}>Run sample</button>
            <button type="button" onClick={downloadSample}>Download JSON</button>
          </div>
          <div className="field-list">
            <span>Supported fields</span>
            <code>site_domain</code><code>page_domain</code><code>schain_nodes</code><code>seller_id</code>
            <code>user_agent</code><code>device_os</code><code>requests_per_minute</code><code>duplicate_rate</code>
            <code>ip_country</code><code>declared_country</code><code>connection_type</code>
          </div>
        </aside>

        <div className="results-panel">
          <div className="results-toolbar">
            <div><span className="analysis-dot" /><div><b>Analysis complete</b><small>{sourceName}</small></div></div>
            <button type="button" className="export-button" onClick={downloadReport}>Download report <span aria-hidden="true">↓</span></button>
          </div>

          <div className="lab-metrics">
            <article><span>Records</span><strong>{summary.total}</strong><small>in current file</small></article>
            <article><span>Allow</span><strong>{summary.allow}</strong><small>low risk</small></article>
            <article><span>Watch</span><strong>{summary.watch}</strong><small>review needed</small></article>
            <article><span>Block</span><strong>{summary.block}</strong><small>high risk</small></article>
            <article><span>Average score</span><strong>{summary.averageScore}</strong><small>out of 100</small></article>
          </div>

          <div className="results-table-wrap">
            <table className="results-table">
              <thead><tr><th>Request ID</th><th>Decision</th><th>Score</th><th>Primary reason</th></tr></thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.id}>
                    <td><code>{result.id}</code></td>
                    <td><span className={`lab-decision lab-${result.decision.toLowerCase()}`}>{result.decision}</span></td>
                    <td><b className="score-cell">{result.score}</b></td>
                    <td><span>{result.reasons[0]?.title ?? "No signals detected"}</span><small>{result.reasons[0]?.evidence ?? "—"}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rule-section lab-shell">
        <div><p className="lab-kicker">RULE ENGINE</p><h2>Seven transparent checks.</h2><p>Each signal has a fixed weight, so every decision can be reproduced and explained.</p></div>
        <div className="rule-grid">
          <span>Domain mismatch <b>+35</b></span>
          <span>Supply chain <b>+20</b></span>
          <span>Datacenter / proxy <b>+20</b></span>
          <span>OS / UA mismatch <b>+20</b></span>
          <span>Request velocity <b>+15</b></span>
          <span>Duplicate rate <b>+15</b></span>
          <span>Country mismatch <b>+12</b></span>
        </div>
      </section>

      <section className="lab-cta">
        <div className="lab-shell"><div><span>Need an audit of real data?</span><h2>Start with a limited export.</h2></div><a href="https://freelance.ru/darkPulsar" target="_blank" rel="noreferrer">Discuss the project <span aria-hidden="true">↗</span></a></div>
      </section>
    </main>
  );
}
