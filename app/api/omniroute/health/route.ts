import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getGatewayConfig() {
  const configuredBase = process.env.OMNIROUTE_BASE_URL?.trim();
  const fallbackBase = process.env.AI_GATEWAY_BASE_URL?.trim() || "https://openrouter.ai/api/v1";
  const base = (configuredBase || fallbackBase).replace(/\/+$/, "");
  const isOmniRoute = Boolean(configuredBase);
  const model = isOmniRoute
    ? process.env.OMNIROUTE_DEFAULT_MODEL?.trim() || ""
    : process.env.AI_DEFAULT_MODEL?.trim() || "";
  // Never forward a fallback-provider key to OmniRoute.
  const apiKey = isOmniRoute
    ? process.env.OMNIROUTE_API_KEY || ""
    : process.env.AI_GATEWAY_API_KEY || process.env.OPENROUTER_API_KEY || "";
  return { base, model, apiKey, isOmniRoute };
}

export async function GET() {
  const config = getGatewayConfig();
  if (!config.model || (!config.isOmniRoute && !config.apiKey)) {
    return NextResponse.json({
      ok: false,
      configured: false,
      gateway: config.isOmniRoute ? "omniroute" : "fallback",
      error: "Configure OMNIROUTE_BASE_URL and OMNIROUTE_DEFAULT_MODEL to connect OmniRoute. OmniRoute API key is optional when the server is configured without authentication.",
    }, { status: 503 });
  }

  try {
    const modelsUrl = config.base.endsWith("/v1") ? `${config.base}/models` : `${config.base}/v1/models`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
    const response = await fetch(modelsUrl, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      return NextResponse.json({
        ok: false,
        configured: true,
        gateway: config.isOmniRoute ? "omniroute" : "fallback",
        status: response.status,
        error: `The AI gateway returned HTTP ${response.status}. Check that the URL is reachable and credentials are correct.`,
      }, { status: 502 });
    }

    const data = await response.json() as { data?: { id?: string }[]; models?: { id?: string }[] };
    const models = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];
    const modelAvailable = models.some((entry) => entry.id === config.model);
    return NextResponse.json({
      ok: modelAvailable,
      configured: true,
      gateway: config.isOmniRoute ? "omniroute" : "fallback",
      model: config.model,
      modelAvailable,
      modelCount: models.length,
      checkedAt: new Date().toISOString(),
      message: modelAvailable
        ? "OmniRoute is reachable and the configured model is listed."
        : "The gateway is reachable, but the configured model is not listed. Choose a model ID from its /v1/models response.",
    }, { status: modelAvailable ? 200 : 409 });
  } catch {
    return NextResponse.json({
      ok: false,
      configured: true,
      gateway: config.isOmniRoute ? "omniroute" : "fallback",
      error: "Could not reach the AI gateway. Confirm the service is running and OMNIROUTE_BASE_URL is publicly reachable over HTTPS.",
    }, { status: 502 });
  }
}
