/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handlePlatformApi } from "../platform/api.mjs";
import { handleLeadApi } from "../platform/lead-api.mjs";
import { handleAdminApi } from "../platform/admin-api.mjs";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB?: unknown;
  FILES?: unknown;
  ADMIN_EMAILS?: string;
  ADMIN_USER_IDS?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  PUBLIC_SITE_URL?: string;
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

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env | undefined, ctx: ExecutionContext): Promise<Response> {
    const bindings = env ?? ({} as Env);
    const url = new URL(request.url);

    const adminResponse = await handleAdminApi(request, bindings.DB, bindings);
    if (adminResponse) return adminResponse;

    const leadResponse = await handleLeadApi(request, bindings.DB, bindings, (promise: Promise<unknown>) => ctx.waitUntil(promise));
    if (leadResponse) return leadResponse;

    const platformResponse = await handlePlatformApi(request, bindings.DB, bindings.FILES);
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
