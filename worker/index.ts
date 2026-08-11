/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handlePlatformApi } from "../platform/api.mjs";
import { handleLeadApi } from "../platform/lead-api.mjs";
import { handleAdminApi } from "../platform/admin-api.mjs";
import { authorizeAdminRequest } from "../platform/admin-api.mjs";
import { handleAuthApi } from "../platform/auth.mjs";
import { getCustomerSession, handleCustomerAuthApi } from "../platform/customer-auth.mjs";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB?: unknown;
  FILES?: unknown;
  ADMIN_EMAILS?: string;
  ADMIN_USER_IDS?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  PUBLIC_SITE_URL?: string;
  ADMIN_USERNAME?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD_HASH?: string;
  ADMIN_SESSION_SECRET?: string;
  DATABASE_URL?: string;
  UPLOAD_DIR?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

type VpsRuntime = {
  getPostgresDatabase(connectionString: string): Promise<unknown>;
  getLocalUploadStorage(root: string): unknown;
};

let vpsRuntimePromise: Promise<VpsRuntime> | null = null;

async function attachVpsDataBindings(bindings: Env) {
  if (!bindings.DATABASE_URL || bindings.DB) return;
  if (typeof process === "undefined") return;
  const moduleUrl = `file://${process.cwd()}/platform/postgres-runtime.mjs`;
  vpsRuntimePromise ??= import(/* @vite-ignore */ moduleUrl) as Promise<VpsRuntime>;
  const runtime = await vpsRuntimePromise;
  bindings.DB = await runtime.getPostgresDatabase(bindings.DATABASE_URL);
  if (!bindings.FILES && bindings.UPLOAD_DIR) bindings.FILES = runtime.getLocalUploadStorage(bindings.UPLOAD_DIR);
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env | undefined, ctx: ExecutionContext): Promise<Response> {
    const processBindings = typeof process !== "undefined" ? process.env : {};
    const bindings = { ...processBindings, ...(env ?? {}) } as unknown as Env;
    const url = new URL(request.url);

    const authResponse = await handleAuthApi(request, bindings);
    if (authResponse) return authResponse;

    if ((url.pathname === "/admin" || url.pathname.startsWith("/admin/")) && url.pathname !== "/admin/login") {
      const access = await authorizeAdminRequest(request, bindings);
      if (!access.allowed) {
        const login = new URL("/admin/login", request.url);
        const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
        if (forwardedProtocol === "https" || forwardedProtocol === "http") login.protocol = `${forwardedProtocol}:`;
        login.searchParams.set("returnTo", `${url.pathname}${url.search}`);
        return Response.redirect(login, 302);
      }
    }

    if (url.pathname.startsWith("/api/admin/") || url.pathname.startsWith("/api/leads/") || url.pathname.startsWith("/api/platform/") || url.pathname.startsWith("/api/customer-auth/") || url.pathname.startsWith("/account/")) {
      try {
        await attachVpsDataBindings(bindings);
      } catch (error) {
        console.error("Persistent storage is unavailable", error);
        return new Response(JSON.stringify({ error: "Persistent storage is temporarily unavailable.", code: "STORAGE_UNAVAILABLE" }), {
          status: 503,
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
        });
      }
    }

    const customerAuthResponse = await handleCustomerAuthApi(request, bindings.DB, bindings);
    if (customerAuthResponse) return customerAuthResponse;

    if (url.pathname.startsWith("/account/")) {
      const session = await getCustomerSession(request, bindings.DB, bindings);
      if (!session) {
        const login = new URL("/login", request.url);
        const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
        if (forwardedProtocol === "https" || forwardedProtocol === "http") login.protocol = `${forwardedProtocol}:`;
        login.searchParams.set("returnTo", `${url.pathname}${url.search}`);
        return Response.redirect(login, 302);
      }
    }

    const adminResponse = await handleAdminApi(request, bindings.DB, bindings);
    if (adminResponse) return adminResponse;

    const leadResponse = await handleLeadApi(request, bindings.DB, bindings, (promise: Promise<unknown>) => ctx.waitUntil(promise));
    if (leadResponse) return leadResponse;

    const platformResponse = await handlePlatformApi(request, bindings.DB, bindings.FILES, bindings);
    if (platformResponse) return platformResponse;

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      if (!bindings.ASSETS || !bindings.IMAGES) return new Response("Image optimization is unavailable.", { status: 503 });
      return handleImageOptimization(request, {
        fetchAsset: (path) => bindings.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await bindings.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
