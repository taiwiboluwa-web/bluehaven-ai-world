import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const serviceToken = process.env.AGENT_SERVICE_TOKEN;
  if (!serviceToken) return NextResponse.json({ error: "Agent execution is disabled until AGENT_SERVICE_TOKEN is configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${serviceToken}`) return NextResponse.json({ error: "Unauthorized agent execution request." }, { status: 401 });
  try {
    const body = await request.json() as { projectId?: string; input?: string; model?: string };
    const projectId = body.projectId;
    const input = body.input?.trim();
    if (!projectId || !input || input.length > 12000) {
      return NextResponse.json({ error: "projectId and an input of up to 12,000 characters are required." }, { status: 400 });
    }

    const useVercelAdapter = process.env.OMNIROUTE_VERCEL_NATIVE === "true";
    const providerKey = process.env.OMNIROUTE_UPSTREAM_API_KEY
      || process.env.AI_GATEWAY_API_KEY
      || process.env.OPENROUTER_API_KEY;
    const serviceBase = process.env.OMNIROUTE_VERCEL_BASE_URL
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    const baseUrl = useVercelAdapter
      ? `${serviceBase.replace(/\/$/, "")}/api/omniroute/v1`
      : (process.env.AI_GATEWAY_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
    const apiKey = useVercelAdapter ? serviceToken : providerKey;
    const model = body.model || process.env.AI_DEFAULT_MODEL;
    if (!apiKey || !model || (useVercelAdapter && !serviceBase) || !providerKey) {
      return NextResponse.json({
        error: "AI gateway is not configured. Set AI_DEFAULT_MODEL and an upstream provider key. For the Vercel-native adapter, set OMNIROUTE_VERCEL_NATIVE=true and ensure Vercel provides VERCEL_PROJECT_PRODUCTION_URL or VERCEL_URL (or set OMNIROUTE_VERCEL_BASE_URL).",
        configurationRequired: true,
      }, { status: 503 });
    }

    const sql = getSql();
    const rows = await sql`SELECT id, name, purpose, status FROM ai_projects WHERE id = ${projectId}::uuid LIMIT 1`;
    if (!rows.length) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const project = rows[0] as { id: string; name: string; purpose: string; status: string };
    if (project.status !== "active" && project.status !== "processing") {
      return NextResponse.json({ error: `This building is ${project.status}.` + " Activate it successfully before running the agent." }, { status: 409 });
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
      signal: AbortSignal.timeout(55000),
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
