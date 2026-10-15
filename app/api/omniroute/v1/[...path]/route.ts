import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_ROUTES = new Set([
  "models",
  "chat/completions",
  "responses",
  "embeddings",
  "images/generations",
  "audio/transcriptions",
  "audio/speech",
]);

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: { message, type: "omniroute_compatibility_error" } }, { status });
}

function isAuthorized(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  const supplied = authorization.slice("Bearer ".length);
  const accepted = [process.env.OMNIROUTE_API_KEY, process.env.AGENT_SERVICE_TOKEN]
    .filter((value): value is string => Boolean(value));
  return accepted.some((secret) => secret.length > 0 && supplied === secret);
}

async function proxy(request: Request, path: string[]) {
  if (!isAuthorized(request)) {
    const hasAuthConfigured = Boolean(process.env.OMNIROUTE_API_KEY || process.env.AGENT_SERVICE_TOKEN);
    return jsonError(
      hasAuthConfigured ? "Unauthorized gateway request." : "Configure OMNIROUTE_API_KEY or AGENT_SERVICE_TOKEN.",
      hasAuthConfigured ? 401 : 503,
    );
  }

  const routePath = path.join("/");
  if (!ALLOWED_ROUTES.has(routePath)) return jsonError("This Vercel gateway route is not supported.", 404);
  if (request.method === "GET" && routePath !== "models") return jsonError("GET is supported only for /v1/models.", 405);
  if (request.method !== "GET" && request.method !== "POST") return jsonError("Method not allowed.", 405);

  const upstreamKey = process.env.OMNIROUTE_UPSTREAM_API_KEY
    || process.env.AI_GATEWAY_API_KEY
    || process.env.OPENROUTER_API_KEY;
  if (!upstreamKey) return jsonError("Configure OMNIROUTE_UPSTREAM_API_KEY, AI_GATEWAY_API_KEY, or OPENROUTER_API_KEY.", 503);

  const configuredBase = process.env.OMNIROUTE_UPSTREAM_BASE_URL
    || process.env.AI_GATEWAY_BASE_URL
    || "https://openrouter.ai/api/v1";

  let upstreamBase: URL;
  try {
    upstreamBase = new URL(configuredBase);
  } catch {
    return jsonError("The configured upstream base URL is invalid.", 500);
  }
  if (upstreamBase.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && upstreamBase.hostname === "localhost")) {
    return jsonError("The upstream gateway must use HTTPS in production.", 500);
  }

  const basePath = upstreamBase.pathname.replace(/\/$/, "");
  const target = new URL(`${basePath}/${routePath}`.replace(/\/+/g, "/"), upstreamBase.origin);
  target.search = new URL(request.url).search;

  const headers = new Headers({
    Authorization: `Bearer ${upstreamKey}`,
    Accept: request.headers.get("accept") || "application/json",
  });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  for (const name of ["idempotency-key", "x-request-id", "x-session-id"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const upstreamResponse = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "POST" ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(55_000),
    });

    const responseHeaders = new Headers();
    for (const name of [
      "content-type",
      "cache-control",
      "x-request-id",
      "openai-processing-ms",
      "x-ratelimit-limit-requests",
      "x-ratelimit-remaining-requests",
      "x-ratelimit-reset-requests",
    ]) {
      const value = upstreamResponse.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    if (responseHeaders.get("content-type")?.includes("text/event-stream")) {
      responseHeaders.set("cache-control", "no-cache, no-transform");
      responseHeaders.set("x-accel-buffering", "no");
    } else if (!responseHeaders.has("cache-control")) {
      responseHeaders.set("cache-control", "no-store");
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upstream gateway request failed.";
    return jsonError(`Upstream gateway request failed: ${message}`, 502);
  }
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}
