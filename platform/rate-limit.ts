import type { HistoryDatabase } from "./history";
import { API_RATE_LIMITS_TABLE_SQL } from "../db/schema";

type RateLimitOptions = { scope: string; limit: number; windowMs?: number };
type RateLimitEntry = { windowStart: number; count: number };
type RateLimitRow = { window_start: number; request_count: number };

const MEMORY_KEY = Symbol.for("3ve4.platform.rateLimits");

function memoryStore(): Map<string, RateLimitEntry> {
  const root = globalThis as typeof globalThis & { [MEMORY_KEY]?: Map<string, RateLimitEntry> };
  root[MEMORY_KEY] ??= new Map();
  return root[MEMORY_KEY];
}

async function requestKey(request: Request, scope: string) {
  const userId = request.headers.get("oai-authenticated-user-id");
  const forwarded = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const identity = userId ? `user:${userId}` : `ip:${forwarded || "anonymous"}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${scope}:${identity}`));
  const fingerprint = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${scope}:${fingerprint}`;
}

export class RateLimitError extends Error {
  retryAfter: number;

  constructor(retryAfter: number) {
    super("Too many requests. Try again shortly.");
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export async function enforceRateLimit(database: HistoryDatabase | undefined, request: Request, options: RateLimitOptions) {
  const windowMs = options.windowMs ?? 60_000;
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const retryAfter = Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000));
  const key = await requestKey(request, options.scope);

  if (!database) {
    const store = memoryStore();
    const current = store.get(key);
    if (!current || current.windowStart !== windowStart) {
      store.set(key, { windowStart, count: 1 });
      return;
    }
    if (current.count >= options.limit) throw new RateLimitError(retryAfter);
    current.count += 1;
    return;
  }

  await database.prepare(API_RATE_LIMITS_TABLE_SQL).run();

  const current = await database.prepare("SELECT window_start, request_count FROM api_rate_limits WHERE rate_key = ?").bind(key).first<RateLimitRow>();
  if (!current || current.window_start !== windowStart) {
    await database.prepare(
      `INSERT INTO api_rate_limits (rate_key, window_start, request_count, updated_at) VALUES (?, ?, 1, ?)
       ON CONFLICT(rate_key) DO UPDATE SET window_start = excluded.window_start, request_count = 1, updated_at = excluded.updated_at`,
    ).bind(key, windowStart, new Date(now).toISOString()).run();
    return;
  }
  if (current.request_count >= options.limit) throw new RateLimitError(retryAfter);
  await database.prepare("UPDATE api_rate_limits SET request_count = request_count + 1, updated_at = ? WHERE rate_key = ? AND window_start = ?")
    .bind(new Date(now).toISOString(), key, windowStart).run();
}
