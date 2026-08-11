import { listSampleAuditLeads } from "./leads.ts";
import { telegramNotificationsConfigured } from "./notifications.mjs";
import { getAdminSession } from "./auth.mjs";
import { AdminDataError, createAdminAccount, getAdminOverview, listAdminAccounts, resetAdminAccountPassword, updateAdminAccount } from "./admin-data.ts";

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-3ve4-admin": "v1" },
  });
}

function values(value) {
  return new Set(String(value ?? "").split(/[\s,;]+/).map((item) => item.trim().toLowerCase()).filter(Boolean));
}

async function readAdminJson(request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) throw new AdminDataError("Content-Type must be application/json.", 415, "INVALID_CONTENT_TYPE");
  const contentLength = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
  if (contentLength > 16_384) throw new AdminDataError("Admin request is too large.", 413, "PAYLOAD_TOO_LARGE");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 16_384) throw new AdminDataError("Admin request is too large.", 413, "PAYLOAD_TOO_LARGE");
  try { return JSON.parse(raw); } catch { throw new AdminDataError("Request body must be valid JSON.", 400, "INVALID_JSON"); }
}

export async function authorizeAdminRequest(request, env = {}) {
  const session = await getAdminSession(request, env);
  if (session) return { allowed: true, status: 200, email: session.email, username: session.username };
  const userId = request.headers.get("oai-authenticated-user-id")?.trim() ?? "";
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  if (!userId || !email) return { allowed: false, status: 401, error: "Sign in with ChatGPT to open the lead inbox." };
  const allowedEmails = values(env.ADMIN_EMAILS);
  const allowedUserIds = values(env.ADMIN_USER_IDS);
  if (allowedEmails.size === 0 && allowedUserIds.size === 0) return { allowed: false, status: 503, error: "The admin allowlist is not configured." };
  if (!allowedEmails.has(email) && !allowedUserIds.has(userId.toLowerCase())) return { allowed: false, status: 403, error: "This account does not have lead-inbox access." };
  return { allowed: true, status: 200, email };
}

export async function handleAdminApi(request, database, env = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/admin")) return null;
  const access = await authorizeAdminRequest(request, env);
  if (!access.allowed) return json({ error: access.error, code: access.status === 401 ? "AUTH_REQUIRED" : "ADMIN_REQUIRED" }, access.status);
  try {
    if (url.pathname === "/api/admin/overview" && request.method === "GET") {
      return json({ overview: await getAdminOverview(database, env), viewer: { email: access.email, username: access.username ?? null } });
    }
    if (url.pathname === "/api/admin/accounts" && request.method === "GET") {
      const limit = Number.parseInt(url.searchParams.get("limit") ?? "100", 10);
      return json({ accounts: await listAdminAccounts(database, limit), viewer: { email: access.email, username: access.username ?? null } });
    }
    if (url.pathname === "/api/admin/accounts" && request.method === "POST") {
      const created = await createAdminAccount(database, await readAdminJson(request));
      return json({ ...created, viewer: { email: access.email, username: access.username ?? null } }, 201);
    }
    const resetMatch = url.pathname.match(/^\/api\/admin\/accounts\/([^/]+)\/reset-password$/u);
    if (resetMatch && request.method === "POST") {
      const reset = await resetAdminAccountPassword(database, decodeURIComponent(resetMatch[1]));
      return json({ ...reset, viewer: { email: access.email, username: access.username ?? null } });
    }
    const accountMatch = url.pathname.match(/^\/api\/admin\/accounts\/([^/]+)$/u);
    if (accountMatch && request.method === "PATCH") {
      const account = await updateAdminAccount(database, decodeURIComponent(accountMatch[1]), await readAdminJson(request));
      return json({ account, viewer: { email: access.email, username: access.username ?? null } });
    }
    if (url.pathname === "/api/admin/leads" && request.method === "GET") {
      const limit = Number.parseInt(url.searchParams.get("limit") ?? "100", 10);
      const leads = await listSampleAuditLeads(database, limit);
      return json({
        leads,
        viewer: { email: access.email },
        integrations: { telegram: telegramNotificationsConfigured(env) },
      });
    }
    return json({ error: "Route not found or method not allowed.", code: "ADMIN_ROUTE_NOT_FOUND" }, 405);
  } catch (error) {
    if (error instanceof AdminDataError) return json({ error: error.message, code: error.code }, error.status);
    console.error("Admin API failure", error);
    return json({ error: "The admin control center could not complete this request.", code: "ADMIN_REQUEST_FAILED" }, 500);
  }
}
