import { createPasswordHash, verifyPassword } from "./auth.mjs";
import { enforceRateLimit, RateLimitError } from "./rate-limit.ts";

const COOKIE_NAME = "3ve4_customer";
const SESSION_TTL_SECONDS = 24 * 60 * 60;
const MAX_BODY_BYTES = 16 * 1024;
const encoder = new TextEncoder();

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

function cookieValue(request, name) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return "";
}

function requestIsSecure(request) {
  return request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https" || new URL(request.url).protocol === "https:";
}

function signingSecret(env) {
  const source = String(env?.ADMIN_SESSION_SECRET ?? "").trim();
  return source.length >= 32 ? `${source}:customer-session:v1` : "";
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

async function createSessionToken(secret, userId, sessionVersion) {
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({ kind: "customer", sub: userId, ver: sessionVersion, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS, v: 1 })));
  return `${payload}.${bytesToBase64Url(await hmac(secret, payload))}`;
}

async function verifySessionToken(secret, token) {
  const [payload, signature, ...rest] = String(token).split(".");
  if (!payload || !signature || rest.length) return null;
  try {
    const expected = await hmac(secret, payload);
    if (!constantTimeEqual(expected, base64UrlToBytes(signature))) return null;
    const session = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
    if (session?.v !== 1 || session?.kind !== "customer" || typeof session?.sub !== "string" || !Number.isInteger(session?.ver) || !Number.isFinite(session?.exp) || session.exp <= Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

function setCookieHeader(request, token) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}${requestIsSecure(request) ? "; Secure" : ""}`;
}

function clearCookieHeader(request) {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${requestIsSecure(request) ? "; Secure" : ""}`;
}

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-3ve4-customer-auth": "v1", ...headers } });
}

function normalizeEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) ? email : "";
}

async function readJson(request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) throw new CustomerAuthError("Content-Type must be application/json.", 415, "INVALID_CONTENT_TYPE");
  const declared = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
  if (declared > MAX_BODY_BYTES) throw new CustomerAuthError("Request body is too large.", 413, "PAYLOAD_TOO_LARGE");
  const raw = await request.text();
  if (encoder.encode(raw).byteLength > MAX_BODY_BYTES) throw new CustomerAuthError("Request body is too large.", 413, "PAYLOAD_TOO_LARGE");
  try { return JSON.parse(raw); } catch { throw new CustomerAuthError("Request body must be valid JSON.", 400, "INVALID_JSON"); }
}

function publicViewer(session) {
  return {
    userId: session.userId,
    email: session.email,
    role: session.role,
    plan: session.plan,
    status: session.status,
    trialEndsAt: session.trialEndsAt,
    mustChangePassword: session.mustChangePassword,
    lastLoginAt: session.lastLoginAt,
    expiresAt: session.expiresAt,
  };
}

class CustomerAuthError extends Error {
  constructor(message, status = 400, code = "CUSTOMER_AUTH_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const DUMMY_HASH_KEY = Symbol.for("3ve4.customerAuthDummyHash");
function dummyPasswordHash() {
  const root = globalThis;
  root[DUMMY_HASH_KEY] ??= createPasswordHash("3VE4-invalid-customer-password!9");
  return root[DUMMY_HASH_KEY];
}

export async function getCustomerSession(request, database, env = {}) {
  const secret = signingSecret(env);
  if (!database || !secret) return null;
  const token = await verifySessionToken(secret, cookieValue(request, COOKIE_NAME));
  if (!token) return null;
  const row = await database.prepare(
    `SELECT a.user_id, a.email, a.role, a.plan, a.status, a.trial_ends_at,
      c.must_change_password, c.session_version, c.last_login_at
     FROM accounts a JOIN customer_credentials c ON c.account_user_id = a.user_id
     WHERE a.user_id = ?`,
  ).bind(token.sub).first();
  if (!row || Number(row.session_version) !== token.ver || row.status === "suspended") return null;
  return {
    userId: row.user_id,
    email: row.email,
    role: row.role,
    plan: row.plan,
    status: row.status,
    trialEndsAt: row.trial_ends_at,
    mustChangePassword: Boolean(row.must_change_password),
    sessionVersion: Number(row.session_version),
    lastLoginAt: row.last_login_at,
    expiresAt: new Date(token.exp * 1000).toISOString(),
  };
}

function validateNewPassword(password) {
  if (typeof password !== "string" || password.length < 14 || password.length > 128) throw new CustomerAuthError("Use at least 14 characters.", 400, "WEAK_PASSWORD");
  if (!/[a-z]/u.test(password) || !/[A-Z]/u.test(password) || !/[0-9]/u.test(password) || !/[^A-Za-z0-9]/u.test(password)) throw new CustomerAuthError("Password must include uppercase, lowercase, number, and symbol.", 400, "WEAK_PASSWORD");
}

export async function handleCustomerAuthApi(request, database, env = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/customer-auth/")) return null;
  const secret = signingSecret(env);
  if (!database || !secret) return json({ error: "Customer authentication is not configured.", code: "AUTH_NOT_CONFIGURED" }, 503);

  try {
    if (url.pathname === "/api/customer-auth/session" && request.method === "GET") {
      const session = await getCustomerSession(request, database, env);
      return json({ authenticated: Boolean(session), configured: true, viewer: session ? publicViewer(session) : null });
    }

    if (url.pathname === "/api/customer-auth/login" && request.method === "POST") {
      await enforceRateLimit(database, request, { scope: "customer-login", limit: 8, windowMs: 15 * 60 * 1000 });
      const body = await readJson(request);
      const email = normalizeEmail(body?.email);
      const password = String(body?.password ?? "");
      const row = email ? await database.prepare(
        `SELECT a.user_id, a.email, a.role, a.plan, a.status, a.trial_ends_at,
          c.password_hash, c.must_change_password, c.session_version, c.last_login_at
         FROM customer_credentials c JOIN accounts a ON a.user_id = c.account_user_id
         WHERE c.email_normalized = ?`,
      ).bind(email).first() : null;
      const accepted = await verifyPassword(password, row?.password_hash ?? await dummyPasswordHash());
      if (!row || !accepted) throw new CustomerAuthError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
      if (row.status === "suspended") throw new CustomerAuthError("This workspace has been suspended. Contact support.", 403, "ACCOUNT_SUSPENDED");
      const now = new Date().toISOString();
      await database.prepare("UPDATE customer_credentials SET last_login_at = ?, updated_at = ? WHERE account_user_id = ?").bind(now, now, row.user_id).run();
      const session = {
        userId: row.user_id, email: row.email, role: row.role, plan: row.plan, status: row.status,
        trialEndsAt: row.trial_ends_at, mustChangePassword: Boolean(row.must_change_password),
        sessionVersion: Number(row.session_version), lastLoginAt: now,
        expiresAt: new Date((Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS) * 1000).toISOString(),
      };
      const token = await createSessionToken(secret, session.userId, session.sessionVersion);
      return json({ authenticated: true, viewer: publicViewer(session) }, 200, { "set-cookie": setCookieHeader(request, token) });
    }

    if (url.pathname === "/api/customer-auth/password" && request.method === "POST") {
      await enforceRateLimit(database, request, { scope: "customer-password", limit: 10, windowMs: 15 * 60 * 1000 });
      const session = await getCustomerSession(request, database, env);
      if (!session) throw new CustomerAuthError("Sign in again to change your password.", 401, "AUTH_REQUIRED");
      const body = await readJson(request);
      const currentPassword = String(body?.currentPassword ?? "");
      const newPassword = String(body?.newPassword ?? "");
      validateNewPassword(newPassword);
      if (currentPassword === newPassword) throw new CustomerAuthError("Choose a password different from the temporary password.", 400, "PASSWORD_UNCHANGED");
      const credential = await database.prepare("SELECT password_hash FROM customer_credentials WHERE account_user_id = ?").bind(session.userId).first();
      if (!credential || !(await verifyPassword(currentPassword, credential.password_hash))) throw new CustomerAuthError("Current password is incorrect.", 401, "INVALID_CREDENTIALS");
      const passwordHash = await createPasswordHash(newPassword);
      const now = new Date().toISOString();
      const nextVersion = session.sessionVersion + 1;
      await database.prepare("UPDATE customer_credentials SET password_hash = ?, must_change_password = 0, session_version = ?, updated_at = ? WHERE account_user_id = ?")
        .bind(passwordHash, nextVersion, now, session.userId).run();
      const updated = { ...session, mustChangePassword: false, sessionVersion: nextVersion, expiresAt: new Date((Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS) * 1000).toISOString() };
      const token = await createSessionToken(secret, session.userId, nextVersion);
      return json({ authenticated: true, viewer: publicViewer(updated) }, 200, { "set-cookie": setCookieHeader(request, token) });
    }

    if (url.pathname === "/api/customer-auth/logout" && request.method === "POST") {
      return json({ authenticated: false }, 200, { "set-cookie": clearCookieHeader(request) });
    }

    return json({ error: "Route not found or method not allowed.", code: "CUSTOMER_AUTH_ROUTE_NOT_FOUND" }, 405);
  } catch (error) {
    if (error instanceof RateLimitError) return json({ error: error.message, code: "RATE_LIMITED" }, 429, { "retry-after": String(error.retryAfter) });
    if (error instanceof CustomerAuthError) return json({ error: error.message, code: error.code }, error.status);
    console.error("Customer authentication failure", error);
    return json({ error: "Customer authentication is temporarily unavailable.", code: "CUSTOMER_AUTH_FAILED" }, 500);
  }
}
