import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const integrations = [
  { id: "instagram", label: "Instagram / Facebook", required: ["META_APP_ID", "META_APP_SECRET", "META_ACCESS_TOKEN"], note: "Meta app, account permissions, and publishing token are required." },
  { id: "x", label: "X", required: ["X_CLIENT_ID", "X_CLIENT_SECRET", "X_ACCESS_TOKEN"], note: "X OAuth app and account-scoped posting access are required." },
  { id: "tiktok", label: "TikTok", required: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_ACCESS_TOKEN"], note: "TikTok app approval and creator publishing scopes are required." },
  { id: "linkedin", label: "LinkedIn", required: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_ACCESS_TOKEN"], note: "LinkedIn OAuth and authorized organization/member posting scopes are required." },
  { id: "youtube", label: "YouTube", required: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"], note: "Google OAuth and a channel-authorized refresh token are required." },
  { id: "pinterest", label: "Pinterest", required: ["PINTEREST_APP_ID", "PINTEREST_APP_SECRET", "PINTEREST_ACCESS_TOKEN"], note: "Pinterest app access and board publishing permission are required." },
] as const;

export async function GET() {
  const providers = integrations.map((provider) => {
    const present = provider.required.filter((name) => Boolean(process.env[name]?.trim()));
    return {
      id: provider.id,
      label: provider.label,
      status: present.length === provider.required.length ? "credentials_present_unverified" : "setup_required",
      configuredCount: present.length,
      requiredCount: provider.required.length,
      missing: provider.required.filter((name) => !process.env[name]?.trim()),
      note: provider.note,
    };
  });
  return NextResponse.json({
    mode: "draft_first",
    publishingEnabled: false,
    approvalRequired: true,
    providers,
    note: "Credential presence is not proof of OAuth completion or successful publishing. Live publishing stays disabled until provider-specific OAuth, token refresh, permissions, and approval checks are implemented and verified.",
  }, { headers: { "Cache-Control": "no-store" } });
}
