import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`https://3ve4.example${pathname}`, { headers: { accept: "text/html", host: "3ve4.example", "x-forwarded-host": "3ve4.example", "x-forwarded-proto": "https" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the complete 3VE.4 platform landing", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>3VE\.4 — unified programmatic operations platform<\/title>/);
  assert.match(html, /Run the whole media loop/);
  assert.match(html, /Traffic Ingestion/);
  assert.match(html, /Postback Hub/);
  assert.match(html, /IVT Guard/);
  assert.match(html, /All six modules/);
  assert.match(html, /Interactive 3VE\.4 platform dashboard/);
  assert.match(html, /LIVE API WORKSPACE/);
  assert.doesNotMatch(html, /platform-dashboard\.png/);
  assert.match(html, /Spend Optimizer/);
  assert.match(html, /DSP Connectors/);
  assert.match(html, /from \$1,500/);
  assert.match(html, /from \$5,000/);
  assert.match(html, /\$1,550/);
  assert.doesNotMatch(html, /₽|RUB/);
  assert.match(html, /https:\/\/freelance\.ru\/darkPulsar/);
  assert.doesNotMatch(html, /https:\/\/www\.fl\.ru\//);
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
  assert.match(html, /<title>3VE\.4 Platform Console — unified AdTech operations demo<\/title>/);
  assert.match(html, /Unified campaign control/);
  assert.match(html, /Live decision pipeline/);
  assert.match(html, /Run API pipeline/);
  assert.match(html, /ACTIVE PROJECT/);
  assert.match(html, /Run history/);
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
