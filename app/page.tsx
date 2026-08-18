import Link from "next/link";
import PlatformConsole from "./platform/PlatformConsole";
import SampleAuditLead from "./SampleAuditLead";

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
  { number: "06", name: "DSP Connectors", status: "PLANNED", text: "Roadmap adapters for pulling reporting data and returning approved actions through platform-specific APIs.", meta: "DV360 · Google · Taboola roadmap" },
] as const;

const deliverables = [
  { number: "01", title: "Unified event layer", text: "One normalized data model across impressions, clicks, spend, conversions, and postbacks.", meta: "Ingestion · schema · quality" },
  { number: "02", title: "Explainable traffic control", text: "Every IVT flag and optimizer decision is tied to a rule, metric, and supporting evidence.", meta: "Rule · evidence · score" },
  { number: "03", title: "Campaign economics", text: "Source-level CPA, ROAS, revenue, and at-risk spend in a decision-ready workspace.", meta: "CPA · ROAS · attribution" },
  { number: "04", title: "Buying actions", text: "Reviewable scale, keep, watch, and pause queues for a safe shadow-mode rollout.", meta: "Queue · approval · API" },
] as const;

const steps = [
  ["Connect", "We map one event source, one conversion flow, and one buying platform into the Verdict data model."],
  ["Measure", "The platform validates traffic, attributes outcomes, and calculates source-level CPA, ROAS, and IVT risk."],
  ["Act", "Approved rules produce a transparent optimization queue before any automated buying action is enabled."],
] as const;

export default function Home() {
  return (
    <main id="top">
      <header className="nav-wrap">
        <nav className="nav shell" aria-label="Primary navigation">
          <a className="brand" href="#top" aria-label="Verdict — home">
            <span className="brand-mark" aria-hidden="true"><i /><i /></span>
            <span>Verdict</span>
          </a>
          <div className="nav-links">
            <Link href="/platform">Product</Link>
            <a href="#verification">Verification</a>
            <a href="#methodology">Methodology</a>
            <a href="#traffic-audit">Pricing</a>
          </div>
          <a className="nav-cta" href="#sample-audit">Analyze a sample <span aria-hidden="true">↓</span></a>
        </nav>
      </header>

      <section className="hero shell">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> ADTECH CONTROL PLANE</p>
          <h1>See why traffic was rejected.<br />And what it cost you.</h1>
          <p className="lead">Verdict turns advertising logs into reproducible traffic-quality, CPA, and ROAS decisions — with the reason and evidence attached to every flagged row.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#sample-audit">Analyze a small sample <span aria-hidden="true">→</span></a>
            <Link className="button button-secondary" href="/platform">Open platform console ↗</Link>
          </div>
          <div className="hero-notes" aria-label="Platform benefits"><span><i /> OpenRTB + postbacks</span><span><i /> Explainable decisions</span><span><i /> Cloud workspace</span></div>
        </div>

        <div className="product-frame" aria-label="Verdict control plane preview">
          <div className="frame-toolbar"><div className="window-dots" aria-hidden="true"><i /><i /><i /></div><span>Verdict control plane</span><span className="frame-status"><i /> Pipeline healthy</span></div>
          <div className="product-layout">
            <aside className="product-sidebar" aria-hidden="true"><span className="sidebar-brand"><b>V</b></span><span className="sidebar-active" /><span /><span /><span /></aside>
            <div className="product-content">
              <div className="product-head"><div><span>CAMPAIGN ORCHESTRATION</span><strong>portfolio-global</strong></div><code>5 live · connectors planned</code></div>
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
                    <li><i /><span>Connector adapters planned</span><b>3</b></li>
                  </ul>
                </section>
              </div>
              <div className="product-footer"><span>From event ingestion to buying action</span><b>One control plane</b></div>
            </div>
          </div>
        </div>
      </section>

      <section className="principles" aria-label="Platform assurance"><div className="shell principles-inner"><p>Working software.<br /><strong>Evidence before trust.</strong></p><div><span>Local browser lab</span><span>Deterministic rules</span><span>Evidence CSV export</span><span>No production access required</span></div></div></section>

      <SampleAuditLead />

      <section className="verification-section shell" id="verification" aria-labelledby="verification-title">
        <div className="verification-heading">
          <div><p className="section-label">Verify before you buy</p><h2 id="verification-title">You do not have to<br />trust a black box.</h2></div>
          <p>Use the exact synthetic fixture, run it entirely in your browser, and export the row-level result. The input, rules, scores, and evidence are available before any commercial engagement.</p>
        </div>

        <div className="verification-rail" aria-label="Reproducible verification workflow">
          <article><span>01</span><div><small>INPUT</small><h3>Download the fixture</h3><p>Six synthetic OpenRTB-style records with safe, inspectable fields.</p></div><a href="/samples/synthetic-openrtb-sample.json" download>JSON ↓</a></article>
          <article><span>02</span><div><small>PROCESS</small><h3>Run it locally</h3><p>The browser lab applies the same seven transparent checks without uploading the file.</p></div><Link href="/lab">Open lab ↗</Link></article>
          <article><span>03</span><div><small>OUTPUT</small><h3>Compare the evidence</h3><p>Review every score, decision, reason code, and evidence value in a ready export.</p></div><a href="/samples/synthetic-ivt-evidence.csv" download>CSV ↓</a></article>
        </div>

        <div className="trust-grid" id="methodology">
          <article className="trust-card methodology-card">
            <div className="trust-card-head"><span>METHOD / 01</span><i>REPRODUCIBLE</i></div>
            <h3>Rules that can be challenged.</h3>
            <p>Verdict is not presented as a magic fraud detector. The audit normalizes agreed fields, applies named checks, and attaches the exact evidence that affected each score.</p>
            <ol className="method-list">
              <li><span>01</span><div><b>Validate and normalize</b><small>Schema, types, domains, identifiers, and required fields.</small></div></li>
              <li><span>02</span><div><b>Score transparent signals</b><small>Seven deterministic checks with visible weights and thresholds.</small></div></li>
              <li><span>03</span><div><b>Review economic impact</b><small>At-risk spend is estimated only when usable cost data is present.</small></div></li>
              <li><span>04</span><div><b>Deliver evidence</b><small>Row-level CSV, prioritized findings, and an executive report.</small></div></li>
            </ol>
            <div className="threshold-code"><code>WATCH ≥ 30</code><code>BLOCK ≥ 60</code><span>Demo defaults · client policy is agreed before delivery</span></div>
          </article>

          <article className="trust-card security-card">
            <div className="trust-card-head"><span>DATA / 02</span><i>MINIMUM ACCESS</i></div>
            <h3>Smallest possible data boundary.</h3>
            <p>The first decision is what we do not need. A field list or anonymized rows are enough for feasibility; the audit does not require DSP credentials or production write access.</p>
            <ul className="security-list">
              <li><i>✓</i><div><b>Browser lab stays local</b><small>Your file never leaves the device.</small></div></li>
              <li><i>✓</i><div><b>Free server sample is discarded</b><small>Only contact, filename, fingerprint, and aggregate result are retained.</small></div></li>
              <li><i>✓</i><div><b>Workspace uploads are removed</b><small>Raw files are deleted after processing; exceptions require written agreement.</small></div></li>
              <li><i>✓</i><div><b>Shadow mode by default</b><small>No automatic blocking or buying action during validation.</small></div></li>
            </ul>
            <p className="security-note">Transfer method, retention, fields, deliverables, and acceptance criteria are fixed in writing before paid work begins.</p>
          </article>
        </div>
      </section>

      <section className="paid-audit-section shell" id="traffic-audit" aria-labelledby="traffic-audit-title">
        <div className="paid-audit-heading">
          <div><p className="section-label">Low-risk commercial path</p><h2 id="traffic-audit-title">Start small.<br />Expand on evidence.</h2></div>
          <p>First confirm the schema in writing. Then use a fixed-price micro-pilot before committing to a complete audit or platform integration.</p>
        </div>
        <div className="engagement-ladder">
          <article className="engagement-card engagement-card-primary">
            <div className="engagement-card-top"><span>01 · PAID MICRO-PILOT</span><i>48 HOURS</i></div>
            <h3>A real result on a deliberately small boundary.</h3>
            <p>One anonymized source, one agreed schema, and up to 200,000 rows. We return the exact artifacts defined before payment.</p>
            <ul><li>Schema and data-quality review</li><li>Risk distribution and top findings</li><li>Row-level evidence CSV</li><li>Compact written conclusion</li></ul>
            <div className="engagement-bottom"><div><strong>$250</strong><small>fixed scope · credited toward a full audit</small></div><a className="button button-primary" href="https://adminez.sh/" target="_blank" rel="noreferrer">Request micro-pilot ↗</a></div>
          </article>

          <article className="engagement-card">
            <div className="engagement-card-top"><span>02 · TRAFFIC WASTE AUDIT</span><i>3–5 BUSINESS DAYS</i></div>
            <h3>Decision-ready evidence from 7–30 days of traffic.</h3>
            <p>We validate the supplied log, score agreed traffic-quality signals, estimate at-risk spend when cost data is present, and return a prioritized action plan.</p>
            <ul><li>Up to 10M rows</li><li>Source and placement findings</li><li>Evidence CSV + executive PDF</li><li>Written handoff and recommendations</li></ul>
            <div className="engagement-bottom"><div><strong>from $750</strong><small>one source · one agreed schema</small></div><a className="button button-secondary" href="/reports/verdict-sample-traffic-waste-audit.pdf" target="_blank" rel="noreferrer">View sample report ↗</a></div>
          </article>
        </div>
        <div className="scope-assurance"><span><i>00</i><div><b>Free feasibility check</b><small>Send a field list or five anonymized rows. We confirm fit and scope in writing.</small></div></span><span><i>✓</i><div><b>Defined acceptance</b><small>You pay for agreed artifacts and acceptance criteria — never for a promise of guaranteed savings.</small></div></span></div>
        <p className="paid-audit-note">The downloadable report uses synthetic data. Real findings remain private to the client engagement.</p>
      </section>

      <section className="dashboard-proof shell" aria-labelledby="dashboard-proof-title">
        <div className="dashboard-proof-heading">
          <div><p className="section-label">Working platform</p><h2 id="dashboard-proof-title">Five working modules.<br />One connector roadmap.</h2></div>
          <div className="dashboard-proof-copy"><p>This is the running Verdict workspace, not a concept mockup. Ingestion, postbacks, IVT, attribution, and optimization operate as one decision pipeline; external DSP adapters are clearly marked as planned.</p><Link href="/platform">Open the interactive console →</Link></div>
        </div>
        <div className="dashboard-live-frame">
          <div className="dashboard-live-label"><span><i /> PUBLIC API DEMO</span><Link href="/platform">Open full console →</Link></div>
          <PlatformConsole embedded />
        </div>
      </section>

      <section className="module-section shell" id="modules">
        <div className="section-heading">
          <div><p className="section-label">Platform + services</p><h2>One platform.<br />Modular engagements.</h2></div>
          <p>Five modules already operate as one pipeline. Connector delivery is scoped as a paid integration engagement for the client’s actual buying stack.</p>
        </div>
        <div className="module-grid">
          {platformModules.map((module) => <article key={module.number}><div className="module-card-top"><span>{module.number}</span><i>{module.status}</i></div><h3>{module.name}</h3><p>{module.text}</p><small>{module.meta}</small><a className="module-service-link" href="https://adminez.sh/" target="_blank" rel="noreferrer">Request this module ↗</a></article>)}
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

      <section className="offer-section shell" id="offer"><div className="offer-card dual-offer-card"><div className="offer-main"><p className="section-label">Standalone service</p><h2>Start with one module</h2><p>Choose the immediate bottleneck: ingestion, postbacks, IVT, attribution, optimization, or a custom connector implementation.</p><strong className="standalone-price">from $1,500</strong><ul><li>Defined module boundary</li><li>One real data source</li><li>Working integration or report</li><li>Acceptance criteria and tests</li><li>Deployment documentation</li><li>Upgrade path to Verdict</li></ul><a className="button button-secondary module-offer-button" href="https://adminez.sh/" target="_blank" rel="noreferrer">Request a module ↗</a></div><div className="offer-price"><span>Complete platform pilot</span><strong>from $5,000</strong><p>One integrated campaign workspace from event ingestion to an explainable optimization queue.</p><ul className="platform-offer-list"><li>Ingestion + postbacks</li><li>IVT + attribution</li><li>CPA/ROAS workspace</li><li>Optimizer decision queue</li><li>One connector implementation</li><li>Handover and deployment docs</li></ul><a className="button button-light" href="https://adminez.sh/" target="_blank" rel="noreferrer">Request platform pilot ↗</a><small>Typical first rollout · 4–6 weeks</small></div></div></section>

      <section className="faq shell"><div><p className="section-label">FAQ</p><h2>Before<br />we connect</h2></div><div className="faq-list"><details open><summary>How can I verify the result?</summary><p>Every flagged row includes a score, reason code, and evidence value. The public browser lab exposes the same deterministic checks, and the paid scope defines the expected input and output artifacts before work begins.</p></details><details><summary>Does Verdict replace the DSP?</summary><p>No. It is an independent control layer above traffic, conversion, and buying systems. Existing platforms keep delivering media while Verdict normalizes data and coordinates decisions.</p></details><details><summary>Can the platform start without write access?</summary><p>Yes. The first rollout uses read-only data and shadow-mode decisions. API actions are enabled only after the rules and attribution logic have been validated.</p></details><details><summary>Can every module be purchased separately?</summary><p>Yes. Every module has a standalone scope, deliverable, and acceptance criteria. A completed module can later become part of the unified Verdict platform without rebuilding it from scratch.</p></details></div></section>

      <footer><div className="shell footer-inner"><div><a className="brand footer-brand" href="#top"><span className="brand-mark"><i /><i /></span><span>Verdict</span></a><p>Unified AdTech control plane.</p></div><div className="footer-links"><a href="https://github.com/free-bad-Man/SaaS" target="_blank" rel="noreferrer">GitHub ↗</a><a href="https://adminez.sh/" target="_blank" rel="noreferrer">adminez.sh ↗</a></div><span className="footer-note">Verdict AdTech Platform · 2026</span></div></footer>
    </main>
  );
}
