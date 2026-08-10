const COOKIE_NAME = "3ve4_admin";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const PASSWORD_ITERATIONS = 210_000;
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

function envValue(env, key) {
  return String(env?.[key] ?? "").trim();
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

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function authConfiguration(env) {
  const username = envValue(env, "ADMIN_USERNAME");
  const passwordHash = envValue(env, "ADMIN_PASSWORD_HASH");
  const sessionSecret = envValue(env, "ADMIN_SESSION_SECRET");
  return {
    configured: Boolean(username && passwordHash && sessionSecret.length >= 32),
    username,
    email: envValue(env, "ADMIN_EMAIL") || `${username || "admin"}@local.3ve4`,
    passwordHash,
    sessionSecret,
  };
}

export async function createPasswordHash(password, salt = crypto.getRandomValues(new Uint8Array(16))) {
  if (typeof password !== "string" || password.length < 12) throw new Error("Admin password must contain at least 12 characters.");
  const source = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_ITERATIONS }, source, 256);
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(new Uint8Array(bits))}`;
}

async function verifyPassword(password, encoded) {
  const [algorithm, iterationsText, saltText, expectedText] = String(encoded).split("$");
  const iterations = Number.parseInt(iterationsText, 10);
  if (algorithm !== "pbkdf2-sha256" || iterations < 100_000 || !saltText || !expectedText) return false;
  try {
    const source = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: base64UrlToBytes(saltText), iterations }, source, 256);
    return constantTimeEqual(new Uint8Array(bits), base64UrlToBytes(expectedText));
  } catch {
    return false;
  }
}

async function createSessionToken(config) {
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({ sub: config.username, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS, v: 1 })));
  return `${payload}.${bytesToBase64Url(await hmac(config.sessionSecret, payload))}`;
}

export async function getAdminSession(request, env = {}) {
  const config = authConfiguration(env);
  if (!config.configured) return null;
  const token = cookieValue(request, COOKIE_NAME);
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length) return null;
  try {
    const expected = await hmac(config.sessionSecret, payload);
    if (!constantTimeEqual(expected, base64UrlToBytes(signature))) return null;
    const session = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
    if (session?.v !== 1 || session?.sub !== config.username || !Number.isFinite(session?.exp) || session.exp <= Math.floor(Date.now() / 1000)) return null;
    return { username: config.username, email: config.email, expiresAt: new Date(session.exp * 1000).toISOString() };
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
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
}

const ATTEMPTS_KEY = Symbol.for("3ve4.adminLoginAttempts");
function attemptsStore() {
  const root = globalThis;
  root[ATTEMPTS_KEY] ??= new Map();
  return root[ATTEMPTS_KEY];
}

function clientAddress(request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function checkLoginRate(request) {
  const key = clientAddress(request);
  const now = Date.now();
  const current = attemptsStore().get(key);
  if (!current || current.resetAt <= now) return { key, allowed: true };
  return { key, allowed: current.count < 5, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}

function recordFailedLogin(key) {
  const now = Date.now();
  const current = attemptsStore().get(key);
  if (!current || current.resetAt <= now) attemptsStore().set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
  else current.count += 1;
}

export async function handleAuthApi(request, env = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/auth/")) return null;
  const config = authConfiguration(env);

  if (url.pathname === "/api/auth/session" && request.method === "GET") {
    const session = await getAdminSession(request, env);
    return json({ authenticated: Boolean(session), configured: config.configured, viewer: session });
  }

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    if (!config.configured) return json({ error: "Admin authentication is not configured.", code: "AUTH_NOT_CONFIGURED" }, 503);
    const rate = checkLoginRate(request);
    if (!rate.allowed) return json({ error: "Too many login attempts. Try again later.", code: "RATE_LIMITED" }, 429, { "retry-after": String(rate.retryAfter) });
    let input;
    try { input = await request.json(); } catch { return json({ error: "A JSON login payload is required." }, 400); }
    const username = String(input?.username ?? "").trim();
    const password = String(input?.password ?? "");
    const passwordAccepted = await verifyPassword(password, config.passwordHash);
    if (username !== config.username || !passwordAccepted) {
      recordFailedLogin(rate.key);
      return json({ error: "Invalid username or password.", code: "INVALID_CREDENTIALS" }, 401);
    }
    attemptsStore().delete(rate.key);
    return json({ authenticated: true, viewer: { username: config.username, email: config.email } }, 200, { "set-cookie": setCookieHeader(request, await createSessionToken(config)) });
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    return json({ authenticated: false }, 200, { "set-cookie": clearCookieHeader(request) });
  }

  return json({ error: "Route not found or method not allowed." }, 405);
}

