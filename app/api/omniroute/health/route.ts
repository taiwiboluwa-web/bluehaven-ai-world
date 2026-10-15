import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function configured(...names: string[]) {
  return names.some((name) => Boolean(process.env[name]?.trim()));
}

export async function GET() {
  const upstream = process.env.OMNIROUTE_UPSTREAM_BASE_URL
    || process.env.AI_GATEWAY_BASE_URL
    || "https://openrouter.ai/api/v1";
  const authConfigured = Boolean(process.env.OMNIROUTE_API_KEY || process.env.AGENT_SERVICE_TOKEN);
  const providers = [
    { id: "openrouter", label: "OpenRouter", configured: configured("OMNIROUTE_UPSTREAM_API_KEY", "AI_GATEWAY_API_KEY", "OPENROUTER_API_KEY"), mode: "unified" },
    { id: "openai", label: "OpenAI", configured: configured("OPENAI_API_KEY"), mode: "direct" },
    { id: "gemini", label: "Google Gemini", configured: configured("GOOGLE_GEMINI_API_KEY", "GEMINI_API_KEY"), mode: "direct" },
    { id: "anthropic", label: "Anthropic Claude", configured: configured("ANTHROPIC_API_KEY"), mode: "direct" },
    { id: "deepseek", label: "DeepSeek", configured: configured("DEEPSEEK_API_KEY"), mode: "direct" },
    { id: "groq", label: "Groq", configured: configured("GROQ_API_KEY"), mode: "direct" },
    { id: "mistral", label: "Mistral", configured: configured("MISTRAL_API_KEY"), mode: "direct" },
  ];

  return NextResponse.json({
    status: authConfigured && providers.some((provider) => provider.configured) ? "ready" : "configuration_required",
    implementation: "vercel-native-multi-provider-openai-compatible-adapter",
    runtime: "vercel-functions",
    defaultUpstreamBaseUrl: upstream,
    authenticationConfigured: authConfigured,
    configuredProviderCount: providers.filter((provider) => provider.configured).length,
    providers,
    supportedEndpoints: [
      "GET /api/omniroute/v1/models?provider=openrouter|openai|gemini|anthropic|deepseek|groq|mistral",
      "POST /api/omniroute/v1/chat/completions?provider=openrouter|openai|gemini|anthropic|deepseek|groq|mistral",
      "POST /api/omniroute/v1/responses",
      "POST /api/omniroute/v1/embeddings",
      "POST /api/omniroute/v1/images/generations",
      "POST /api/omniroute/v1/audio/transcriptions",
      "POST /api/omniroute/v1/audio/speech"
    ],
    note: "Provider configured means a server-side credential is present, not that billing, permissions, or a live model request has been verified. Claude direct mode currently supports models and non-streaming chat completions; use OpenRouter for other Claude endpoint types."
  });
}
