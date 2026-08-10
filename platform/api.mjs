import { CONNECTORS } from "./connectors.mjs";
import { parsePlatformInput } from "./input.mjs";
import { runPlatformPipeline } from "./pipeline.mjs";
import { createProject, getPipelineRun, listPipelineRuns, listProjects, savePipelineRun } from "./history.ts";
import { getProjectPolicy, saveProjectPolicy } from "./policies.ts";
import { createUploadJob, getUploadJob, readUploadSource, updateUploadJob } from "./uploads.ts";
import { assertUsageAllowed, getPlatformAccess, recordUsage } from "./access.ts";
import { PUBLIC_DEMO_PAYLOAD } from "./demo.mjs";
import { enforceRateLimit, RateLimitError } from "./rate-limit.ts";

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-3ve4-api": "v1", ...extraHeaders },
  });
}

async function readJson(request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) throw new Error("Content-Type must be application/json.");
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) throw new Error("Request body exceeds 2 MB.");
  const source = await request.text();
  if (new TextEncoder().encode(source).byteLength > MAX_BODY_BYTES) throw new Error("Request body exceeds 2 MB.");
  if (!source.trim()) throw new Error("Request body is empty.");
  return JSON.parse(source);
}

function uploadErrors(result) {
  const rejectedEvents = result?.diagnostics?.rejectedEvents ?? [];
  const rejectedPostbacks = result?.diagnostics?.rejectedPostbacks ?? [];
  const duplicateEvents = result?.diagnostics?.duplicateEvents ?? [];
  const duplicatePostbacks = result?.diagnostics?.duplicatePostbacks ?? [];
  return [
    ...rejectedEvents.map((item) => ({ kind: "event", row: Number(item.index) + 1, message: item.error })),
    ...rejectedPostbacks.map((item) => ({ kind: "postback", row: Number(item.index) + 1, message: item.error })),
    ...duplicateEvents.map((id) => ({ kind: "duplicate event", row: null, message: `Duplicate event ${id} was skipped.` })),
    ...duplicatePostbacks.map((id) => ({ kind: "duplicate postback", row: null, message: `Duplicate postback ${id} was skipped.` })),
  ];
}

export async function handlePlatformApi(request, database, storage, env = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/platform")) return null;

  try {
    const isPublicDemo = url.pathname === "/api/platform/demo" && request.method === "POST";
    await enforceRateLimit(database, request, {
      scope: isPublicDemo ? "public-demo" : request.method === "GET" ? "platform-read" : "platform-write",
      limit: isPublicDemo ? 10 : request.method === "GET" ? 240 : 60,
    });
    if (url.pathname === "/api/platform/health" && request.method === "GET") {
      return json({ status: "operational", version: "3ve4.pipeline.v1", modules: ["ingestion", "postbacks", "attribution", "ivt", "optimizer", "connectors"] });
    }
    if (url.pathname === "/api/platform/connectors" && request.method === "GET") return json({ connectors: CONNECTORS });
    if (url.pathname === "/api/platform/access" && request.method === "GET") return json({ access: await getPlatformAccess(database, request, env) });
    if (url.pathname === "/api/platform/demo" && request.method === "POST") return json({ ...runPlatformPipeline(PUBLIC_DEMO_PAYLOAD), demo: true });

    const access = await getPlatformAccess(database, request, env);
    if (!access.canUsePaidFeatures || !access.userId) {
      return json({ error: access.authenticated ? "An active plan is required." : "Sign in to use real data.", code: access.authenticated ? "PLAN_REQUIRED" : "AUTH_REQUIRED", access }, access.authenticated ? 402 : 401);
    }
    const ownerUserId = access.userId;

    if (url.pathname === "/api/platform/projects" && request.method === "GET") return json({ projects: await listProjects(database, ownerUserId) });
    if (url.pathname === "/api/platform/projects" && request.method === "POST") {
      const input = await readJson(request);
      return json({ project: await createProject(database, String(input?.name ?? ""), ownerUserId) }, 201);
    }
    if (url.pathname === "/api/platform/policy" && request.method === "GET") {
      const projectId = url.searchParams.get("projectId") ?? "";
      if (!(await listProjects(database, ownerUserId)).some((project) => project.id === projectId)) throw new Error("Project not found.");
      return json({ policy: await getProjectPolicy(database, projectId) });
    }
    if (url.pathname === "/api/platform/policy" && request.method === "PUT") {
      const input = await readJson(request);
      const projectId = String(input?.projectId ?? "");
      if (!(await listProjects(database, ownerUserId)).some((project) => project.id === projectId)) throw new Error("Project not found.");
      return json({ policy: await saveProjectPolicy(database, projectId, input?.policy ?? {}) });
    }
    if (url.pathname === "/api/platform/runs" && request.method === "GET") {
      return json({ runs: await listPipelineRuns(database, url.searchParams.get("projectId") ?? "", ownerUserId) });
    }
    if (url.pathname === "/api/platform/uploads" && request.method === "POST") {
      const projectId = request.headers.get("x-project-id") ?? "";
      const projects = await listProjects(database, ownerUserId);
      if (!projects.some((project) => project.id === projectId)) throw new Error("Project not found.");
      const declaredLength = Number(request.headers.get("content-length") ?? 0);
      if (declaredLength > MAX_UPLOAD_BYTES) throw new Error("Upload exceeds 25 MB.");
      const source = await request.text();
      const sizeBytes = new TextEncoder().encode(source).byteLength;
      if (sizeBytes > MAX_UPLOAD_BYTES) throw new Error("Upload exceeds 25 MB.");
      if (!source.trim()) throw new Error("The uploaded file is empty.");
      assertUsageAllowed(access, 0, sizeBytes);
      const encodedName = request.headers.get("x-file-name") ?? "traffic-data.txt";
      let fileName = encodedName;
      try { fileName = decodeURIComponent(encodedName); } catch { fileName = "traffic-data.txt"; }
      const job = await createUploadJob(database, storage, {
        projectId,
        fileName,
        contentType: request.headers.get("content-type") ?? "text/plain",
        connector: request.headers.get("x-connector") ?? "openrtb",
        source,
        sizeBytes,
      });
      await recordUsage(database, ownerUserId, 0, sizeBytes, false);
      return json({ job }, 202);
    }
    const uploadMatch = url.pathname.match(/^\/api\/platform\/uploads\/([^/]+)$/);
    if (uploadMatch && request.method === "GET") {
      const job = await getUploadJob(database, decodeURIComponent(uploadMatch[1]));
      const ownsProject = job && (await listProjects(database, ownerUserId)).some((project) => project.id === job.projectId);
      return ownsProject ? json({ job }) : json({ error: "Upload job not found." }, 404);
    }
    const processMatch = url.pathname.match(/^\/api\/platform\/uploads\/([^/]+)\/process$/);
    if (processMatch && request.method === "POST") {
      const id = decodeURIComponent(processMatch[1]);
      const current = await getUploadJob(database, id);
      if (!current || !(await listProjects(database, ownerUserId)).some((project) => project.id === current.projectId)) return json({ error: "Upload job not found." }, 404);
      if (current.status === "complete" && current.runId) {
        return json({ job: current, run: await getPipelineRun(database, current.runId, ownerUserId) });
      }
      await updateUploadJob(database, id, { status: "processing" });
      try {
        const source = await readUploadSource(storage, current);
        const payload = parsePlatformInput(source, current.fileName);
        const rowCount = payload.events.length + payload.postbacks.length;
        assertUsageAllowed(access, rowCount, 0);
        const policy = await getProjectPolicy(database, current.projectId);
        const result = runPlatformPipeline({ ...payload, connector: current.connector, policy });
        const run = await savePipelineRun(database, {
          projectId: current.projectId,
          ownerUserId,
          sourceName: current.fileName,
          connector: current.connector,
          eventCount: payload.events.length,
          postbackCount: payload.postbacks.length,
          result,
        });
        await recordUsage(database, ownerUserId, rowCount);
        const errors = uploadErrors(result);
        const job = await updateUploadJob(database, id, {
          status: "complete",
          processedRows: payload.events.length + payload.postbacks.length,
          totalRows: payload.events.length + payload.postbacks.length,
          errorCount: errors.length,
          errors,
          runId: run.id,
        });
        return json({ job, run });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload processing failed.";
        const job = await updateUploadJob(database, id, { status: "failed", errorCount: 1, errors: [{ kind: "file", row: null, message }] });
        return json({ error: message, job }, 400);
      }
    }
    const runMatch = url.pathname.match(/^\/api\/platform\/runs\/([^/]+)$/);
    if (runMatch && request.method === "GET") {
      const run = await getPipelineRun(database, decodeURIComponent(runMatch[1]), ownerUserId);
      return run ? json({ run }) : json({ error: "Run not found." }, 404);
    }
    if (url.pathname === "/api/platform/run" && request.method === "POST") {
      const input = await readJson(request);
      if (!input?.projectId || !(await listProjects(database, ownerUserId)).some((project) => project.id === String(input.projectId))) throw new Error("A valid project is required.");
      const rowCount = (Array.isArray(input.events) ? input.events.length : 0) + (Array.isArray(input.postbacks) ? input.postbacks.length : 0);
      assertUsageAllowed(access, rowCount);
      const policy = await getProjectPolicy(database, String(input.projectId));
      const result = runPlatformPipeline({ ...input, policy });
      const run = await savePipelineRun(database, {
        projectId: String(input.projectId),
        ownerUserId,
        sourceName: String(input.sourceName ?? "API payload"),
        connector: String(input.connector ?? "openrtb"),
        eventCount: Array.isArray(input.events) ? input.events.length : 0,
        postbackCount: Array.isArray(input.postbacks) ? input.postbacks.length : 0,
        result,
      });
      await recordUsage(database, ownerUserId, rowCount);
      return json({ ...result, runId: run.id });
    }
    return json({ error: "Route not found or method not allowed." }, 405);
  } catch (error) {
    if (error instanceof RateLimitError) return json({ error: error.message, code: "RATE_LIMITED" }, 429, { "retry-after": String(error.retryAfter) });
    return json({ error: error instanceof Error ? error.message : "Platform API error." }, 400);
  }
}
