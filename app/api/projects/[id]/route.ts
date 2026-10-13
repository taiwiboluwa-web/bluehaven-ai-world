import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const sql = getSql();
    const projects = await sql`SELECT * FROM ai_projects WHERE id = ${id}::uuid LIMIT 1`;
    if (!projects.length) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const jobs = await sql`SELECT id, job_type, status, progress, error, created_at, updated_at FROM agent_jobs WHERE project_id = ${id}::uuid ORDER BY created_at DESC LIMIT 20`;
    const events = await sql`SELECT id, event_type, message, payload, created_at FROM agent_events WHERE project_id = ${id}::uuid ORDER BY created_at DESC LIMIT 50`;
    return NextResponse.json({ project: projects[0], jobs, events });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load project.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = await request.json() as { action?: string };
    const sql = getSql();
    const allowed = ["paused", "active", "offline"] as const;
    const nextStatus = body.action === "pause" ? "paused" : body.action === "resume" ? "active" : body.action === "stop" ? "offline" : null;
    if (!nextStatus || !allowed.includes(nextStatus as typeof allowed[number])) {
      return NextResponse.json({ error: "Supported actions are pause, resume, and stop." }, { status: 400 });
    }
    const updated = await sql`UPDATE ai_projects SET status = ${nextStatus}, updated_at = now() WHERE id = ${id}::uuid RETURNING id, status, updated_at`;
    if (!updated.length) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    await sql`INSERT INTO agent_events (project_id, event_type, message) VALUES (${id}::uuid, ${'project.' + body.action}, ${'Project status changed to ' + nextStatus + '.'})`;
    return NextResponse.json({ project: updated[0] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update project.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
