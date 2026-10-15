import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSql } from "@/lib/db";
import { isProviderConfigured, missingProviderConfiguration, SOCIAL_PROVIDERS } from "@/lib/social-providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const COOKIE = "bluehaven_social_admin";

export async function GET() {
  const expected = process.env.CHO_ADMIN_TOKEN;
  const jar = await cookies();
  if (!expected || jar.get(COOKIE)?.value !== expected) return NextResponse.json({ error: "Sign in to manage connected accounts." }, { status: 401 });
  try {
    const sql = getSql();
    const rows = await sql`SELECT provider, account_id, account_label, status, scopes, expires_at, last_verified_at, last_error, updated_at FROM social_provider_tokens ORDER BY provider, account_label`;
    const providers = Object.entries(SOCIAL_PROVIDERS).map(([provider, config]) => {
      const connections = rows.filter((row) => row.provider === provider).map((row) => ({
        accountId: row.account_id,
        accountLabel: row.account_label,
        status: row.status,
        scopes: row.scopes,
        expiresAt: row.expires_at,
        lastVerifiedAt: row.last_verified_at,
        lastError: row.last_error,
        updatedAt: row.updated_at,
      }));
      return {
        provider,
        label: config.label,
        configured: isProviderConfigured(provider as keyof typeof SOCIAL_PROVIDERS),
        connected: connections.some((connection) => connection.status === "connected"),
        connections,
        missingConfiguration: missingProviderConfiguration(provider as keyof typeof SOCIAL_PROVIDERS),
      };
    });
    return NextResponse.json({
      providers,
      unsupported: [
        { provider: "medium", label: "Medium", mode: "draft_handoff", note: "New integration tokens are not generally available; use the official editor/import workflow." },
        { provider: "substack", label: "Substack", mode: "draft_handoff", note: "No supported public general-purpose publishing API is configured; use a prepared draft handoff." },
        { provider: "amazon", label: "Amazon", mode: "commerce", note: "Product research and eligible affiliate links only; not a social publishing destination." },
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load connection status.";
    return NextResponse.json({ error: message, migration: "db/social-connections-schema.sql" }, { status: 503 });
  }
}
