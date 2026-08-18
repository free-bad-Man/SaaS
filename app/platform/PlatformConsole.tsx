"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SAMPLE_PLACEMENTS, analyzePlacements, money, summarizePlatform } from "@/lib/platform-engine.mjs";
import { createPipelineReportCsv, parsePlatformInput } from "@/platform/input.mjs";

const tabs = ["Overview", "Attribution", "Optimizer", "Policy", "Connectors"] as const;
type Tab = (typeof tabs)[number];

const defaultModules = [
  ["01", "Traffic Ingestion", "LIVE", "1.34M events"],
  ["02", "Postback Hub", "LIVE", "787 accepted"],
  ["03", "IVT Guard", "LIVE", "2 sources paused"],
  ["04", "Attribution", "BETA", "$6.44K revenue"],
  ["05", "Spend Optimizer", "ACTIVE", "6 decisions"],
  ["06", "DSP Connectors", "ROADMAP", "3 adapters planned"],
] as const;

const connectors = [
  ["DV360", "Planned", "Roadmap", "Campaign stats + approved actions"],
  ["Google Ads", "Planned", "Roadmap", "Conversions + spend"],
  ["Taboola", "Planned", "Roadmap", "Native inventory + approved actions"],
  ["OpenRTB export", "Available", "Built-in", "Logs + decision export"],
] as const;

const apiTraffic = {
  site_domain: "publisher.example", page_domain: "publisher.example", schain_nodes: 2, seller_id: "seller-101",
  user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", device_os: "Windows", requests_per_minute: 40,
  duplicate_rate: 0.01, ip_country: "US", declared_country: "US", connection_type: "residential",
};

const apiRiskTraffic = {
  ...apiTraffic, site_domain: "declared.example", page_domain: "spoofed.example", schain_nodes: 0, seller_id: "",
  requests_per_minute: 180, duplicate_rate: 0.2, ip_country: "NL", connection_type: "datacenter",
};

const API_DEMO_PAYLOAD = {
  connector: "openrtb",
  events: [
    { id: "demo-safe-imp", type: "impression", timestamp: "2026-08-08T10:00:00Z", campaign_id: "cmp-demo", placement_id: "plc-safe", source_id: "src-a", cost: 20, ...apiTraffic },
    { id: "demo-safe-click", type: "click", timestamp: "2026-08-08T10:01:00Z", campaign_id: "cmp-demo", placement_id: "plc-safe", source_id: "src-a", click_id: "clk-safe", cost: 20, ...apiTraffic },
    { id: "demo-risk-imp", type: "impression", timestamp: "2026-08-08T10:02:00Z", campaign_id: "cmp-demo", placement_id: "plc-risk", source_id: "src-b", cost: 30, ...apiRiskTraffic },
    { id: "demo-risk-click", type: "click", timestamp: "2026-08-08T10:03:00Z", campaign_id: "cmp-demo", placement_id: "plc-risk", source_id: "src-b", click_id: "clk-risk", cost: 30, ...apiRiskTraffic },
  ],
  postbacks: [
    { id: "demo-pb-safe", click_id: "clk-safe", campaign_id: "cmp-demo", timestamp: "2026-08-08T11:00:00Z", revenue: 100, currency: "USD" },
    { id: "demo-pb-risk", click_id: "clk-risk", campaign_id: "cmp-demo", timestamp: "2026-08-08T11:10:00Z", revenue: 10, currency: "USD" },
  ],
};

type PlatformPayload = { connector: string; events: Array<Record<string, unknown>>; postbacks: Array<Record<string, unknown>> };
type DecisionPolicy = { attributionWindowDays: number; pauseIvtScore: number; watchIvtScore: number; pauseRoasBelow: number; watchRoasBelow: number; scaleRoasAtLeast: number; minSpend: number; scaleBidPercent: number; executionMode: "shadow" | "approval" };
type NumericPolicyKey = Exclude<keyof DecisionPolicy, "executionMode">;
const DEFAULT_POLICY: DecisionPolicy = { attributionWindowDays: 7, pauseIvtScore: 60, watchIvtScore: 30, pauseRoasBelow: 0.65, watchRoasBelow: 1, scaleRoasAtLeast: 1.5, minSpend: 10, scaleBidPercent: 15, executionMode: "shadow" };
type PipelineDecision = { campaignId: string; placementId: string; sourceId: string; currency?: string; impressions: number; clicks: number; spend: number; revenue: number; conversions: number; roas: number; cpa: number | null; ivtScore: number; decision: string; reason: string };
type AnalyzedPlacement = { id: string; name: string; connector: string; channel: string; spend: number; revenue: number; conversions: number; cpa: number; roas: number; ivtScore: number; decision: string; reason: string };
type PipelineResult = {
  runId?: string;
  generatedAt: string;
  policy: DecisionPolicy;
  modules: {
    ingestion: { accepted: number; rejected: number; duplicates: number };
    postbacks: { accepted: number; rejected: number; duplicates: number };
    attribution: { attributed: number; unattributed: number; matchRate: number };
    ivt: { scored: number; riskyPlacements: number };
    optimizer: { decisions: number; actionable: number };
    connector: { id: string; mode: string };
  };
  summary: { currency?: string; spend: number; revenue: number; roas: number; conversions: number };
  decisions: PipelineDecision[];
  actions: Array<{ id: string; action: string; mode: string; placementId: string }>;
};
type Project = { id: string; name: string; createdAt: string; updatedAt: string };
type PipelineRun = { id: string; projectId: string; sourceName: string; connector: string; status: string; eventCount: number; postbackCount: number; acceptedEvents: number; attributedConversions: number; shadowActions: number; createdAt: string };
type UploadJob = { id: string; fileName: string; sizeBytes: number; status: "queued" | "processing" | "complete" | "failed"; processedRows: number; totalRows: number; errorCount: number; errors: Array<{ kind: string; row: number | null; message: string }>; runId: string | null };
type PlatformAccess = { authenticated: boolean; email: string | null; plan: "demo" | "trial" | "pro" | "enterprise"; status: string; trialEndsAt: string | null; mustChangePassword: boolean; canUsePaidFeatures: boolean; isLocalDevelopment: boolean; role: "anonymous" | "member" | "manager" | "admin"; limits: { rowsPerRun: number; rowsPerMonth: number; uploadBytesPerMonth: number }; usage: { processedRows: number; uploadBytes: number; runCount: number } };

export default function PlatformConsole({ embedded = false }: { embedded?: boolean }) {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [pipelineState, setPipelineState] = useState<"idle" | "running" | "complete" | "error">("idle");
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);
  const [resultSource, setResultSource] = useState("");
  const [resultConnector, setResultConnector] = useState("openrtb");
  const [pipelinePayload, setPipelinePayload] = useState<PlatformPayload>(API_DEMO_PAYLOAD);
  const [dataSource, setDataSource] = useState("Built-in synthetic dataset");
  const [inputError, setInputError] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [runHistory, setRunHistory] = useState<PipelineRun[]>([]);
  const [historyState, setHistoryState] = useState<"loading" | "ready" | "error">("loading");
  const [uploadJob, setUploadJob] = useState<UploadJob | null>(null);
  const [policy, setPolicy] = useState<DecisionPolicy>(DEFAULT_POLICY);
  const [policyState, setPolicyState] = useState<"loading" | "ready" | "dirty" | "saving" | "saved" | "error">("loading");
  const [access, setAccess] = useState<PlatformAccess | null>(null);
  const canUsePaidFeatures = access?.canUsePaidFeatures === true;
  const placements = useMemo(() => analyzePlacements(SAMPLE_PLACEMENTS) as AnalyzedPlacement[], []);
  const summary = useMemo(() => summarizePlatform(SAMPLE_PLACEMENTS), []);
  const visiblePlacements = useMemo(() => pipelineResult ? pipelineResult.decisions.map((decision) => ({
    ...decision,
    id: decision.placementId,
    name: decision.placementId,
    connector: resultConnector.toUpperCase(),
    channel: decision.campaignId,
  })) : placements, [pipelineResult, placements, resultConnector]);
  const visibleSummary = useMemo(() => {
    if (!pipelineResult) return summary;
    const counts = (decision: string) => pipelineResult.decisions.filter((item) => item.decision === decision).length;
    return {
      ...summary,
      spend: pipelineResult.summary.spend,
      revenue: pipelineResult.summary.revenue,
      roas: pipelineResult.summary.roas,
      conversions: pipelineResult.summary.conversions,
      acceptedPostbacks: pipelineResult.modules.postbacks.accepted,
      duplicates: pipelineResult.modules.postbacks.duplicates,
      pause: counts("PAUSE"),
      watch: counts("WATCH"),
      scale: counts("SCALE"),
      atRiskSpend: pipelineResult.decisions.filter((item) => item.decision === "PAUSE" || item.decision === "WATCH").reduce((total, item) => total + item.spend, 0),
    };
  }, [pipelineResult, summary]);
  const visibleCurrency = pipelineResult?.summary.currency ?? "USD";
  const moduleRows = useMemo(() => pipelineResult ? [
    ["01", "Traffic Ingestion", "LIVE", `${pipelineResult.modules.ingestion.accepted} accepted`],
    ["02", "Postback Hub", "LIVE", `${pipelineResult.modules.postbacks.accepted} accepted`],
    ["03", "IVT Guard", "LIVE", `${pipelineResult.modules.ivt.riskyPlacements} risky sources`],
    ["04", "Attribution", "LIVE", `${pipelineResult.modules.attribution.attributed} attributed`],
    ["05", "Spend Optimizer", "ACTIVE", `${pipelineResult.modules.optimizer.decisions} decisions`],
    ["06", "Decision Export", "AVAILABLE", `${pipelineResult.modules.connector.id} · ${pipelineResult.modules.connector.mode}`],
  ] as const : defaultModules, [pipelineResult]);

  async function fetchRunHistory(projectId: string) {
    const response = await fetch(`/api/platform/runs?projectId=${encodeURIComponent(projectId)}`);
    const body = await response.json() as { runs?: PipelineRun[]; error?: string };
    if (!response.ok) throw new Error(body.error ?? "Run history could not be loaded.");
    return body.runs ?? [];
  }

  async function fetchProjectPolicy(projectId: string) {
    const response = await fetch(`/api/platform/policy?projectId=${encodeURIComponent(projectId)}`);
    const body = await response.json() as { policy?: DecisionPolicy; error?: string };
    if (!response.ok || !body.policy) throw new Error(body.error ?? "Policy could not be loaded.");
    return body.policy;
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const accessResponse = await fetch("/api/platform/access");
        const accessBody = await accessResponse.json() as { access?: PlatformAccess };
        if (!accessResponse.ok || !accessBody.access) throw new Error("Access state could not be loaded.");
        if (!active) return;
        if (accessBody.access.mustChangePassword) {
          window.location.replace("/account/security?returnTo=%2Fplatform");
          return;
        }
        setAccess(accessBody.access);
        if (!accessBody.access.canUsePaidFeatures) {
          setHistoryState("ready");
          setPolicyState("ready");
          return;
        }
        const response = await fetch("/api/platform/projects");
        const body = await response.json() as { projects?: Project[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "Projects could not be loaded.");
        if (!active) return;
        const nextProjects = body.projects ?? [];
        setProjects(nextProjects);
        setActiveProjectId((current) => current || nextProjects[0]?.id || "");
        setHistoryState("ready");
      } catch {
        if (active) setHistoryState("error");
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!activeProjectId) return;
    let active = true;
    void (async () => {
      try {
        const runs = await fetchRunHistory(activeProjectId);
        if (!active) return;
        setRunHistory(runs);
        setHistoryState("ready");
      } catch {
        if (active) setHistoryState("error");
      }
    })();
    return () => { active = false; };
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) return;
    let active = true;
    void (async () => {
      try {
        const nextPolicy = await fetchProjectPolicy(activeProjectId);
        if (!active) return;
        setPolicy(nextPolicy);
        setPolicyState("ready");
      } catch {
        if (active) setPolicyState("error");
      }
    })();
    return () => { active = false; };
  }, [activeProjectId]);

  async function runApiPipeline() {
    setPipelineState("running");
    try {
      const response = canUsePaidFeatures ? await fetch("/api/platform/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...pipelinePayload, projectId: activeProjectId || undefined, sourceName: dataSource }),
        }) : await fetch("/api/platform/demo", { method: "POST" });
      const result = await response.json() as PipelineResult & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Pipeline request failed.");
      setPipelineResult(result);
      setResultSource(canUsePaidFeatures ? dataSource : "Public fixed synthetic dataset");
      setResultConnector(canUsePaidFeatures ? pipelinePayload.connector : "openrtb");
      setPipelineState("complete");
      if (canUsePaidFeatures && activeProjectId) setRunHistory(await fetchRunHistory(activeProjectId));
    } catch {
      setPipelineResult(null);
      setPipelineState("error");
    }
  }

  async function createWorkspace() {
    const name = newProjectName.trim();
    if (!name) return;
    setHistoryState("loading");
    try {
      const response = await fetch("/api/platform/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await response.json() as { project?: Project; error?: string };
      if (!response.ok || !body.project) throw new Error(body.error ?? "Project could not be created.");
      setProjects((current) => [body.project as Project, ...current]);
      setActiveProjectId(body.project.id);
      setNewProjectName("");
      setRunHistory([]);
      setHistoryState("ready");
    } catch {
      setHistoryState("error");
    }
  }

  function updatePolicyNumber(key: NumericPolicyKey, value: string) {
    setPolicy((current) => ({ ...current, [key]: Number(value) }));
    setPolicyState("dirty");
  }

  async function savePolicy() {
    if (!activeProjectId) return;
    setPolicyState("saving");
    try {
      const response = await fetch("/api/platform/policy", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: activeProjectId, policy }),
      });
      const body = await response.json() as { policy?: DecisionPolicy; error?: string };
      if (!response.ok || !body.policy) throw new Error(body.error ?? "Policy could not be saved.");
      setPolicy(body.policy);
      setPolicyState("saved");
    } catch {
      setPolicyState("error");
    }
  }

  async function openSavedRun(id: string) {
    setPipelineState("running");
    try {
      const response = await fetch(`/api/platform/runs/${encodeURIComponent(id)}`);
      const body = await response.json() as { run?: PipelineRun & { result: PipelineResult }; error?: string };
      if (!response.ok || !body.run) throw new Error(body.error ?? "Saved run could not be opened.");
      setPipelineResult({ ...body.run.result, runId: body.run.id });
      setResultSource(body.run.sourceName);
      setResultConnector(body.run.connector);
      setPipelineState("complete");
    } catch {
      setPipelineState("error");
    }
  }

  async function queueUploadedFile(file: File) {
    if (!activeProjectId) {
      setInputError("Select a project before uploading a large file.");
      return;
    }
    setInputError("");
    setPipelineState("running");
    setUploadJob({ id: "pending", fileName: file.name, sizeBytes: file.size, status: "queued", processedRows: 0, totalRows: 0, errorCount: 0, errors: [], runId: null });
    try {
      const queuedResponse = await fetch("/api/platform/uploads", {
        method: "POST",
        headers: {
          "content-type": file.type || "text/plain",
          "x-project-id": activeProjectId,
          "x-file-name": encodeURIComponent(file.name),
          "x-connector": pipelinePayload.connector,
        },
        body: file,
      });
      const queuedBody = await queuedResponse.json() as { job?: UploadJob; error?: string };
      if (!queuedResponse.ok || !queuedBody.job) throw new Error(queuedBody.error ?? "The upload could not be queued.");
      setUploadJob({ ...queuedBody.job, status: "processing" });

      const processResponse = await fetch(`/api/platform/uploads/${encodeURIComponent(queuedBody.job.id)}/process`, { method: "POST" });
      const processBody = await processResponse.json() as { job?: UploadJob; run?: PipelineRun & { result: PipelineResult }; error?: string };
      if (processBody.job) setUploadJob(processBody.job);
      if (!processResponse.ok || !processBody.job || !processBody.run) throw new Error(processBody.error ?? "The uploaded file could not be processed.");

      setPipelineResult({ ...processBody.run.result, runId: processBody.run.id });
      setResultSource(file.name);
      setResultConnector(processBody.run.connector);
      setDataSource(file.name);
      setPipelineState("complete");
      setRunHistory(await fetchRunHistory(activeProjectId));
    } catch (error) {
      setInputError(error instanceof Error ? error.message : "The upload could not be processed.");
      setPipelineState("error");
      setUploadJob((current) => current ? { ...current, status: "failed" } : null);
    }
  }

  async function loadDataFile(file: File | undefined) {
    if (!file) return;
    if (!canUsePaidFeatures) {
      setInputError("Real-data uploads require an active trial or paid workspace.");
      return;
    }
    setInputError("");
    if (file.size > 25 * 1024 * 1024) {
      setInputError("Uploads are limited to 25 MB in this pilot.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      await queueUploadedFile(file);
      return;
    }
    try {
      const payload = parsePlatformInput(await file.text(), file.name);
      setPipelinePayload(payload);
      setDataSource(file.name);
      setPipelineResult(null);
      setResultSource("");
      setUploadJob(null);
      setPipelineState("idle");
    } catch (error) {
      setInputError(error instanceof Error ? error.message : "The file could not be parsed.");
    }
  }

  function resetDataSource() {
    setPipelinePayload(API_DEMO_PAYLOAD);
    setDataSource("Built-in synthetic dataset");
    setInputError("");
    setPipelineResult(null);
    setResultSource("");
    setUploadJob(null);
    setPipelineState("idle");
  }

  function exportPipelineReport() {
    if (!pipelineResult) return;
    const blob = new Blob([createPipelineReportCsv(pipelineResult)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "verdict-pipeline-report.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function customerSignOut() {
    await fetch("/api/customer-auth/logout", { method: "POST" });
    window.location.replace("/platform");
  }

  const Root = embedded ? "section" : "main";

  return (
    <Root className={`platform-page${embedded ? " platform-embed" : ""}`} aria-label={embedded ? "Interactive Verdict platform dashboard" : undefined}>
      {!embedded ? <header className="platform-topbar">
        <div className="platform-shell platform-nav">
          <Link className="platform-brand" href="/" aria-label="Verdict home"><span>V</span><b>Verdict</b></Link>
          <div className="platform-product"><i /> ADTECH CONTROL PLANE <small>{canUsePaidFeatures ? `${access?.plan.toUpperCase()} WORKSPACE` : "PUBLIC DEMO"}</small></div>
          <div className="platform-nav-actions"><Link href="/lab">IVT Lab</Link>{access?.role === "admin" ? <Link href="/admin">Admin</Link> : null}{access?.role === "anonymous" ? <Link href="/login?returnTo=%2Fplatform">Sign in</Link> : null}{access && (access.role === "member" || access.role === "manager") ? <button type="button" onClick={() => void customerSignOut()}>Sign out</button> : null}<a href="https://adminez.sh/" target="_blank" rel="noreferrer">Request pilot ↗</a></div>
        </div>
      </header> : null}

      <div className={`platform-shell platform-layout${embedded ? " platform-layout-embedded" : ""}`}>
        <aside className="module-rail" aria-label="Platform modules">
          <p>Platform modules</p>
          {moduleRows.map(([number, title, status, metric]) => (
            <article key={number}>
              <span>{number}</span>
              <div><b>{title}</b><small>{metric}</small></div>
              <i className={status === "BETA" || status === "ROADMAP" ? "status-watch" : ""}>{status}</i>
            </article>
          ))}
          <div className="module-rail-note"><span>Pipeline status</span><b><i /> Operational</b><small>Last refresh: just now</small></div>
        </aside>

        <section className="console-main">
          <div className="console-heading">
            <div><p>ADTECH CONTROL PLANE</p><h1>Unified campaign control</h1><span>{canUsePaidFeatures ? "Your private workspace across ingestion, attribution, traffic quality, and media buying." : "A fixed synthetic showcase. Real data and saved operations require an active workspace."}</span></div>
            <button type="button" className={pipelineState === "complete" ? "is-queued" : ""} disabled={pipelineState === "running"} onClick={runApiPipeline}>{pipelineState === "running" ? "Running server pipeline…" : pipelineState === "complete" ? "Pipeline complete ✓" : canUsePaidFeatures ? "Run API pipeline →" : "Run public demo →"}</button>
          </div>

          <div className="console-tabs" role="tablist" aria-label="Platform views">
            {tabs.map((tab) => <button type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)} key={tab}>{tab}</button>)}
          </div>

          {canUsePaidFeatures ? <div className="workspace-bar">
            <div className="workspace-select">
              <span>ACTIVE PROJECT</span>
              <select aria-label="Active project" value={activeProjectId} onChange={(event) => { setHistoryState("loading"); setPolicyState("loading"); setActiveProjectId(event.target.value); }} disabled={projects.length === 0}>
                {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
              </select>
            </div>
            <div className="workspace-create">
              <input aria-label="New project name" maxLength={80} value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createWorkspace(); }} placeholder="New project name" />
              <button type="button" onClick={() => void createWorkspace()} disabled={!newProjectName.trim()}>Create project</button>
            </div>
            <small className={`workspace-state state-${historyState}`}>{historyState === "loading" ? "SYNCING" : historyState === "error" ? "STORAGE ERROR" : "HISTORY READY"}</small>
          </div> : access ? <section className={`platform-paywall${embedded ? " paywall-embedded" : ""}`}>
            <div><span>PUBLIC SHOWCASE</span><b>Real-data operations are a paid feature.</b><p>The demo uses a fixed server-side dataset. Uploads, projects, history, policies, exports, and API ingestion require an active trial or paid plan.</p></div>
            {!embedded ? <div className="paywall-actions"><a href="/signin-with-chatgpt?return_to=%2Fplatform">Start 14-day trial</a><a href="https://adminez.sh/" target="_blank" rel="noreferrer">Request Pro access ↗</a></div> : null}
          </section> : null}

          {canUsePaidFeatures ? <div className="data-input-bar">
            <div className="data-source-summary"><span>DATA SOURCE</span><b>{dataSource}</b><small>Up to 2 MB parses locally · larger files use the secure job queue</small></div>
            <div className="data-counts"><span>Events <b>{pipelinePayload.events.length}</b></span><span>Postbacks <b>{pipelinePayload.postbacks.length}</b></span></div>
            <div className="data-input-actions">
              <label><input type="file" accept=".json,.jsonl,.ndjson,.csv,application/json,text/csv" onChange={(event) => void loadDataFile(event.target.files?.[0])} />Load JSON / CSV · 25 MB</label>
              {dataSource !== "Built-in synthetic dataset" ? <button type="button" onClick={resetDataSource}>Reset sample</button> : null}
              {pipelineState === "complete" && pipelineResult ? <button type="button" onClick={exportPipelineReport}>Export CSV</button> : null}
            </div>
          </div> : <div className="public-demo-source"><div><span>LOCKED DATA SOURCE</span><b>Fixed synthetic OpenRTB sample</b><small>Real client data cannot be submitted in public demo mode.</small></div><div className="data-counts"><span>Events <b>4</b></span><span>Postbacks <b>2</b></span></div></div>}
          {inputError ? <div className="data-input-error" role="alert">{inputError}</div> : null}
          {uploadJob ? <section className={`upload-job-card upload-${uploadJob.status}`} aria-live="polite">
            <div className="upload-job-head"><div><span>UPLOAD JOB</span><b>{uploadJob.fileName}</b><small>{(uploadJob.sizeBytes / 1024 / 1024).toFixed(2)} MB · {uploadJob.id === "pending" ? "allocating job" : uploadJob.id}</small></div><strong>{uploadJob.status.toUpperCase()}</strong></div>
            <div className="upload-progress"><i style={{ width: uploadJob.status === "queued" ? "18%" : uploadJob.status === "processing" ? "62%" : "100%" }} /></div>
            <div className="upload-job-meta"><span>Rows <b>{uploadJob.processedRows}{uploadJob.totalRows ? ` / ${uploadJob.totalRows}` : ""}</b></span><span>Diagnostics <b>{uploadJob.errorCount}</b></span>{uploadJob.runId ? <Link href={`/platform/run/${uploadJob.runId}`}>Open detailed result →</Link> : null}</div>
            {uploadJob.errors.length > 0 ? <div className="upload-error-preview">{uploadJob.errors.slice(0, 3).map((error, index) => <span key={`${error.kind}-${error.row}-${index}`}><b>{error.kind}{error.row ? ` · row ${error.row}` : ""}</b>{error.message}</span>)}</div> : null}
          </section> : null}

          {pipelineState !== "idle" ? <div className={`api-run-status api-${pipelineState}`} aria-live="polite">
            {pipelineState === "running" ? <span>Processing ingestion, postbacks, attribution, IVT, optimizer, and connector actions…</span> : null}
            {pipelineState === "error" ? <span>The local API pipeline could not complete. Refresh the preview and try again.</span> : null}
            {pipelineState === "complete" && pipelineResult ? <><b>Live pipeline result</b><span>Source <strong>{resultSource}</strong></span><span>Events accepted <strong>{pipelineResult.modules.ingestion.accepted}</strong></span><span>Conversions attributed <strong>{pipelineResult.modules.attribution.attributed}</strong></span><span>Shadow actions <strong>{pipelineResult.modules.optimizer.actionable}</strong></span><span>Mode <strong>{pipelineResult.modules.connector.mode}</strong></span></> : null}
          </div> : null}

          {canUsePaidFeatures ? <section className="run-history-card" aria-label="Recent pipeline runs">
            <div className="console-card-title"><div><b>Run history</b><span>Latest saved analyses in this project</span></div><small>{runHistory.length} SAVED RUNS</small></div>
            {runHistory.length > 0 ? <div className="run-history-list">
              {runHistory.slice(0, 6).map((run) => <div className="run-history-row" key={run.id}>
                <button type="button" onClick={() => void openSavedRun(run.id)}>
                  <span className="run-source"><b>{run.sourceName}</b><small>{new Date(run.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</small></span>
                  <span><small>EVENTS</small><b>{run.acceptedEvents}/{run.eventCount}</b></span>
                  <span><small>CONVERSIONS</small><b>{run.attributedConversions}</b></span>
                  <span><small>SHADOW ACTIONS</small><b>{run.shadowActions}</b></span>
                  <i>Open →</i>
                </button>
                <Link href={`/platform/run/${run.id}`}>Details ↗</Link>
              </div>)}
            </div> : <div className="run-history-empty"><b>No runs saved yet.</b><span>Load a file or use the synthetic dataset, then run the API pipeline.</span></div>}
          </section> : null}

          {activeTab === "Overview" ? (
            <>
              <div className="platform-metrics">
                <article><span>Media spend</span><strong>{money(visibleSummary.spend, visibleCurrency)}</strong><small>{pipelineResult ? `processed input · ${visibleCurrency}` : "synthetic period"}</small></article>
                <article><span>Attributed revenue</span><strong>{money(visibleSummary.revenue, visibleCurrency)}</strong><small>postback matched</small></article>
                <article><span>Blended ROAS</span><strong>{visibleSummary.roas.toFixed(2)}x</strong><small className="metric-positive">calculated live</small></article>
                <article><span>Conversions</span><strong>{visibleSummary.conversions}</strong><small>{visibleSummary.acceptedPostbacks} accepted postbacks</small></article>
                <article><span>At-risk spend</span><strong>{money(visibleSummary.atRiskSpend, visibleCurrency)}</strong><small className="metric-risk">review before action</small></article>
              </div>

              <div className="pipeline-card">
                <div className="console-card-title"><div><b>Live decision pipeline</b><span>From event to buying action</span></div><small><i /> ALL SERVICES HEALTHY</small></div>
                <div className="pipeline-flow">
                  <article><span>01</span><b>Ingest</b><small>{pipelineResult ? `${pipelineResult.modules.ingestion.accepted} events` : "1.34M events"}</small></article><i>→</i>
                  <article><span>02</span><b>Validate</b><small>{pipelineResult ? `${pipelineResult.modules.ingestion.rejected + pipelineResult.modules.ingestion.duplicates} flagged` : "53 duplicates"}</small></article><i>→</i>
                  <article><span>03</span><b>Attribute</b><small>{pipelineResult ? `${pipelineResult.modules.attribution.attributed} conversions` : "787 conversions"}</small></article><i>→</i>
                  <article><span>04</span><b>Score</b><small>{pipelineResult ? `${pipelineResult.modules.ivt.scored} scored` : "IVT + ROAS"}</small></article><i>→</i>
                  <article><span>05</span><b>Act</b><small>{pipelineResult ? `${pipelineResult.modules.optimizer.actionable} queued` : "6 decisions"}</small></article>
                </div>
              </div>
            </>
          ) : null}

          {activeTab === "Attribution" ? (
            <div className="tab-intro"><div><p>POSTBACK + ATTRIBUTION</p><h2>Every conversion tied back to spend.</h2></div><div><span>Accepted <b>{visibleSummary.acceptedPostbacks}</b></span><span>Duplicates <b>{visibleSummary.duplicates}</b></span><span>Match rate <b>{pipelineResult ? `${(pipelineResult.modules.attribution.matchRate * 100).toFixed(1)}%` : "93.7%"}</b></span></div></div>
          ) : null}

          {activeTab === "Optimizer" ? (
            <div className="tab-intro"><div><p>DECISION ENGINE</p><h2>Profit and traffic quality in one rule set.</h2></div><div><span>Scale <b>{visibleSummary.scale}</b></span><span>Watch <b>{visibleSummary.watch}</b></span><span>Pause <b>{visibleSummary.pause}</b></span></div></div>
          ) : null}

          {activeTab === "Policy" ? (
            <section className="policy-editor-card">
              <div className="policy-editor-head"><div><p>PROJECT DECISION POLICY</p><h2>Control when the platform watches, pauses, or scales.</h2><span>Rules are versioned inside every result. Execution remains shadow or approval-only.</span></div><div><small className={`policy-state policy-${policyState}`}>{policyState.toUpperCase()}</small><button type="button" onClick={() => void savePolicy()} disabled={policyState === "saving" || !activeProjectId}>{policyState === "saving" ? "Saving…" : "Save project policy"}</button></div></div>
              <fieldset className="policy-editor-fields" disabled={!canUsePaidFeatures}>
              <div className="policy-fields">
                <label><span>Attribution window <small>days</small></span><input type="number" min="1" max="90" step="1" value={policy.attributionWindowDays} onChange={(event) => updatePolicyNumber("attributionWindowDays", event.target.value)} /></label>
                <label><span>Minimum spend <small>batch currency</small></span><input type="number" min="0" step="1" value={policy.minSpend} onChange={(event) => updatePolicyNumber("minSpend", event.target.value)} /></label>
                <label><span>WATCH IVT <small>score</small></span><input type="number" min="0" max="99" step="1" value={policy.watchIvtScore} onChange={(event) => updatePolicyNumber("watchIvtScore", event.target.value)} /></label>
                <label><span>PAUSE IVT <small>score</small></span><input type="number" min="1" max="100" step="1" value={policy.pauseIvtScore} onChange={(event) => updatePolicyNumber("pauseIvtScore", event.target.value)} /></label>
                <label><span>PAUSE below ROAS <small>x</small></span><input type="number" min="0" step="0.05" value={policy.pauseRoasBelow} onChange={(event) => updatePolicyNumber("pauseRoasBelow", event.target.value)} /></label>
                <label><span>WATCH below ROAS <small>x</small></span><input type="number" min="0" step="0.05" value={policy.watchRoasBelow} onChange={(event) => updatePolicyNumber("watchRoasBelow", event.target.value)} /></label>
                <label><span>SCALE from ROAS <small>x</small></span><input type="number" min="0.01" step="0.05" value={policy.scaleRoasAtLeast} onChange={(event) => updatePolicyNumber("scaleRoasAtLeast", event.target.value)} /></label>
                <label><span>Scale bid increase <small>%</small></span><input type="number" min="1" max="100" step="1" value={policy.scaleBidPercent} onChange={(event) => updatePolicyNumber("scaleBidPercent", event.target.value)} /></label>
              </div>
              <div className="policy-mode-row"><div><span>EXECUTION MODE</span><b>No direct autonomous writes</b><small>Shadow records recommendations. Approval prepares connector actions for a human review.</small></div><select value={policy.executionMode} onChange={(event) => { setPolicy((current) => ({ ...current, executionMode: event.target.value === "approval" ? "approval" : "shadow" })); setPolicyState("dirty"); }}><option value="shadow">Shadow only</option><option value="approval">Approval queue</option></select></div>
              </fieldset>
              {policyState === "error" ? <div className="policy-error">Check the thresholds: WATCH IVT must be below PAUSE, PAUSE ROAS must not exceed WATCH, and SCALE must be above WATCH.</div> : null}
            </section>
          ) : null}

          {activeTab === "Connectors" ? (
            <div className="connector-grid">
              {connectors.map(([name, status, phase, scope]) => <article key={name}><div><span>{name.slice(0, 2).toUpperCase()}</span><b>{name}</b></div><i className={status === "Planned" ? "connector-review" : ""}>{status}</i><p>{scope}</p><small>Status · {phase}</small></article>)}
            </div>
          ) : null}

          {activeTab !== "Connectors" && activeTab !== "Policy" ? (
            <div className="placement-card">
              <div className="console-card-title"><div><b>{activeTab === "Optimizer" ? "Decision queue" : activeTab === "Attribution" ? "Attributed performance" : "Source performance"}</b><span>Six synthetic placements</span></div><small>{visibleCurrency} · CURRENT PERIOD</small></div>
              <div className="placement-table-wrap">
                <table className="placement-table">
                  <thead><tr><th>Placement</th><th>Spend</th><th>Revenue</th><th>Conv.</th><th>CPA</th><th>ROAS</th><th>IVT</th><th>Decision</th></tr></thead>
                  <tbody>{visiblePlacements.map((placement) => (
                    <tr key={placement.id}>
                      <td><b>{placement.name}</b><small>{placement.connector} · {placement.channel}</small></td>
                      <td>{money(placement.spend, visibleCurrency)}</td><td>{money(placement.revenue, visibleCurrency)}</td><td>{placement.conversions}</td><td>{placement.cpa === null ? "—" : money(placement.cpa, visibleCurrency)}</td><td><b>{placement.roas.toFixed(2)}x</b></td><td>{placement.ivtScore}</td>
                      <td><span className={`optimizer-action action-${placement.decision.toLowerCase()}`}>{placement.decision}</span><small>{placement.reason}</small></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </Root>
  );
}
