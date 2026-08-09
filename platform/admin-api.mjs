import { listSampleAuditLeads } from "./leads.ts";
import { telegramNotificationsConfigured } from "./notifications.mjs";

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-3ve4-admin": "v1" },
  });
}

function values(value) {
  return new Set(String(value ?? "").split(/[\s,;]+/).map((item) => item.trim().toLowerCase()).filter(Boolean));
}

export function authorizeAdminRequest(request, env = {}) {
  const hostname = new URL(request.url).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") return { allowed: true, status: 200, email: "owner@local.3ve4" };
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
  const access = authorizeAdminRequest(request, env);
  if (!access.allowed) return json({ error: access.error, code: access.status === 401 ? "AUTH_REQUIRED" : "ADMIN_REQUIRED" }, access.status);
  if (url.pathname !== "/api/admin/leads" || request.method !== "GET") return json({ error: "Route not found or method not allowed." }, 405);
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "100", 10);
  const leads = await listSampleAuditLeads(database, limit);
  return json({
    leads,
    viewer: { email: access.email },
    integrations: { telegram: telegramNotificationsConfigured(env) },
  });
}
