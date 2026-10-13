import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const sql = getSql();
    const offline = await sql`SELECT id, name FROM ai_projects WHERE status = 'offline' ORDER BY created_at ASC`;
    if (!offline.length) return NextResponse.json({ reactivated: 0, message: "There are no offline projects." });

    const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.OPENROUTER_API_KEY;
    const model = process.env.AI_DEFAULT_MODEL;
    if (!apiKey || !model) {
      return NextResponse.json({
        error: "Cannot bring projects online yet. Configure AI_GATEWAY_API_KEY (or OPENROUTER_API_KEY) and AI_DEFAULT_MODEL in Vercel Environment Variables, then redeploy.",
        configurationRequired: true,
        offlineCount: offline.length
      }, { status: 409 });
    }

    const baseUrl = (process.env.AI_GATEWAY_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
      cache: "no-store"
    });
    const data = await response.json() as { data?: { id?: string }[]; error?: { message?: string } };
    if (!response.ok || !data.data?.some((entry) => entry.id === model)) {
      const message = data.error?.message || (response.ok
        ? `Configured model "${model}" is not available from the AI gateway.`
        : `AI gateway check failed (HTTP ${response.status}).`);
      return NextResponse.json({ error: message, offlineCount: offline.length }, { status: 502 });
    }

    const ids = offline.map((project) => project.id);
    const updated = await sql`
      UPDATE ai_projects
      SET status = 'active', last_error = NULL, model_id = ${model}, updated_at = now()
      WHERE id = ANY(${ids}::uuid[]) AND status = 'offline'
      RETURNING id, name, status
    `;
    for (const project of updated) {
      await sql`INSERT INTO agent_events (project_id, event_type, message, payload)
        VALUES (${project.id}::uuid, 'project.bulk_reactivated', 'Project brought back online after AI gateway verification.', ${JSON.stringify({ model })}::jsonb)`;
    }
    return NextResponse.json({
      reactivated: updated.length,
      projects: updated,
      model,
      message: `${updated.length} project(s) are back online.`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reactivate offline projects.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
