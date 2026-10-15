import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { encryptSecret, getRedirectUri, hashState, isSocialProvider, SOCIAL_PROVIDERS } from "@/lib/social-providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
  data?: { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; token_type?: string };
};

function fail(message: string, status = 400) {
  const url = new URL("/connections", process.env.APP_URL || "https://bluehaven-ai-world.vercel.app");
  url.searchParams.set("connection_error", message.slice(0, 180));
  return NextResponse.redirect(url, status);
}

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider: rawProvider } = await context.params;
  if (!isSocialProvider(rawProvider)) return fail("Unsupported provider.");
  const provider = rawProvider;
  const incoming = new URL(request.url);
  const code = incoming.searchParams.get("code");
  const state = incoming.searchParams.get("state");
  const providerError = incoming.searchParams.get("error");
  if (providerError) return fail(`Provider authorization was declined: ${providerError}`);
  if (!code || !state) return fail("The provider did not return an authorization code and state.");

  try {
    const sql = getSql();
    const rows = await sql`
      UPDATE social_oauth_states
      SET consumed_at = now()
      WHERE provider = ${provider} AND state_hash = ${hashState(state)}
        AND consumed_at IS NULL AND expires_at > now()
      RETURNING pkce_verifier
    `;
    if (!rows.length) return fail("Authorization expired or state was already used. Please try Connect again.");
    const verifier = (rows[0] as { pkce_verifier?: string | null }).pkce_verifier || null;
    const config = SOCIAL_PROVIDERS[provider];
    const redirectUri = getRedirectUri(provider);
    const clientId = provider === "meta" ? process.env.META_APP_ID
      : provider === "x" ? process.env.X_CLIENT_ID
      : provider === "tiktok" ? process.env.TIKTOK_CLIENT_KEY
      : provider === "pinterest" ? process.env.PINTEREST_APP_ID
      : provider === "google" ? process.env.GOOGLE_CLIENT_ID
      : provider === "linkedin" ? process.env.LINKEDIN_CLIENT_ID
      : process.env.WORDPRESS_CLIENT_ID;
    const clientSecret = provider === "meta" ? process.env.META_APP_SECRET
      : provider === "x" ? process.env.X_CLIENT_SECRET
      : provider === "tiktok" ? process.env.TIKTOK_CLIENT_SECRET
      : provider === "pinterest" ? process.env.PINTEREST_APP_SECRET
      : provider === "google" ? process.env.GOOGLE_CLIENT_SECRET
      : provider === "linkedin" ? process.env.LINKEDIN_CLIENT_SECRET
      : process.env.WORDPRESS_CLIENT_SECRET;

    let tokenResponse: Response;
    if (provider === "meta") {
      const tokenUrl = new URL(config.tokenUrl);
      tokenUrl.searchParams.set("client_id", clientId!);
      tokenUrl.searchParams.set("client_secret", clientSecret!);
      tokenUrl.searchParams.set("redirect_uri", redirectUri);
      tokenUrl.searchParams.set("code", code);
      tokenResponse = await fetch(tokenUrl, { cache: "no-store" });
    } else {
      const body = new URLSearchParams({ code, grant_type: "authorization_code", redirect_uri: redirectUri });
      if (provider === "tiktok") {
        body.set("client_key", clientId!);
        body.set("client_secret", clientSecret!);
      } else {
        body.set("client_id", clientId!);
        if (provider !== "x" && provider !== "pinterest") body.set("client_secret", clientSecret!);
        if (provider === "x" && verifier) body.set("code_verifier", verifier);
      }
      const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };
      if (provider === "x" || provider === "pinterest") headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
      tokenResponse = await fetch(config.tokenUrl, { method: "POST", headers, body, cache: "no-store" });
    }
    const tokenBody = await tokenResponse.json().catch(() => ({})) as TokenResponse;
    const token = tokenBody.data?.access_token || tokenBody.access_token;
    const refresh = tokenBody.data?.refresh_token || tokenBody.refresh_token;
    if (!tokenResponse.ok || !token) {
      const description = tokenBody.error_description || tokenBody.error || `Provider token exchange failed (HTTP ${tokenResponse.status}).`;
      return fail(`${config.label}: ${description}`);
    }

    const expiresIn = tokenBody.data?.expires_in || tokenBody.expires_in;
    const scopeText = tokenBody.data?.scope || tokenBody.scope || "";
    const scopes = scopeText ? scopeText.split(/[ ,]+/).filter(Boolean) : [...config.scopes];
    const accessCiphertext = encryptSecret(token);
    const refreshCiphertext = encryptSecret(refresh);
    if (!accessCiphertext) return fail("Token encryption did not complete. Check SOCIAL_TOKEN_ENCRYPTION_KEY.", 500);
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
    await sql`
      INSERT INTO social_provider_tokens
        (provider, account_id, account_label, access_token_ciphertext, refresh_token_ciphertext, token_type, scopes, expires_at, status, capabilities, last_verified_at, last_error, updated_at)
      VALUES
        (${provider}, 'default', ${config.label}, ${accessCiphertext}, ${refreshCiphertext}, ${tokenBody.data?.token_type || tokenBody.token_type || "Bearer"}, ${scopes}::text[], ${expiresAt}::timestamptz, 'connected', ${JSON.stringify({ oauth: true, publishing: "not_tested" })}::jsonb, now(), NULL, now())
      ON CONFLICT (provider, account_id) DO UPDATE SET
        account_label = EXCLUDED.account_label,
        access_token_ciphertext = EXCLUDED.access_token_ciphertext,
        refresh_token_ciphertext = COALESCE(EXCLUDED.refresh_token_ciphertext, social_provider_tokens.refresh_token_ciphertext),
        token_type = EXCLUDED.token_type,
        scopes = EXCLUDED.scopes,
        expires_at = EXCLUDED.expires_at,
        status = 'connected',
        capabilities = EXCLUDED.capabilities,
        last_verified_at = now(),
        last_error = NULL,
        updated_at = now()
    `;
    const success = new URL("/connections", process.env.APP_URL || "https://bluehaven-ai-world.vercel.app");
    success.searchParams.set("connected", provider);
    success.searchParams.set("notice", "Authorization saved. Publishing is not yet tested.");
    return NextResponse.redirect(success);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection could not be saved.";
    return fail(message.includes("SOCIAL_TOKEN_ENCRYPTION_KEY") ? message : "Connection could not be completed. Check the server configuration and try again.", 500);
  }
}
