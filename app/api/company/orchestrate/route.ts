import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Agent = { id: string; name: string; department: string; role_description: string; system_prompt: string; model_id: string | null };
type GatewayReply = { choices?: { message?: { content?: string | null } }[]; error?: { message?: string } };

function authorized(request: Request) {
  const value = request.headers.get("authorization");
  return Boolean(value && (
    (process.env.AGENT_SERVICE_TOKEN && value === `Bearer ${process.env.AGENT_SERVICE_TOKEN}`) ||
    (process.env.CHO_ADMIN_TOKEN && value === `Bearer ${process.env.CHO_ADMIN_TOKEN}`)
  ));
}

async function askAgent(agent: Agent, goal: string, context: string) {
  const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.OPENROUTER_API_KEY;
  const model = agent.model_id || process.env.AI_DEFAULT_MODEL;
  if (!apiKey || !model) throw new Error("AI gateway is not configured. Set AI_GATEWAY_API_KEY and AI_DEFAULT_MODEL in Vercel.");
  const baseUrl = (process.env.AI_GATEWAY_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.25,
      messages: [
        { role: "system", content: `${agent.system_prompt}\n\nYou are operating as ${agent.name}, ${agent.department} lead in BlueHaven AI World. Do real intellectual work on the supplied task. Return a useful deliverable, concrete next steps, assumptions, and risks. Never claim you changed files, contacted people, browsed live websites, or performed external actions unless a connected tool explicitly did so. If work depends on tools not available to you, clearly mark it as a recommendation or blocked action.` },
        { role: "user", content: `Company goal:\n${goal}\n\nCoordination brief:\n${context}\n\nProduce your department's contribution as a concise, directly usable work product. Reference dependencies or decisions needed from other departments.` }
      ]
    }),
    signal: AbortSignal.timeout(60000)
  });
  const payload = await response.json() as GatewayReply;
  if (!response.ok) throw new Error(payload.error?.message || `Model gateway returned HTTP ${response.status}.`);
  const output = payload.choices?.[0]?.message?.content?.trim();
  if (!output) throw new Error("The model returned an empty result.");
  return { output, model };
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "This action requires a valid CHO or agent service token." }, { status: 401 });
  let body: { goal?: string; agentNames?: string[]; dispatchMode?: "auto" | "manual" };
  try { body = await request.json() as { goal?: string; agentNames?: string[] }; }
  catch { return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 }); }

  const goal = body.goal?.trim() || "";
  if (goal.length < 12 || goal.length > 6000) {
    return NextResponse.json({ error: "Describe the goal in 12–6,000 characters so the team has enough context." }, { status: 400 });
  }
  const dispatchMode = body.dispatchMode === "manual" ? "manual" : "auto";
  const requestedNames = Array.isArray(body.agentNames) ? [...new Set(body.agentNames.map((n) => String(n).trim()))].slice(0, 4) : [];

  try {
    const sql = getSql();
    const found = await sql`SELECT id, name, department, role_description, system_prompt, model_id FROM company_agents ORDER BY name`;
    const roster = found as Agent[];
    const atlas = roster.find((a) => a.name === "Atlas");
    if (!atlas) return NextResponse.json({ error: "Atlas is missing from the company roster, so coordination cannot start." }, { status: 503 });

    let agents: Agent[] = [];
    let routingNote = "Manual selection";
    if (dispatchMode === "manual") {
      if (requestedNames.length < 2) return NextResponse.json({ error: "Choose at least two agents for manual collaboration." }, { status: 400 });
      agents = requestedNames.map((name) => roster.find((agent) => agent.name === name)).filter((agent): agent is Agent => Boolean(agent));
      if (agents.length !== requestedNames.length) return NextResponse.json({ error: "One or more selected agents are not registered in the company roster." }, { status: 400 });
    } else {
      const routingPrompt = [
        "Select the best 1 to 4 specialist agents to execute the user's goal. Atlas will separately coordinate the mission.",
        "Return ONLY valid JSON in this exact shape: {\\"agents\\":[\\"Forge\\",\\"Quinn\\"],\\"reason\\":\\"short reason\\"}.",
        "Use only these registered agents; choose by task fit, not by popularity:",
        ...roster.map((a) => `- ${a.name} | ${a.department} | ${a.role_description}`),
        "Choose the smallest team that can do excellent work. Include Echo for communications/social copy, Pixel for visual/media work, Forge for code, Piper for automation, Quinn for security/QA, Scout/Nova for research, Sage for knowledge/document work, Orbit for analytics/operations, and Atlas only if strategy itself is a key deliverable."
      ].join("\n");
      try {
        const routed = await askAgent(atlas, routingPrompt, "You are the task dispatcher. Route the prompt only; do not complete the task.");
        const jsonText = routed.output.match(/\\{[\\s\\S]*\\}/)?.[0];
        const parsed = jsonText ? JSON.parse(jsonText) as { agents?: unknown; reason?: unknown } : {};
        const names = Array.isArray(parsed.agents) ? [...new Set(parsed.agents.filter((v): v is string => typeof v === "string"))].slice(0, 4) : [];
        agents = names.map((name) => roster.find((agent) => agent.name === name)).filter((agent): agent is Agent => Boolean(agent));
        routingNote = typeof parsed.reason === "string" ? parsed.reason.slice(0, 500) : "Selected by Atlas based on task fit.";
      } catch {
        const textGoal = goal.toLowerCase();
        const fallbackNames = [
          ...( /\\b(code|bug|deploy|api|website|build|software|github)\\b/.test(textGoal) ? ["Forge"] : []),
          ...( /\\b(security|test|audit|risk|qa|review)\\b/.test(textGoal) ? ["Quinn"] : []),
          ...( /\\b(social|publish|campaign|caption|marketing|brand|email|content)\\b/.test(textGoal) ? ["Echo"] : []),
          ...( /\\b(design|image|video|visual|creative|thumbnail)\\b/.test(textGoal) ? ["Pixel"] : []),
          ...( /\\b(research|competitor|source|find|investigate|web)\\b/.test(textGoal) ? ["Scout", "Nova"] : []),
          ...( /\\b(automate|workflow|integration|schedule)\\b/.test(textGoal) ? ["Piper"] : []),
          ...( /\\b(data|metrics|analytics|report|operations)\\b/.test(textGoal) ? ["Orbit"] : []),
          ...( /\\b(document|knowledge|manual|guide|resource)\\b/.test(textGoal) ? ["Sage"] : [])
        ];
        const unique = [...new Set(fallbackNames)].slice(0, 4);
        agents = (unique.length ? unique : ["Atlas", "Forge"]).map((name) => roster.find((agent) => agent.name === name)).filter((agent): agent is Agent => Boolean(agent));
        routingNote = "Keyword-based fallback routing used because the model router did not return valid JSON.";
      }
      if (!agents.length) agents = roster.filter((agent) => ["Forge", "Echo"].includes(agent.name));
    }
    if (!agents.length) return NextResponse.json({ error: "No eligible agents could be selected from the standby roster." }, { status: 503 });

    const coordination = await askAgent(atlas, goal, "Act as the coordination lead. Create a short execution brief: desired outcome, workstreams, dependencies, quality criteria, and risks. Do not do the other departments' work.");
    const parentRows = await sql`INSERT INTO company_tasks (title, description, department_agent_id, created_by, status, priority, started_at) VALUES (${("Collaborative mission: " + goal).slice(0,180)}, ${goal}, ${atlas.id}, 'CHO / Orchestrator', 'in_progress', 'high', now()) RETURNING id, title`;
    const parentId = String(parentRows[0].id);
    await sql`INSERT INTO company_audit_events (actor_type, actor_name, event_type, message, entity_type, entity_id, payload) VALUES ('system', 'BlueHaven Orchestrator', 'orchestration.started', 'A multi-agent mission was started.', 'company_task', ${parentId}::uuid, ${JSON.stringify({ goal, dispatchMode, routingNote, agents: agents.map((a) => a.name), standbyAgents: roster.filter((a) => !agents.some((picked) => picked.id === a.id)).map((a) => a.name) })}::jsonb)`;

    const results: { agent: string; department: string; taskId: string; status: "completed" | "failed"; output?: string; error?: string; model?: string }[] = [];
    let sharedContext = coordination.output;
    for (const agent of agents) {
      const taskTitle = (agent.name + " contribution: " + goal).slice(0, 180);
      const taskRows = await sql`INSERT INTO company_tasks (title, description, department_agent_id, created_by, status, priority, started_at) VALUES (${taskTitle}, ${goal + "\n\nCoordination brief:\n" + coordination.output}, ${agent.id}, 'BlueHaven Orchestrator', 'in_progress', 'high', now()) RETURNING id`;
      const taskId = String(taskRows[0].id);
      await sql`UPDATE company_agents SET status = 'working', updated_at = now() WHERE id = ${agent.id}`;
      try {
        const result = await askAgent(agent, goal, sharedContext);
        await sql`UPDATE company_tasks SET status = 'completed', result_summary = ${result.output.slice(0, 8000)}, completed_at = now(), updated_at = now() WHERE id = ${taskId}::uuid`;
        await sql`INSERT INTO company_audit_events (actor_type, actor_name, event_type, message, entity_type, entity_id, payload) VALUES ('agent', ${agent.name}, 'orchestration.contribution.completed', ${agent.name + ' completed a contribution.'}, 'company_task', ${taskId}::uuid, ${JSON.stringify({ model: result.model, parentId })}::jsonb)`;
        results.push({ agent: agent.name, department: agent.department, taskId, status: "completed", output: result.output, model: result.model });
        sharedContext += `\\n\\n--- ${agent.name} / ${agent.department} contribution ---\\n${result.output.slice(0, 5000)}`;
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Agent execution failed.";
        await sql`UPDATE company_tasks SET status = 'failed', result_summary = ${reason.slice(0, 8000)}, completed_at = now(), updated_at = now() WHERE id = ${taskId}::uuid`;
        await sql`INSERT INTO company_audit_events (actor_type, actor_name, event_type, message, entity_type, entity_id, payload) VALUES ('agent', ${agent.name}, 'orchestration.contribution.failed', ${agent.name + ' contribution failed: ' + reason.slice(0, 500)}, 'company_task', ${taskId}::uuid, ${JSON.stringify({ parentId })}::jsonb)`;
        results.push({ agent: agent.name, department: agent.department, taskId, status: "failed", error: reason });
      } finally {
        await sql`UPDATE company_agents SET status = 'idle', updated_at = now() WHERE id = ${agent.id} AND status = 'working'`;
      }
    }

    const succeeded = results.filter((r) => r.status === "completed").length;
    const finalStatus = succeeded === results.length ? "completed" : succeeded > 0 ? "blocked" : "failed";
    const summary = results.map((r) => `${r.agent}: ${r.status}${r.error ? " — " + r.error : ""}`).join("\n");
    await sql`UPDATE company_tasks SET status = ${finalStatus}, result_summary = ${("Coordination brief:\n" + coordination.output + "\n\nAgent outcomes:\n" + summary).slice(0,8000)}, completed_at = now(), updated_at = now() WHERE id = ${parentId}::uuid`;
    await sql`INSERT INTO company_audit_events (actor_type, actor_name, event_type, message, entity_type, entity_id, payload) VALUES ('system', 'BlueHaven Orchestrator', 'orchestration.finished', ${"Mission finished: " + succeeded + " of " + results.length + " agent contributions succeeded."}, 'company_task', ${parentId}::uuid, ${JSON.stringify({ succeeded, total: results.length })}::jsonb)`;
    return NextResponse.json({ missionId: parentId, goal, dispatchMode, routingNote, selectedAgents: agents.map((a) => a.name), standbyAgents: roster.filter((a) => !agents.some((picked) => picked.id === a.id)).map((a) => a.name), coordinationBrief: coordination.output, status: finalStatus, succeeded, total: results.length, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The collaborative mission could not run.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
