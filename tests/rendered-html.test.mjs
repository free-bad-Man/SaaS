import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/", init = {}, env = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`https://3ve4.example${pathname}`, { ...init, headers: { accept: "text/html", host: "3ve4.example", "x-forwarded-host": "3ve4.example", "x-forwarded-proto": "https", ...(init.headers ?? {}) } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) }, ...env },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the complete 3VE.4 platform landing", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>3VE\.4 — unified AdTech control plane<\/title>/);
  assert.doesNotMatch(html, /programmatic operations/i);
  assert.match(html, /See why traffic was rejected/);
  assert.match(html, /Run free sample audit/);
  assert.match(html, /Upload a small sample/);
  assert.match(html, /Work email/);
  assert.match(html, /no raw-file storage/);
  assert.match(html, /Traffic Ingestion/);
  assert.match(html, /Postback Hub/);
  assert.match(html, /IVT Guard/);
  assert.match(html, /Five working modules/);
  assert.match(html, /Interactive 3VE\.4 platform dashboard/);
  assert.match(html, /PUBLIC API DEMO/);
  assert.doesNotMatch(html, /Cloud or on-premise|connectors healthy|SYNCED · 4 platforms/i);
  assert.doesNotMatch(html, /platform-dashboard\.png/);
  assert.match(html, /Spend Optimizer/);
  assert.match(html, /DSP Connectors/);
  assert.match(html, /from \$1,500/);
  assert.match(html, /from \$5,000/);
  assert.match(html, /\$1,550/);
  assert.doesNotMatch(html, /₽|RUB/);
  assert.match(html, /https:\/\/adminez\.sh\//);
  assert.doesNotMatch(html, /freelance\.ru|darkPulsar|https:\/\/www\.fl\.ru\//i);
  assert.match(html, /https:\/\/github\.com\/free-bad-Man\/SaaS/);
  assert.match(html, /href="\/platform"/);
  assert.match(html, /href="\/lab"/);
  assert.match(html, /https:\/\/3ve4\.example\/og\.png/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|codex-preview/i);
});

test("server-renders the unified interactive platform console", async () => {
  const response = await render("/platform");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>3VE\.4 Platform Console — unified AdTech control plane<\/title>/);
  assert.doesNotMatch(html, /programmatic operations/i);
  assert.match(html, /Unified campaign control/);
  assert.match(html, /Live decision pipeline/);
  assert.match(html, /Run public demo/);
  assert.match(html, /LOCKED DATA SOURCE/);
  assert.doesNotMatch(html, /ACTIVE PROJECT|Run history/);
  assert.match(html, /Display Alpha/);
  assert.match(html, /\$2,570/);
});

test("server-renders the standalone IVT Guard lab", async () => {
  const response = await render("/lab");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>IVT Guard Lab — live traffic audit demo<\/title>/);
  assert.match(html, /Audit an advertising log locally/);
  assert.match(html, /Upload a small JSON or CSV file/);
  assert.match(html, /Run sample/);
  assert.match(html, /Seven transparent checks/);
  assert.match(html, /synthetic-openrtb-sample\.json/);
});

test("server-renders the pipeline run detail route", async () => {
  const response = await render("/platform/run/sample-run");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Pipeline run .* 3VE\.4 Platform<\/title>/);
  assert.match(html, /Loading pipeline result/);
});

test("redirects anonymous admin traffic to the sign-in screen", async () => {
  for (const path of ["/admin", "/admin/leads"]) {
    const response = await render(path);
    assert.equal(response.status, 302);
    assert.match(response.headers.get("location") ?? "", /^https:\/\/3ve4\.example\/admin\/login\?returnTo=/);
  }
});

test("server-renders the protected admin control center", async () => {
  const response = await render("/admin", { headers: { "oai-authenticated-user-id": "owner-id", "oai-authenticated-user-email": "owner@example.com" } }, { ADMIN_EMAILS: "owner@example.com" });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Admin Control Center — 3VE\.4<\/title>/);
  assert.match(html, /Admin control center/);
  assert.match(html, /Customer accounts/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
});

test("server-renders the private admin sign-in shell", async () => {
  const response = await render("/admin/login");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Admin Sign In — 3VE\.4<\/title>/);
  assert.match(html, /Operator access/);
  assert.match(html, /PRIVATE CONTROL PLANE/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
});

test("keeps the final site free of starter preview artifacts", async () => {
  const [page, platform, lab, layout, styles, cursorTheme, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/platform/PlatformConsole.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lab/AuditLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/cursor-theme.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /3VE\.4/);
  assert.match(page, /Standalone service/);
  assert.match(platform, /summarizePlatform/);
  assert.match(platform, /Run API pipeline/);
  assert.match(platform, /embedded/);
  assert.match(lab, /parseInput/);
  assert.match(lab, /createReportCsv/);
  assert.match(layout, /generateMetadata/);
  assert.match(layout, /cursor-theme\.css/);
  assert.match(styles, /family=IBM\+Plex\+Mono/);
  assert.match(styles, /family=IBM\+Plex\+Serif/);
  assert.match(styles, /--font-serif: "IBM Plex Serif"/);
  assert.match(styles, /--font-mono: "IBM Plex Mono"/);
  assert.match(cursorTheme, /color-scheme: dark/);
  assert.match(cursorTheme, /--violet-glow:/);
  assert.match(cursorTheme, /background: #151513; border: 1px solid #403b62/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview/preview.css", import.meta.url)));
});
