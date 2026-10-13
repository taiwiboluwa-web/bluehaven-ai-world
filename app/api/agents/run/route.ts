import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { projectId?: string; input?: string; model?: string };
    const projectId = body.projectId;
    const input = body.input?.trim();
    if (!projectId || !input || input.length > 12000) {
      return NextResponse.json({ error: "projectId and an input of up to 12,000 characters are required." }, { status: 400 });
    }

    const baseUrl = (process.env.AI_GATEWAY_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
    const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.OPENROUTER_API_KEY;
    const model = body.model || process.env.AI_DEFAULT_MODEL;
    if (!apiKey || !model) {
      return NextResponse.json({
        error: "AI gateway is not configured. Add AI_GATEWAY_API_KEY and AI_DEFAULT_MODEL to the server environment.",
        configurationRequired: true,
      }, { status: 503 });
    }

    const sql = getSql();
    const rows = await sql`SELECT id, name, purpose, status FROM ai_projects WHERE id = ${projectId}::uuid LIMIT 1`;
    if (!rows.length) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const project = rows[0] as { id: string; name: string; purpose: string; status: string };
    if (project.status !== "active" && project.status !== "processing") {
      return NextResponse.json({ error: `This building is ${project.status}. Activate it successfully before running the agent.` }, { status: 409 });
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: `You are the AI agent named "${project.name}" inside BlueHaven AI World. Your assigned purpose is: ${project.purpose}. Be clear about limitations and never claim to have performed actions you did not perform.` },
          { role: "user", content: input },
        ],
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(60000),
    });
    const payload = await response.json() as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
    if (!response.ok) {
      const reason = payload.error?.message || `AI gateway returned HTTP ${response.status}.`;
      await sql`INSERT INTO agent_events (project_id, event_type, message, payload) VALUES (${projectId}::uuid, 'agent.run.failed', ${reason}, ${JSON.stringify({ model, status: response.status })}::jsonb)`;
      return NextResponse.json({ error: reason }, { status: 502 });
    }
    const output = payload.choices?.[0]?.message?.content;
    if (!output) return NextResponse.json({ error: "The model returned no text output." }, { status: 502 });
    await sql`INSERT INTO agent_events (project_id, event_type, message, payload) VALUES (${projectId}::uuid, 'agent.run.completed', 'Agent completed a model request.', ${JSON.stringify({ model, inputLength: input.length })}::jsonb)`;
    return NextResponse.json({ output, model });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent execution failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
