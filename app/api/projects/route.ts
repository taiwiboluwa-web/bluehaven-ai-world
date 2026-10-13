import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const templates: Record<string, { agentType: string; kind: string; width: number; depth: number }> = {
  "Document Question-Answering Agent": { agentType: "document_qa", kind: "DOCUMENT AI", width: 2, depth: 2 },
  "Web Research Scout": { agentType: "web_research", kind: "WEB RESEARCH", width: 2, depth: 2 },
  "AI Workflow Forge": { agentType: "workflow", kind: "AI WORKFLOW", width: 3, depth: 3 },
  "API Integration Gateway": { agentType: "api_integration", kind: "API INTEGRATION", width: 2, depth: 2 },
  "Custom AI Agent": { agentType: "custom", kind: "CUSTOM AGENT", width: 2, depth: 2 },
};

function serialize(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    purpose: row.purpose,
    template: row.template,
    agentType: row.agent_type,
    kind: row.kind ?? templates[String(row.template)]?.kind ?? "AI AGENT",
    status: row.status,
    description: row.purpose,
    tone: row.tone ?? "violet",
    gridX: row.grid_x,
    gridZ: row.grid_z,
    footprintWidth: row.footprint_width,
    footprintDepth: row.footprint_depth,
    modelId: row.model_id,
    provider: row.provider,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastError: row.last_error,
  };
}

export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql`SELECT p.*, CASE WHEN p.agent_type = 'document_qa' THEN 'gold' WHEN p.agent_type = 'web_research' THEN 'mint' ELSE 'violet' END AS tone FROM ai_projects p ORDER BY p.created_at ASC`;
    return NextResponse.json({ projects: rows.map((row) => serialize(row as Record<string, unknown>)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load projects.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: string; purpose?: string; template?: string; gridX?: number; gridZ?: number };
    const name = body.name?.trim();
    const purpose = body.purpose?.trim();
    const template = body.template?.trim() || "Document Question-Answering Agent";

    if (!name || name.length > 80) {
      return NextResponse.json({ error: "Project name is required and must be 80 characters or fewer." }, { status: 400 });
    }
    if (!purpose || purpose.length > 2000) {
      return NextResponse.json({ error: "Describe what the agent should do (maximum 2,000 characters)." }, { status: 400 });
    }
    const definition = templates[template];
    if (!definition) {
      return NextResponse.json({ error: "Choose a supported starting template." }, { status: 400 });
    }

    const sql = getSql();
    const existing = await sql`SELECT grid_x, grid_z FROM ai_projects WHERE status <> 'offline' ORDER BY created_at`;
    const candidatePlots = [[-2,-1],[2,-1],[-2,2],[2,2],[0,-3],[0,3],[-4,0],[4,0],[-4,-3],[4,3],[-4,3],[4,-3],[0,5],[0,-5]];
    const occupied = new Set(existing.map((row) => `${row.grid_x},${row.grid_z}`));
    let plot: number[] | undefined;
    if (typeof body.gridX === "number" || typeof body.gridZ === "number") {
      const requested = candidatePlots.find(([x, z]) => x === body.gridX && z === body.gridZ);
      if (!requested) {
        return NextResponse.json({ error: "Choose a valid village plot from the available map coordinates." }, { status: 400 });
      }
      if (occupied.has(`${requested[0]},${requested[1]}`)) {
        return NextResponse.json({ error: "That plot has already been claimed. Choose another plot or use automatic placement." }, { status: 409 });
      }
      plot = requested;
    } else {
      plot = candidatePlots.find(([x,z]) => !occupied.has(`${x},${z}`));
    }
    if (!plot) {
      return NextResponse.json({ error: "The village has no free building plots. Expand the village before adding another project." }, { status: 409 });
    }

    const inserted = await sql`
      INSERT INTO ai_projects (name, purpose, template, agent_type, status, grid_x, grid_z, footprint_width, footprint_depth)
      VALUES (${name}, ${purpose}, ${template}, ${definition.agentType}, 'under_construction', ${plot[0]}, ${plot[1]}, ${definition.width}, ${definition.depth})
      RETURNING *
    `;
    const project = inserted[0] as Record<string, unknown>;
    const jobs = await sql`
      INSERT INTO agent_jobs (project_id, job_type, status, progress, input)
      VALUES (${project.id}, 'provision', 'queued', 0, ${JSON.stringify({ template, purpose })}::jsonb)
      RETURNING id
    `;
    await sql`
      INSERT INTO agent_events (project_id, job_id, event_type, message, payload)
      VALUES (${project.id}, ${jobs[0].id}, 'construction.queued', 'Builder assigned; project saved to the village.', ${JSON.stringify({ gridX: plot[0], gridZ: plot[1] })}::jsonb)
    `;
    return NextResponse.json({ project: serialize(project), jobId: jobs[0].id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create the project.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
