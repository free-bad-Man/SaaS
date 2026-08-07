import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("https://ivt-guard.example/", {
      headers: {
        accept: "text/html",
        host: "ivt-guard.example",
        "x-forwarded-host": "ivt-guard.example",
        "x-forwarded-proto": "https",
      },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the IVT Guard commercial landing", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ru">/);
  assert.match(html, /<title>IVT Guard — аудит качества рекламного трафика<\/title>/);
  assert.match(html, /Платите за рекламу/);
  assert.match(html, /Не за ботов/);
  assert.match(html, /Аудит одной кампании/);
  assert.match(html, /от 30 000 ₽/);
  assert.match(html, /синтетическ/i);
  assert.match(html, /https:\/\/www\.fl\.ru\/users\/ifreebadmani\//);
  assert.match(html, /https:\/\/github\.com\/free-bad-Man\/SaaS/);
  assert.match(html, /https:\/\/ivt-guard\.example\/og\.png/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|codex-preview/i);
});

test("keeps the final site free of starter preview artifacts", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /IVT GUARD/);
  assert.match(page, /Данные ниже синтетические/);
  assert.match(layout, /generateMetadata/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview/preview.css", import.meta.url)));
});
