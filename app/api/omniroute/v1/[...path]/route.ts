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

type ProviderId = "openrouter" | "openai" | "gemini" | "anthropic" | "deepseek" | "groq" | "mistral";
type ProviderConfig = {
  label: string;
  baseUrl: string;
  apiKey: string | undefined;
  defaultModel: string;
  protocol: "openai-compatible" | "anthropic";
};

function env(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function getProvider(id: ProviderId): ProviderConfig {
  const configs: Record<ProviderId, ProviderConfig> = {
    openrouter: {
      label: "OpenRouter",
      baseUrl: env("OMNIROUTE_UPSTREAM_BASE_URL", "AI_GATEWAY_BASE_URL") || "https://openrouter.ai/api/v1",
      apiKey: env("OMNIROUTE_UPSTREAM_API_KEY", "AI_GATEWAY_API_KEY", "OPENROUTER_API_KEY"),
      defaultModel: env("AI_DEFAULT_MODEL") || "openai/gpt-4o-mini",
      protocol: "openai-compatible",
    },
    openai: {
      label: "OpenAI",
      baseUrl: env("OPENAI_BASE_URL") || "https://api.openai.com/v1",
      apiKey: env("OPENAI_API_KEY"),
      defaultModel: env("OPENAI_DEFAULT_MODEL") || "gpt-4o-mini",
      protocol: "openai-compatible",
    },
    gemini: {
      label: "Google Gemini",
      baseUrl: env("GOOGLE_GEMINI_BASE_URL") || "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: env("GOOGLE_GEMINI_API_KEY", "GEMINI_API_KEY"),
      defaultModel: env("GEMINI_DEFAULT_MODEL") || "gemini-2.5-flash",
      protocol: "openai-compatible",
    },
    anthropic: {
      label: "Anthropic Claude",
      baseUrl: env("ANTHROPIC_BASE_URL") || "https://api.anthropic.com/v1",
      apiKey: env("ANTHROPIC_API_KEY"),
      defaultModel: env("ANTHROPIC_DEFAULT_MODEL") || "claude-sonnet-4-5",
      protocol: "anthropic",
    },
    deepseek: {
      label: "DeepSeek",
      baseUrl: env("DEEPSEEK_BASE_URL") || "https://api.deepseek.com/v1",
      apiKey: env("DEEPSEEK_API_KEY"),
      defaultModel: env("DEEPSEEK_DEFAULT_MODEL") || "deepseek-chat",
      protocol: "openai-compatible",
    },
    groq: {
      label: "Groq",
      baseUrl: env("GROQ_BASE_URL") || "https://api.groq.com/openai/v1",
      apiKey: env("GROQ_API_KEY"),
      defaultModel: env("GROQ_DEFAULT_MODEL") || "llama-3.3-70b-versatile",
      protocol: "openai-compatible",
    },
    mistral: {
      label: "Mistral",
      baseUrl: env("MISTRAL_BASE_URL") || "https://api.mistral.ai/v1",
      apiKey: env("MISTRAL_API_KEY"),
      defaultModel: env("MISTRAL_DEFAULT_MODEL") || "mistral-small-latest",
      protocol: "openai-compatible",
    },
  };
  return configs[id];
}

function normalizeProvider(value: string | null): ProviderId | null {
  if (!value) return "openrouter";
  const aliases: Record<string, ProviderId> = {
    openrouter: "openrouter",
    openai: "openai",
    google: "gemini",
    gemini: "gemini",
    "google-gemini": "gemini",
    anthropic: "anthropic",
    claude: "anthropic",
    deepseek: "deepseek",
    groq: "groq",
    mistral: "mistral",
  };
  return aliases[value.trim().toLowerCase()] || null;
}

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

function toAnthropicMessages(body: Record<string, unknown>, defaultModel: string) {
  const rawMessages = Array.isArray(body.messages) ? body.messages as Array<Record<string, unknown>> : [];
  const systemParts: string[] = [];
  const messages = rawMessages.flatMap((message) => {
    if (message.role === "system" || message.role === "developer") {
      if (typeof message.content === "string") systemParts.push(message.content);
      return [];
    }
    if (message.role !== "user" && message.role !== "assistant") return [];
    return [{ role: message.role, content: message.content ?? "" }];
  });
  const maxTokens = typeof body.max_tokens === "number"
    ? body.max_tokens
    : typeof body.max_completion_tokens === "number" ? body.max_completion_tokens : 1024;
  const payload: Record<string, unknown> = {
    model: typeof body.model === "string" && body.model ? body.model : defaultModel,
    max_tokens: maxTokens,
    messages,
  };
  if (systemParts.length) payload.system = systemParts.join("\n\n");
  for (const key of ["temperature", "top_p", "stop_sequences", "metadata"]) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  return payload;
}

function anthropicToOpenAI(payload: Record<string, unknown>, requestedModel: string) {
  const blocks = Array.isArray(payload.content) ? payload.content as Array<Record<string, unknown>> : [];
  const text = blocks.filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string).join("");
  const usage = (payload.usage && typeof payload.usage === "object" ? payload.usage : {}) as Record<string, unknown>;
  const stopReason = payload.stop_reason;
  return {
    id: payload.id || `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: payload.model || requestedModel,
    choices: [{
      index: 0,
      message: { role: "assistant", content: text },
      finish_reason: stopReason === "max_tokens" ? "length" : stopReason === "tool_use" ? "tool_calls" : "stop",
    }],
    usage: {
      prompt_tokens: Number(usage.input_tokens || 0),
      completion_tokens: Number(usage.output_tokens || 0),
      total_tokens: Number(usage.input_tokens || 0) + Number(usage.output_tokens || 0),
    },
  };
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

  const incomingUrl = new URL(request.url);
  const providerId = normalizeProvider(request.headers.get("x-ai-provider") || incomingUrl.searchParams.get("provider"));
  if (!providerId) return jsonError("Unknown provider. Choose openrouter, openai, gemini, anthropic, deepseek, groq, or mistral.", 400);
  const provider = getProvider(providerId);
  if (!provider.apiKey) {
    const variable = {
      openrouter: "OMNIROUTE_UPSTREAM_API_KEY (or AI_GATEWAY_API_KEY / OPENROUTER_API_KEY)",
      openai: "OPENAI_API_KEY",
      gemini: "GOOGLE_GEMINI_API_KEY (or GEMINI_API_KEY)",
      anthropic: "ANTHROPIC_API_KEY",
      deepseek: "DEEPSEEK_API_KEY",
      groq: "GROQ_API_KEY",
      mistral: "MISTRAL_API_KEY",
    }[providerId];
    return jsonError(`${provider.label} is not configured. Add ${variable} in Vercel Environment Variables.`, 503);
  }

  let upstreamBase: URL;
  try {
    upstreamBase = new URL(provider.baseUrl);
  } catch {
    return jsonError("The configured upstream base URL is invalid.", 500);
  }
  if (upstreamBase.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && upstreamBase.hostname === "localhost")) {
    return jsonError("The upstream gateway must use HTTPS in production.", 500);
  }

  if (provider.protocol === "anthropic" && routePath !== "models" && routePath !== "chat/completions") {
    return jsonError("Claude direct mode currently supports chat/completions and models. Use OpenRouter for other endpoint types.", 501);
  }

  const basePath = upstreamBase.pathname.replace(/\/$/, "");
  const upstreamPath = provider.protocol === "anthropic" && routePath === "chat/completions"
    ? "messages"
    : routePath;
  const target = new URL(`${basePath}/${upstreamPath}`.replace(/\/+/g, "/"), upstreamBase.origin);
  for (const [key, value] of incomingUrl.searchParams.entries()) {
    if (key !== "provider") target.searchParams.append(key, value);
  }

  const headers = new Headers({
    Accept: request.headers.get("accept") || "application/json",
  });
  if (provider.protocol === "anthropic") {
    headers.set("x-api-key", provider.apiKey);
    headers.set("anthropic-version", "2023-06-01");
  } else {
    headers.set("Authorization", `Bearer ${provider.apiKey}`);
  }
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  for (const name of ["idempotency-key", "x-request-id", "x-session-id"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let requestBody: ArrayBuffer | undefined;
  let requestedModel = provider.defaultModel;
  if (request.method === "POST") {
    if (provider.protocol === "anthropic" && routePath === "chat/completions") {
      let body: Record<string, unknown>;
      try {
        body = await request.json() as Record<string, unknown>;
      } catch {
        return jsonError("Request body must be valid JSON.", 400);
      }
      if (body.stream === true) return jsonError("Streaming is not yet supported for direct Claude mode. Use OpenRouter for streaming.", 501);
      if (typeof body.model === "string" && body.model) requestedModel = body.model;
      requestBody = new TextEncoder().encode(JSON.stringify(toAnthropicMessages(body, provider.defaultModel))).buffer;
    } else {
      requestBody = await request.arrayBuffer();
    }
  }

  try {
    const upstreamResponse = await fetch(target, {
      method: request.method,
      headers,
      body: requestBody,
      cache: "no-store",
      signal: AbortSignal.timeout(55_000),
    });

    if (provider.protocol === "anthropic" && routePath === "chat/completions" && upstreamResponse.ok) {
      const payload = await upstreamResponse.json() as Record<string, unknown>;
      return NextResponse.json(anthropicToOpenAI(payload, requestedModel), {
        status: upstreamResponse.status,
        headers: { "cache-control": "no-store" },
      });
    }

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
