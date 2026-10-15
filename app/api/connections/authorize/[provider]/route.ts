import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { getRedirectUri, isProviderConfigured, isSocialProvider, makeRandomState, hashState, SOCIAL_PROVIDERS } from "@/lib/social-providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const COOKIE = "bluehaven_social_admin";

export async function GET(_request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider: rawProvider } = await context.params;
  if (!isSocialProvider(rawProvider)) return NextResponse.json({ error: "Unsupported provider." }, { status: 404 });
  const provider = rawProvider;
  const expected = process.env.CHO_ADMIN_TOKEN;
  const jar = await cookies();
  if (!expected || jar.get(COOKIE)?.value !== expected) return NextResponse.json({ error: "Sign in to BlueHaven Connections first." }, { status: 401 });
  if (!isProviderConfigured(provider)) {
    const missing = SOCIAL_PROVIDERS[provider].env.filter((key) => !process.env[key]);
    return NextResponse.json({ error: "This provider's OAuth app is not configured yet.", missing }, { status: 503 });
  }

  const state = makeRandomState();
  const stateHash = hashState(state);
  const verifier = "pkce" in SOCIAL_PROVIDERS[provider] && SOCIAL_PROVIDERS[provider].pkce ? makeRandomState() : null;
  const challenge = verifier ? createHash("sha256").update(verifier).digest("base64url") : null;
  const redirectUri = getRedirectUri(provider);
  try {
    const sql = getSql();
    await sql`DELETE FROM social_oauth_states WHERE expires_at < now() OR consumed_at IS NOT NULL`;
    await sql`INSERT INTO social_oauth_states (provider, state_hash, pkce_verifier, expires_at) VALUES (${provider}, ${stateHash}, ${verifier}, now() + interval '10 minutes')`;
  } catch {
    return NextResponse.json({ error: "Social connection database is not ready. Apply db/social-connections-schema.sql first." }, { status: 503 });
  }

  const config = SOCIAL_PROVIDERS[provider];
  const url = new URL(config.authorizationUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", redirectUri);
  if (provider === "meta") {
    url.searchParams.set("client_id", process.env.META_APP_ID!);
    url.searchParams.set("scope", config.scopes.join(","));
  } else if (provider === "x") {
    url.searchParams.set("client_id", process.env.X_CLIENT_ID!);
    url.searchParams.set("scope", config.scopes.join(" "));
    url.searchParams.set("code_challenge", challenge!);
    url.searchParams.set("code_challenge_method", "S256");
  } else if (provider === "tiktok") {
    url.searchParams.set("client_key", process.env.TIKTOK_CLIENT_KEY!);
    url.searchParams.set("scope", config.scopes.join(","));
  } else if (provider === "pinterest") {
    url.searchParams.set("client_id", process.env.PINTEREST_APP_ID!);
    url.searchParams.set("scope", config.scopes.join(","));
  } else if (provider === "google") {
    url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
    url.searchParams.set("scope", config.scopes.join(" "));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
  } else if (provider === "linkedin") {
    url.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID!);
    url.searchParams.set("scope", config.scopes.join(" "));
  } else if (provider === "wordpress") {
    url.searchParams.set("client_id", process.env.WORDPRESS_CLIENT_ID!);
    url.searchParams.set("scope", "global");
  }
  return NextResponse.redirect(url);
}
