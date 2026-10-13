import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const sql = getSql();
    const rows = await sql`SELECT id, name, status FROM ai_projects WHERE id = ${id}::uuid LIMIT 1`;
    if (!rows.length) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const project = rows[0] as { id: string; name: string; status: string };
    if (project.status === "active") return NextResponse.json({ status: "active", message: "Building is already operational." });

    const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.OPENROUTER_API_KEY;
    const model = process.env.AI_DEFAULT_MODEL;
    if (!apiKey || !model) {
      const message = "Project saved, but activation is waiting for AI_GATEWAY_API_KEY and AI_DEFAULT_MODEL in the server environment.";
      await sql`UPDATE ai_projects SET status = 'failed', last_error = ${message}, updated_at = now() WHERE id = ${id}::uuid`;
      await sql`UPDATE agent_jobs SET status = 'failed', error = ${message}, finished_at = now(), updated_at = now() WHERE project_id = ${id}::uuid AND status = 'queued'`;
      await sql`INSERT INTO agent_events (project_id, event_type, message) VALUES (${id}::uuid, 'construction.blocked', ${message})`;
      return NextResponse.json({ status: "failed", error: message, configurationRequired: true }, { status: 409 });
    }

    await sql`UPDATE ai_projects SET status = 'initializing', last_error = NULL, updated_at = now() WHERE id = ${id}::uuid`;
    await sql`UPDATE agent_jobs SET status = 'running', progress = 70, started_at = COALESCE(started_at, now()), updated_at = now() WHERE project_id = ${id}::uuid AND status = 'queued'`;
    const baseUrl = (process.env.AI_GATEWAY_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
    // Validate the gateway and selected model without spending tokens on a billable chat completion.
    const response = await fetch(`${baseUrl}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    const data = await response.json() as { data?: { id?: string }[]; error?: { message?: string } };
    const modelAvailable = data.data?.some((entry) => entry.id === model);
    if (!response.ok || !modelAvailable) {
      const message = data.error?.message || (response.ok ? `Configured model "${model}" was not listed by the gateway.` : `AI gateway check failed (HTTP ${response.status}).`);
      await sql`UPDATE ai_projects SET status = 'failed', last_error = ${message}, updated_at = now() WHERE id = ${id}::uuid`;
      await sql`UPDATE agent_jobs SET status = 'failed', error = ${message}, finished_at = now(), updated_at = now() WHERE project_id = ${id}::uuid AND status = 'running'`;
      await sql`INSERT INTO agent_events (project_id, event_type, message) VALUES (${id}::uuid, 'construction.failed', ${message})`;
      return NextResponse.json({ status: "failed", error: message }, { status: 502 });
    }

    await sql`UPDATE ai_projects SET status = 'active', last_error = NULL, model_id = ${model}, updated_at = now() WHERE id = ${id}::uuid`;
    await sql`UPDATE agent_jobs SET status = 'succeeded', progress = 100, output = ${JSON.stringify({ model, gatewayCheck: "passed" })}::jsonb, finished_at = now(), updated_at = now() WHERE project_id = ${id}::uuid AND status = 'running'`;
    await sql`INSERT INTO agent_events (project_id, event_type, message, payload) VALUES (${id}::uuid, 'construction.completed', 'Gateway and model availability check passed; building is operational.', ${JSON.stringify({ model })}::jsonb)`;
    return NextResponse.json({ status: "active", model, message: "Gateway and model verified. Building is operational." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Construction could not be completed.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
