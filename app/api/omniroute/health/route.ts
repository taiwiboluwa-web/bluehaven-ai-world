import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const upstream = process.env.OMNIROUTE_UPSTREAM_BASE_URL
    || process.env.AI_GATEWAY_BASE_URL
    || "https://openrouter.ai/api/v1";
  const upstreamKeyConfigured = Boolean(
    process.env.OMNIROUTE_UPSTREAM_API_KEY
    || process.env.AI_GATEWAY_API_KEY
    || process.env.OPENROUTER_API_KEY
  );
  const authConfigured = Boolean(process.env.OMNIROUTE_API_KEY || process.env.AGENT_SERVICE_TOKEN);

  return NextResponse.json({
    status: authConfigured && upstreamKeyConfigured ? "ready" : "configuration_required",
    implementation: "vercel-native-openai-compatible-adapter",
    runtime: "vercel-functions",
    upstreamBaseUrl: upstream,
    authenticationConfigured: authConfigured,
    upstreamCredentialsConfigured: upstreamKeyConfigured,
    supportedEndpoints: [
      "GET /api/omniroute/v1/models",
      "POST /api/omniroute/v1/chat/completions",
      "POST /api/omniroute/v1/responses",
      "POST /api/omniroute/v1/embeddings",
      "POST /api/omniroute/v1/images/generations",
      "POST /api/omniroute/v1/audio/transcriptions",
      "POST /api/omniroute/v1/audio/speech"
    ],
    note: "This is a Vercel-compatible API adapter, not the full upstream OmniRoute server or management dashboard."
  });
}
