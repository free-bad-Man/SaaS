import Link from "next/link";
import PlatformConsole from "./platform/PlatformConsole";

const findings = [
  ["premium-publisher.example", "Domain mismatch", "BLOCK", "92"],
  ["seller-unknown / placement-31", "Broken supply chain", "BLOCK", "85"],
  ["video-feed-07", "Abnormal request velocity", "WATCH", "54"],
] as const;

const platformModules = [
  { number: "01", name: "Traffic Ingestion", status: "LIVE", text: "OpenRTB, event logs, postbacks, CSV, and API events enter one normalized stream.", meta: "OpenRTB · events · API" },
  { number: "02", name: "Postback Hub", status: "LIVE", text: "Receive, validate, deduplicate, and route conversions across campaigns and partners.", meta: "S2S · dedupe · routing" },
  { number: "03", name: "IVT Guard", status: "LIVE", text: "Score traffic quality with transparent rules and evidence before any production block.", meta: "IVT · evidence · shadow-mode" },
  { number: "04", name: "Attribution", status: "BETA", text: "Tie conversions and revenue back to sources, placements, campaigns, and media cost.", meta: "CPA · ROAS · revenue" },
  { number: "05", name: "Spend Optimizer", status: "ACTIVE", text: "Combine unit economics and IVT risk into explainable scale, watch, and pause decisions.", meta: "rules · alerts · actions" },
  { number: "06", name: "DSP Connectors", status: "SYNCED", text: "Pull reporting data and return approved actions through platform-specific APIs.", meta: "DV360 · Google · custom DSP" },
] as const;

const deliverables = [
  { number: "01", title: "Unified event layer", text: "One normalized data model across impressions, clicks, spend, conversions, and postbacks.", meta: "Ingestion · schema · quality" },
  { number: "02", title: "Explainable traffic control", text: "Every IVT flag and optimizer decision is tied to a rule, metric, and supporting evidence.", meta: "Rule · evidence · score" },
  { number: "03", title: "Campaign economics", text: "Source-level CPA, ROAS, revenue, and at-risk spend in a decision-ready workspace.", meta: "CPA · ROAS · attribution" },
  { number: "04", title: "Buying actions", text: "Reviewable scale, keep, watch, and pause queues for a safe shadow-mode rollout.", meta: "Queue · approval · API" },
] as const;

const steps = [
  ["Connect", "We map one event source, one conversion flow, and one buying platform into the 3VE.4 data model."],
  ["Measure", "The platform validates traffic, attributes outcomes, and calculates source-level CPA, ROAS, and IVT risk."],
  ["Act", "Approved rules produce a transparent optimization queue before any automated buying action is enabled."],
] as const;

export default function Home() {
  return (
    <main id="top">
      <header className="nav-wrap">
        <nav className="nav shell" aria-label="Primary navigation">
          <a className="brand" href="#top" aria-label="3VE.4 — home">
            <span className="brand-mark" aria-hidden="true"><i /><i /></span>
            <span>3VE.4</span>
          </a>
          <div className="nav-links">
            <Link href="/platform">Platform demo</Link>
            <a href="#modules">Modules</a>
            <a href="#offer">Pilot</a>
          </div>
          <a className="nav-cta" href="https://freelance.ru/darkPulsar" target="_blank" rel="noreferrer">Request a pilot <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <section className="hero shell">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> PROGRAMMATIC OPERATIONS PLATFORM</p>
          <h1>Run the whole media loop.<br />See every decision.</h1>
          <p className="lead">3VE.4 ingests advertising events, filters IVT, attributes conversions, measures CPA and ROAS, and returns explainable optimization decisions to buying platforms.</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/platform">Open platform console <span aria-hidden="true">→</span></Link>
            <a className="button button-secondary" href="https://freelance.ru/darkPulsar" target="_blank" rel="noreferrer">Request a pilot ↗</a>
          </div>
          <div className="hero-notes" aria-label="Platform benefits"><span><i /> OpenRTB + postbacks</span><span><i /> Explainable automation</span><span><i /> Cloud or on-premise</span></div>
        </div>

        <div className="product-frame" aria-label="3VE.4 control plane preview">
          <div className="frame-toolbar"><div className="window-dots" aria-hidden="true"><i /><i /><i /></div><span>3VE.4 control plane</span><span className="frame-status"><i /> Pipeline healthy</span></div>
          <div className="product-layout">
            <aside className="product-sidebar" aria-hidden="true"><span className="sidebar-brand"><b>3V</b></span><span className="sidebar-active" /><span /><span /><span /></aside>
            <div className="product-content">
              <div className="product-head"><div><span>CAMPAIGN ORCHESTRATION</span><strong>portfolio-global</strong></div><code>6 modules online</code></div>
              <div className="product-grid">
                <section className="risk-panel">
                  <span className="panel-label">Blended ROAS</span>
                  <div className="risk-value"><strong>1.84</strong><span>x</span></div>
                  <div className="risk-scale platform-scale"><i /></div>
                  <div className="decision"><span>Decision</span><b className="decision-scale">Scale</b></div>
                </section>
                <section className="reason-panel">
                  <div className="panel-title"><span>Control signals</span><small>current period</small></div>
                  <ul className="reason-list platform-signal-list">
                    <li><i /><span>Postbacks normalized</span><b>9,412</b></li>
                    <li><i /><span>Attributed conversions</span><b>787</b></li>
                    <li><i /><span>At-risk spend detected</span><b>$2,570</b></li>
                    <li><i /><span>DSP connectors healthy</span><b>4 / 4</b></li>
                  </ul>
                </section>
              </div>
              <div className="product-footer"><span>From event ingestion to buying action</span><b>One control plane</b></div>
            </div>
          </div>
        </div>
      </section>

      <section className="principles" aria-label="Platform principles"><div className="shell principles-inner"><p>One event stream.<br /><strong>Every decision connected.</strong></p><div><span>Traffic ingestion</span><span>Postback attribution</span><span>IVT quality scoring</span><span>DSP buying actions</span></div></div></section>

      <section className="dashboard-proof shell" aria-labelledby="dashboard-proof-title">
        <div className="dashboard-proof-heading">
          <div><p className="section-label">Working platform</p><h2 id="dashboard-proof-title">All six modules.<br />One live control plane.</h2></div>
          <div className="dashboard-proof-copy"><p>This is the running 3VE.4 workspace, not a concept mockup. The module rail shows ingestion, postbacks, IVT, attribution, optimization, and DSP connectors operating as one decision pipeline.</p><Link href="/platform">Open the interactive console →</Link></div>
        </div>
        <div className="dashboard-live-frame">
          <div className="dashboard-live-label"><span><i /> LIVE API WORKSPACE</span><Link href="/platform">Open full console →</Link></div>
          <PlatformConsole embedded />
        </div>
      </section>

      <section className="module-section shell" id="modules">
        <div className="section-heading">
          <div><p className="section-label">Platform + services</p><h2>One platform.<br />Six sellable services.</h2></div>
          <p>Each module works as a focused standalone engagement. Together they form the complete operating loop across traffic, conversions, economics, and buying actions.</p>
        </div>
        <div className="module-grid">
          {platformModules.map((module) => <article key={module.number}><div className="module-card-top"><span>{module.number}</span><i>{module.status}</i></div><h3>{module.name}</h3><p>{module.text}</p><small>{module.meta}</small><a className="module-service-link" href="https://freelance.ru/darkPulsar" target="_blank" rel="noreferrer">Request this module ↗</a></article>)}
        </div>
        <div className="module-action"><div><span>START WITH ONE OR COMBINE ALL SIX</span><b>Follow an event from ingestion to optimization.</b></div><Link className="button button-primary" href="/platform">Explore platform console →</Link></div>
      </section>

      <section className="demo-section shell" id="demo">
        <div className="section-heading">
          <div><p className="section-label">IVT Guard module</p><h2>See exactly where<br />media spend leaks.</h2></div>
          <p>The traffic-quality module contributes explainable risk signals to the same campaign decision engine used for CPA and ROAS optimization.</p>
        </div>
        <div className="audit-board">
          <div className="audit-topbar"><div><span className="mini-logo">IG</span><div><b>Traffic audit</b><small>August · synthetic sample</small></div></div><span className="audit-status"><i /> Analysis complete</span></div>
          <div className="metric-grid"><article><span>Requests processed</span><strong>2.0M</strong><small>100% of input file</small></article><article><span>Block decisions</span><strong>14.8%</strong><small className="danger">review required</small></article><article><span>Potential waste</span><strong>$1,550</strong><small>estimated from win price</small></article><article><span>At-risk placements</span><strong>31</strong><small>of 284 sources</small></article></div>
          <div className="audit-body">
            <div className="distribution-card"><div className="card-title"><b>Decision distribution</b><span>OpenRTB requests</span></div><div className="donut-row"><div className="donut" aria-label="Allow 76%, watch 9.2%, block 14.8%"><span>2.0M<small>requests</small></span></div><div className="donut-legend"><div><i className="allow" /><span>Allow</span><b>76.0%</b></div><div><i className="watch" /><span>Watch</span><b>9.2%</b></div><div><i className="block" /><span>Block</span><b>14.8%</b></div></div></div></div>
            <div className="finding-card"><div className="card-title"><b>Top findings</b><span>Risk score</span></div><div className="finding-table">{findings.map(([source, reason, action, score]) => <div className="finding-row" key={source}><div><b>{source}</b><span>{reason}</span></div><span className={`action action-${action.toLowerCase()}`}>{action}</span><strong>{score}</strong></div>)}</div></div>
          </div>
          <div className="audit-footer"><span>Input file fingerprinted</span><span>Decisions reproducible</span><span>Synthetic data</span><Link href="/lab">Open IVT Lab →</Link></div>
        </div>
      </section>

      <section className="deliverables shell"><div className="section-heading compact"><div><p className="section-label">Platform output</p><h2>From raw events<br />to approved action.</h2></div></div><div className="deliverable-grid">{deliverables.map((item) => <article key={item.number}><div className="deliverable-top"><span>{item.number}</span><small>{item.meta}</small></div><h3>{item.title}</h3><p>{item.text}</p></article>)}</div></section>

      <section className="process-section" id="process"><div className="shell process-grid"><div className="process-copy"><p className="section-label light">Commercial rollout</p><h2>Connect once.<br />Improve continuously.</h2><p>The first deployment covers a complete campaign loop, not an isolated report: events enter the platform, conversions are attributed, traffic is scored, and decisions reach an approval queue.</p></div><ol className="steps">{steps.map(([title, text], index) => <li key={title}><span>0{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></div></section>

      <section className="offer-section shell" id="offer"><div className="offer-card dual-offer-card"><div className="offer-main"><p className="section-label">Standalone service</p><h2>Start with one module</h2><p>Choose the immediate bottleneck: ingestion, postbacks, IVT, attribution, optimization, or a DSP connector.</p><strong className="standalone-price">from $1,500</strong><ul><li>Defined module boundary</li><li>One real data source</li><li>Working integration or report</li><li>Acceptance criteria and tests</li><li>Deployment documentation</li><li>Upgrade path to 3VE.4</li></ul><a className="button button-secondary module-offer-button" href="https://freelance.ru/darkPulsar" target="_blank" rel="noreferrer">Request a module ↗</a></div><div className="offer-price"><span>Complete platform pilot</span><strong>from $5,000</strong><p>One integrated campaign workspace from event ingestion to an explainable optimization queue.</p><ul className="platform-offer-list"><li>Ingestion + postbacks</li><li>IVT + attribution</li><li>CPA/ROAS workspace</li><li>Optimizer decision queue</li><li>One DSP connector</li><li>Handover and deployment docs</li></ul><a className="button button-light" href="https://freelance.ru/darkPulsar" target="_blank" rel="noreferrer">Request platform pilot ↗</a><small>Typical first rollout · 4–6 weeks</small></div></div></section>

      <section className="faq shell"><div><p className="section-label">FAQ</p><h2>Before<br />we connect</h2></div><div className="faq-list"><details open><summary>Does 3VE.4 replace the DSP?</summary><p>No. It is an independent control layer above traffic, conversion, and buying systems. Existing platforms keep delivering media while 3VE.4 normalizes data and coordinates decisions.</p></details><details><summary>Can the platform start without write access?</summary><p>Yes. The first rollout uses read-only data and shadow-mode decisions. API actions are enabled only after the rules and attribution logic have been validated.</p></details><details><summary>Can every module be purchased separately?</summary><p>Yes. Every module has a standalone scope, deliverable, and acceptance criteria. A completed module can later become part of the unified 3VE.4 platform without rebuilding it from scratch.</p></details></div></section>

      <footer><div className="shell footer-inner"><div><a className="brand footer-brand" href="#top"><span className="brand-mark"><i /><i /></span><span>3VE.4</span></a><p>Unified programmatic operations control.</p></div><div className="footer-links"><a href="https://github.com/free-bad-Man/SaaS" target="_blank" rel="noreferrer">GitHub ↗</a><a href="https://freelance.ru/darkPulsar" target="_blank" rel="noreferrer">Freelance.ru ↗</a></div><span className="footer-note">3VE.4 AdTech Platform · 2026</span></div></footer>
    </main>
  );
}
