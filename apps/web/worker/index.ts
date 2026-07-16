/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { ensureRuntimeDesignPolicy } from "../src/platform/ensure-design-policy";
import { recordRequestEvent, safeRoute } from "../src/observability/events";
import { withSecurityHeaders } from "../src/security/response-headers";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
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
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const startedAt = performance.now();
    const incomingRequestId = request.headers.get("x-request-id");
    const requestId = incomingRequestId && /^[a-zA-Z0-9_.:-]{8,128}$/.test(incomingRequestId)
      ? incomingRequestId
      : crypto.randomUUID();
    // The rendered-HTML harness intentionally supplies no platform bindings;
    // every deployed Site has the required DB binding from hosting.json.
    if (env.DB) await ensureRuntimeDesignPolicy(env.DB);
    const url = new URL(request.url);

    if (url.pathname === "/api/health" || url.pathname === "/api/ready") {
      let response: Response;
      try {
        const row = env.DB
          ? await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>()
          : null;
        const ready = row?.ok === 1;
        response = Response.json(
          { status: ready ? "ok" : "unavailable" },
          { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
        );
      } catch {
        response = Response.json(
          { status: "unavailable" },
          { status: 503, headers: { "cache-control": "no-store" } },
        );
      }
      recordRequestEvent({ event: "http.request", requestId, method: request.method, route: url.pathname, status: response.status, durationMs: performance.now() - startedAt });
      return withSecurityHeaders(response, requestId);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const response = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      recordRequestEvent({ event: "http.request", requestId, method: request.method, route: url.pathname, status: response.status, durationMs: performance.now() - startedAt });
      return withSecurityHeaders(response, requestId);
    }

    let response: Response;
    try {
      response = await handler.fetch(request, env, ctx);
    } catch (error) {
      recordRequestEvent({ event: "http.request", requestId, method: request.method, route: safeRoute(url.pathname), status: 500, durationMs: performance.now() - startedAt });
      throw error;
    }
    recordRequestEvent({ event: "http.request", requestId, method: request.method, route: safeRoute(url.pathname), status: response.status, durationMs: performance.now() - startedAt });
    return withSecurityHeaders(response, requestId);
  },
};

export default worker;
