import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { decryptSecret, isSocialProvider } from "@/lib/social-providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const COOKIE = "bluehaven_social_admin";

type GoogleServiceCheck = {
  ok: true;
  count: number;
};

async function googleServiceCheck(url: string, token: string, collectionKey: string): Promise<GoogleServiceCheck> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof body.error === "object" && body.error && "message" in body.error
      ? String((body.error as { message: unknown }).message)
      : typeof body.error_description === "string"
        ? body.error_description
        : `Google API returned HTTP ${response.status}.`;
    throw new Error(message);
  }
  const items = body[collectionKey];
  return { ok: true, count: Array.isArray(items) ? items.length : 0 };
}

async function fetchIdentity(provider: string, token: string) {
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  let url = "";
  if (provider === "meta") url = "https://graph.facebook.com/me?fields=id,name";
  if (provider === "x") url = "https://api.x.com/2/users/me";
  if (provider === "tiktok") url = "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name";
  if (provider === "pinterest") url = "https://api.pinterest.com/v5/user_account";
  if (provider === "google") url = "https://openidconnect.googleapis.com/v1/userinfo";
  if (provider === "linkedin") url = "https://api.linkedin.com/v2/userinfo";
  if (provider === "wordpress") url = "https://public-api.wordpress.com/rest/v1.1/me";
  if (!url) throw new Error("Identity check is not implemented for this provider.");
  const response = await fetch(url, { headers, cache: "no-store" });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof body.message === "string" ? body.message : typeof body.error_description === "string" ? body.error_description : `Provider returned HTTP ${response.status}.`;
    throw new Error(message);
  }
  const data = body.data && typeof body.data === "object" ? body.data as Record<string, unknown> : body;
  const id = data.id ?? data.open_id ?? data.sub ?? data.user_id;
  const name = data.name ?? data.display_name ?? data.username ?? data.login ?? data.email;

  // Google sign-in is not considered tested until both requested APIs accept the saved token.
  // Successful empty lists are valid: a Google account may not yet own a Blogger blog or YouTube channel.
  let googleServices: { blogger: GoogleServiceCheck; youtube: GoogleServiceCheck } | undefined;
  if (provider === "google") {
    const [blogger, youtube] = await Promise.all([
      googleServiceCheck("https://www.googleapis.com/blogger/v3/users/self/blogs", token, "items"),
      googleServiceCheck("https://youtube.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true&maxResults=50", token, "items"),
    ]);
    googleServices = { blogger, youtube };
  }

  return {
    remoteAccountId: id ? String(id) : null,
    accountLabel: name ? String(name) : null,
    ...(googleServices ? { googleServices } : {}),
  };
}

export async function POST(_request: Request, context: { params: Promise<{ provider: string }> }) {
  const expected = process.env.CHO_ADMIN_TOKEN;
  const jar = await cookies();
  if (!expected || jar.get(COOKIE)?.value !== expected) return NextResponse.json({ error: "Sign in to test connected accounts." }, { status: 401 });
  const { provider } = await context.params;
  if (!isSocialProvider(provider)) return NextResponse.json({ error: "Unsupported provider." }, { status: 404 });
  try {
    const sql = getSql();
    const rows = await sql`SELECT access_token_ciphertext, expires_at FROM social_provider_tokens WHERE provider = ${provider} AND account_id = 'default' LIMIT 1`;
    if (!rows.length) return NextResponse.json({ error: "Connect this account before testing it." }, { status: 404 });
    const row = rows[0] as { access_token_ciphertext: string; expires_at: string | null };
    if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
      await sql`UPDATE social_provider_tokens SET status = 'needs_reauthorization', last_error = 'Access token expired; reconnect this account.', updated_at = now() WHERE provider = ${provider} AND account_id = 'default'`;
      return NextResponse.json({ error: "The saved access token has expired. Reconnect this account." }, { status: 401 });
    }
    const token = decryptSecret(row.access_token_ciphertext);
    if (!token) return NextResponse.json({ error: "The saved access token could not be decrypted." }, { status: 500 });
    const identity = await fetchIdentity(provider, token);
    const capabilities = {
      identityCheck: "passed",
      remoteAccountId: identity.remoteAccountId,
      identityCheckedAt: new Date().toISOString(),
      publishing: "not_tested",
      ...(identity.googleServices ? { googleServices: identity.googleServices } : {}),
    };
    await sql`UPDATE social_provider_tokens SET account_label = COALESCE(${identity.accountLabel}, account_label), capabilities = capabilities || ${JSON.stringify(capabilities)}::jsonb, last_verified_at = now(), last_error = NULL, status = 'connected', updated_at = now() WHERE provider = ${provider} AND account_id = 'default'`;
    return NextResponse.json({
      ok: true,
      provider,
      accountLabel: identity.accountLabel,
      remoteAccountId: identity.remoteAccountId,
      ...(identity.googleServices ? { services: identity.googleServices } : {}),
      publishingTested: false,
      message: provider === "google"
        ? "Google identity, Blogger API access, and YouTube API access verified. Publishing has not been tested."
        : "Account identity check passed. This confirms authorization, not permission to publish.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Account check failed.";
    try {
      const sql = getSql();
      await sql`UPDATE social_provider_tokens SET last_error = ${message.slice(0, 300)}, updated_at = now() WHERE provider = ${provider} AND account_id = 'default'`;
    } catch {}
    return NextResponse.json({ error: message.slice(0, 300) }, { status: 502 });
  }
}
