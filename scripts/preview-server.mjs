import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import worker from "../dist/server/index.js";

const host = process.env.PREVIEW_HOST ?? "127.0.0.1";
const port = Number(process.env.PREVIEW_PORT ?? 3000);
const assetRoot = path.resolve("dist/client");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".woff2", "font/woff2"],
]);

async function fetchAsset(request) {
  const pathname = decodeURIComponent(new URL(request.url).pathname);
  const filePath = path.resolve(assetRoot, `.${pathname}`);
  if (filePath !== assetRoot && !filePath.startsWith(`${assetRoot}${path.sep}`)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const body = await readFile(filePath);
    const contentType = contentTypes.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
    return new Response(body, { headers: { "content-type": contentType } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

const environment = { ASSETS: { fetch: fetchAsset } };
const context = { waitUntil() {}, passThroughOnException() {} };

createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url ?? "/", `http://${incoming.headers.host ?? `${host}:${port}`}`);
    const method = incoming.method ?? "GET";
    const chunks = [];
    if (method !== "GET" && method !== "HEAD") {
      for await (const chunk of incoming) chunks.push(chunk);
    }
    const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
    const request = new Request(url, { method, headers: incoming.headers, body });
    const assetResponse = await fetchAsset(request);
    const response = assetResponse.status === 404
      ? await worker.fetch(request, environment, context)
      : assetResponse;
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    outgoing.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    outgoing.end(error instanceof Error ? error.message : "Preview server error");
  }
}).listen(port, host, () => {
  console.log(`IVT Guard preview: http://${host}:${port}`);
});
