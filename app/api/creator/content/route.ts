import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const value = request.headers.get("authorization");
  return Boolean(value && (
    (process.env.AGENT_SERVICE_TOKEN && value === `Bearer ${process.env.AGENT_SERVICE_TOKEN}`) ||
    (process.env.CHO_ADMIN_TOKEN && value === `Bearer ${process.env.CHO_ADMIN_TOKEN}`)
  ));
}

async function ensureTable() {
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS creator_content_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(180) NOT NULL,
    body TEXT NOT NULL,
    platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(24) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','published','blocked')),
    created_by VARCHAR(80) NOT NULL DEFAULT 'CHO',
    approval_note TEXT,
    published_at TIMESTAMPTZ,
    external_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  return sql;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Valid CHO or agent service authorization is required." }, { status: 401 });
  try {
    const sql = await ensureTable();
    const drafts = await sql`SELECT id, title, body, platforms, status, created_by, approval_note, published_at, created_at, updated_at FROM creator_content_drafts ORDER BY created_at DESC LIMIT 50`;
    return NextResponse.json({ drafts });
  } catch {
    return NextResponse.json({ error: "Creator draft storage is unavailable. Verify DATABASE_URL and Neon connectivity." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Valid CHO or agent service authorization is required." }, { status: 401 });
  let body: { title?: string; body?: string; platforms?: string[] };
  try { body = await request.json() as { title?: string; body?: string; platforms?: string[] }; }
  catch { return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 }); }
  const title = body.title?.trim() || "";
  const content = body.body?.trim() || "";
  const allowed = new Set(["instagram", "facebook", "x", "tiktok", "linkedin", "youtube", "pinterest", "blogger", "wordpress"]);
  const platforms = Array.isArray(body.platforms) ? [...new Set(body.platforms.filter((p): p is string => typeof p === "string" && allowed.has(p)))] : [];
  if (!title || title.length > 180 || content.length < 5 || content.length > 12000 || !platforms.length) {
    return NextResponse.json({ error: "Provide a title, 5–12,000 characters of content, and at least one supported destination." }, { status: 400 });
  }
  try {
    const sql = await ensureTable();
    const rows = await sql`INSERT INTO creator_content_drafts (title, body, platforms, status, created_by) VALUES (${title}, ${content}, ${JSON.stringify(platforms)}::jsonb, 'draft', 'CHO / Creator Command Center') RETURNING id, title, body, platforms, status, created_at`;
    await sql`INSERT INTO company_audit_events (actor_type, actor_name, event_type, message, entity_type, entity_id, payload) VALUES ('system', 'Creator Command Center', 'creator.draft.created', ${"Created draft: " + title}, 'creator_draft', ${rows[0].id}::uuid, ${JSON.stringify({ platforms, status: "draft" })}::jsonb)`;
    return NextResponse.json({ draft: rows[0], publishing: "disabled_until_oauth_and_approval_are_verified" }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Draft could not be saved. Verify DATABASE_URL and Neon connectivity." }, { status: 503 });
  }
}
