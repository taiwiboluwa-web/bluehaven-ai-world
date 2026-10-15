import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const platformProviders: Record<string, "x" | "linkedin" | "google" | "wordpress"> = {
  x: "x",
  linkedin: "linkedin",
  blogger: "google",
  wordpress: "wordpress",
};

function authorizedCho(request: Request) {
  const expected = process.env.CHO_ADMIN_TOKEN;
  return Boolean(expected && request.headers.get("authorization") === `Bearer ${expected}`);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!authorizedCho(request)) return NextResponse.json({ error: "CHO approval is required for draft approval and publishing." }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid draft ID." }, { status: 400 });
  }

  let body: { action?: string; platform?: string; confirmPublish?: boolean; note?: string };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 }); }

  try {
    const sql = getSql();
    if (body.action === "approve") {
      const rows = await sql`
        UPDATE creator_content_drafts
        SET status = 'approved', approval_note = ${(body.note || "Approved by CHO").slice(0, 1000)}, updated_at = now()
        WHERE id = ${id}::uuid AND status IN ('draft','pending_approval')
        RETURNING id, title, status, approval_note
      `;
      if (!rows.length) {
        const existing = await sql`SELECT id, status FROM creator_content_drafts WHERE id = ${id}::uuid LIMIT 1`;
        if (!existing.length) return NextResponse.json({ error: "Draft not found." }, { status: 404 });
        if (existing[0].status === "approved") return NextResponse.json({ ok: true, draft: existing[0], duplicate: true });
        return NextResponse.json({ error: `Draft cannot be approved from status ${existing[0].status}.` }, { status: 409 });
      }
      await sql`INSERT INTO company_audit_events (actor_type, actor_name, event_type, message, entity_type, entity_id, payload) VALUES ('chief_human_officer', 'CHO', 'creator.draft.approved', ${"Approved draft: " + rows[0].title}, 'creator_draft', ${id}::uuid, ${JSON.stringify({ note: body.note || "Approved by CHO" })}::jsonb)`;
      return NextResponse.json({ ok: true, draft: rows[0] });
    }

    if (body.action !== "publish") return NextResponse.json({ error: "Action must be approve or publish." }, { status: 400 });
    if (body.confirmPublish !== true) return NextResponse.json({ error: "Explicit confirmation is required before publishing publicly." }, { status: 400 });
    const platform = String(body.platform || "");
    const provider = platformProviders[platform];
    if (!provider) return NextResponse.json({ error: "This destination is draft-only in the current publisher. No post was sent.", platform, status: "adapter_pending" }, { status: 501 });

    const rows = await sql`SELECT id, title, body, platforms, status, external_ids FROM creator_content_drafts WHERE id = ${id}::uuid LIMIT 1`;
    if (!rows.length) return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    const draft = rows[0] as { id: string; title: string; body: string; platforms: string[]; status: string; external_ids: Record<string, { remotePostId?: string; publishedUrl?: string; receiptKey?: string }> | null };
    if (draft.status !== "approved") return NextResponse.json({ error: "Approve this draft before publishing." }, { status: 409 });
    if (!Array.isArray(draft.platforms) || !draft.platforms.includes(platform)) return NextResponse.json({ error: "This destination was not selected for the draft." }, { status: 400 });
    if (draft.external_ids?.[platform]?.remotePostId) {
      return NextResponse.json({ ok: true, duplicate: true, platform, receipt: draft.external_ids[platform] });
    }

    const publishPayload = provider === "x"
      ? { text: draft.body }
      : provider === "linkedin"
        ? { content: draft.body }
        : { title: draft.title, content: draft.body };
    const publishUrl = new URL(`/api/connections/publish/${provider}`, request.url);
    const publishResponse = await fetch(publishUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CHO_ADMIN_TOKEN}` },
      body: JSON.stringify({ ...publishPayload, idempotencyKey: `${id}-${platform}`, confirmPublish: true }),
      cache: "no-store",
      signal: AbortSignal.timeout(55000),
    });
    const result = await publishResponse.json().catch(() => ({})) as { error?: string; remotePostId?: string; publishedUrl?: string; receiptKey?: string; status?: string };
    if (!publishResponse.ok) return NextResponse.json({ error: result.error || "Provider publishing failed.", provider, status: result.status || "failed" }, { status: publishResponse.status });

    const receipt = { remotePostId: result.remotePostId || "", publishedUrl: result.publishedUrl || "", receiptKey: result.receiptKey || "" };
    if (!receipt.remotePostId) return NextResponse.json({ error: "The provider returned no verifiable post ID. Check its publication receipt before retrying." }, { status: 502 });
    const nextExternalIds = { ...(draft.external_ids || {}), [platform]: receipt };
    const allSelectedPublished = draft.platforms.every((selected) => Boolean(nextExternalIds[selected]?.remotePostId));
    await sql`
      UPDATE creator_content_drafts
      SET external_ids = COALESCE(external_ids, '{}'::jsonb) || ${JSON.stringify({ [platform]: receipt })}::jsonb,
          status = ${allSelectedPublished ? "published" : "approved"},
          published_at = CASE WHEN ${allSelectedPublished} THEN now() ELSE published_at END,
          updated_at = now()
      WHERE id = ${id}::uuid
    `;
    await sql`INSERT INTO company_audit_events (actor_type, actor_name, event_type, message, entity_type, entity_id, payload) VALUES ('chief_human_officer', 'CHO', 'creator.draft.published', ${"Published draft " + draft.title + " to " + platform}, 'creator_draft', ${id}::uuid, ${JSON.stringify({ platform, provider, receipt })}::jsonb)`;
    return NextResponse.json({ ok: true, platform, provider, receipt, status: allSelectedPublished ? "published" : "approved" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Draft operation failed.";
    return NextResponse.json({ error: message.slice(0, 300) }, { status: 503 });
  }
}
