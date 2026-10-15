import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { isProviderConfigured, missingProviderConfiguration, SOCIAL_PROVIDERS } from "@/lib/social-providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const integrations = [
  { id: "instagram", provider: "meta", label: "Instagram / Facebook", note: "Meta professional account or Page authorization; Instagram publishing may require public media URLs and supported account types." },
  { id: "x", provider: "x", label: "X", note: "X OAuth and account-scoped post creation access are required." },
  { id: "tiktok", provider: "tiktok", label: "TikTok", note: "TikTok app approval and creator publishing scopes are required; video publishing is a separate workflow." },
  { id: "linkedin", provider: "linkedin", label: "LinkedIn", note: "LinkedIn OAuth and authorized member or organization posting scopes are required." },
  { id: "youtube", provider: "google", label: "Blogger / YouTube", note: "Google OAuth can authorize Blogger and YouTube; the current direct publisher supports Blogger articles, not YouTube video uploads." },
  { id: "pinterest", provider: "pinterest", label: "Pinterest", note: "Pinterest app access and board publishing permissions are required; Pin publishing needs suitable media." },
  { id: "wordpress", provider: "wordpress", label: "WordPress.com", note: "WordPress.com OAuth and a site accessible to the connected account are required." },
] as const;

export async function GET() {
  const configuredProviders = integrations.map((integration) => {
    const provider = integration.provider as keyof typeof SOCIAL_PROVIDERS;
    const missing = missingProviderConfiguration(provider);
    const configured = isProviderConfigured(provider);
    return {
      ...integration,
      configured,
      configuredCount: SOCIAL_PROVIDERS[provider].env.length + 1 - missing.length,
      requiredCount: SOCIAL_PROVIDERS[provider].env.length + 1,
      missing,
      status: configured ? "credentials_present_unverified" : "setup_required",
      connected: false,
      note: integration.note,
    };
  });

  let connectionStorageReady = true;
  try {
    const sql = getSql();
    const rows = await sql`SELECT provider, status, capabilities, expires_at FROM social_provider_tokens WHERE account_id = 'default'`;
    for (const integration of configuredProviders) {
      const connection = rows.find((row) => row.provider === integration.provider) as
        | { status: string; capabilities: Record<string, unknown> | null; expires_at: string | null }
        | undefined;
      if (!connection) continue;
      const expired = Boolean(connection.expires_at && new Date(connection.expires_at).getTime() <= Date.now());
      const identityVerified = connection.capabilities?.identityCheck === "passed";
      integration.connected = connection.status === "connected" && !expired && identityVerified;
      integration.status = integration.connected
        ? "connected_verified"
        : connection.status === "connected" && !expired
          ? "connected_unverified"
          : connection.status === "needs_reauthorization" || expired
            ? "reauthorization_required"
            : integration.configured
              ? "credentials_present_unverified"
              : "setup_required";
    }
  } catch {
    connectionStorageReady = false;
  }

  return NextResponse.json({
    mode: "draft_first",
    publishingEnabled: true,
    approvalRequired: true,
    connectionStorageReady,
    providers: configuredProviders,
    note: "OAuth connection and identity checks are reported separately from publishing. Only the Connections control room can authorize accounts; supported live publishers require explicit confirmation and record idempotent publication receipts. Unsupported destinations remain draft-only.",
  }, { headers: { "Cache-Control": "no-store" } });
}
