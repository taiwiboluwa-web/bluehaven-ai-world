import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request, envName: string) {
  const secret = process.env[envName];
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

function unauthorized() {
  return NextResponse.json({ error: "This company action requires its authorized service credential." }, { status: 401 });
}

export async function GET() {
  try {
    const sql = getSql();
    const [people, agents, workers, tasks, hiring, notifications, briefs] = await Promise.all([
      sql`SELECT full_name AS name, title, authority_level AS authority, active FROM company_people WHERE active = true ORDER BY CASE authority_level WHEN 'cho' THEN 0 ELSE 1 END`,
      sql`SELECT id, name, department, role_description, status, model_id, connector_id, created_at, updated_at FROM company_agents ORDER BY name`,
      sql`SELECT w.id, w.name, w.role_title, w.status, w.hired_at, a.name AS manager_name, a.department FROM company_workers w JOIN company_agents a ON a.id = w.department_agent_id ORDER BY w.created_at DESC LIMIT 100`,
      sql`SELECT t.id, t.title, t.description, t.created_by, t.status, t.priority, t.result_summary, t.started_at, t.completed_at, t.created_at, a.name AS agent_name, a.department, w.name AS worker_name FROM company_tasks t LEFT JOIN company_agents a ON a.id = t.department_agent_id LEFT JOIN company_workers w ON w.id = t.worker_id ORDER BY t.created_at DESC LIMIT 100`,
      sql`SELECT h.id, h.proposed_name, h.role_title, h.business_case, h.estimated_monthly_cost, h.status, h.matthew_decision_note, h.cho_decision_note, h.created_at, a.name AS agent_name, a.department FROM hiring_requests h JOIN company_agents a ON a.id = h.department_agent_id ORDER BY h.created_at DESC LIMIT 50`,
      sql`SELECT id, notification_type, title, message, related_hiring_request_id, read_at, created_at FROM company_notifications WHERE recipient_role = 'cho' ORDER BY created_at DESC LIMIT 50`,
      sql`SELECT * FROM daily_briefs ORDER BY brief_date DESC LIMIT 7`,
    ]);
    return NextResponse.json({
      people, agents, workers, tasks, hiringRequests: hiring, notifications,
      dailyBriefs: briefs,
      connector: { id: "universal", configured: Boolean(process.env.AI_GATEWAY_API_KEY || process.env.OPENROUTER_API_KEY), modelConfigured: Boolean(process.env.AI_DEFAULT_MODEL) },
      policy: {
        workerCreationRequiresMatthewReview: true,
        workerCreationRequiresChoApproval: true,
        matthewRejectionNotifiesCho: true,
        sharedConnectorId: "universal",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load the company workspace.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 });
  }

  const action = String(body.action || "");
  if (action === "create_task" && !authorized(request, "AGENT_SERVICE_TOKEN") && !authorized(request, "CHO_ADMIN_TOKEN")) return unauthorized();
  if (["complete_task", "request_hire"].includes(action) && !authorized(request, "AGENT_SERVICE_TOKEN")) return unauthorized();
  if (action === "matthew_review" && !authorized(request, "MATTHEW_SERVICE_TOKEN")) return unauthorized();
  if (action === "cho_decision" && !authorized(request, "CHO_ADMIN_TOKEN")) return unauthorized();

  try {
    const sql = getSql();

    if (action === "create_task") {
      const title = String(body.title || "").trim();
      const description = String(body.description || "").trim();
      const agentName = String(body.agentName || "").trim();
      const priority = String(body.priority || "normal");
      if (!title || title.length > 180 || description.length > 5000) return NextResponse.json({ error: "A task title (max 180 characters) and description (max 5,000 characters) are required." }, { status: 400 });
      if (!["low", "normal", "high", "urgent"].includes(priority)) return NextResponse.json({ error: "Invalid task priority." }, { status: 400 });
      const agents = await sql`SELECT id, name FROM company_agents WHERE name = ${agentName} LIMIT 1`;
      if (!agents.length) return NextResponse.json({ error: "Choose one of the registered department agents." }, { status: 404 });
      const rows = await sql`INSERT INTO company_tasks (title, description, department_agent_id, created_by, priority) VALUES (${title}, ${description}, ${agents[0].id}, ${String(body.createdBy || "Matthew").slice(0,80)}, ${priority}) RETURNING *`;
      await sql`INSERT INTO company_audit_events (actor_type, actor_name, event_type, message, entity_type, entity_id) VALUES ('agent', ${String(body.createdBy || "Matthew").slice(0,80)}, 'task.created', ${"Created task: " + title}, 'company_task', ${rows[0].id})`;
      return NextResponse.json({ task: rows[0] }, { status: 201 });
    }

    if (action === "complete_task") {
      const taskId = String(body.taskId || "");
      const status = String(body.status || "completed");
      if (!["completed", "failed", "blocked", "in_progress", "cancelled"].includes(status)) return NextResponse.json({ error: "Invalid task status." }, { status: 400 });
      const summary = String(body.resultSummary || "").slice(0,8000);
      const rows = await sql`UPDATE company_tasks SET status = ${status}, result_summary = ${summary}, started_at = CASE WHEN ${status} = 'in_progress' THEN COALESCE(started_at, now()) ELSE started_at END, completed_at = CASE WHEN ${status} IN ('completed','failed','cancelled') THEN now() ELSE NULL END, updated_at = now() WHERE id = ${taskId}::uuid RETURNING *`;
      if (!rows.length) return NextResponse.json({ error: "Task not found." }, { status: 404 });
      await sql`INSERT INTO company_audit_events (actor_type, actor_name, event_type, message, entity_type, entity_id, payload) VALUES ('agent', ${String(body.actorName || "Agent").slice(0,80)}, ${"task." + status}, ${"Task status changed: " + rows[0].title}, 'company_task', ${rows[0].id}, ${JSON.stringify({ status, summary })}::jsonb)`;
      return NextResponse.json({ task: rows[0] });
    }

    if (action === "request_hire") {
      const agentName = String(body.agentName || "").trim();
      const proposedName = String(body.proposedName || "").trim();
      const roleTitle = String(body.roleTitle || "").trim();
      const businessCase = String(body.businessCase || "").trim();
      const cost = Number(body.estimatedMonthlyCost || 0);
      if (!proposedName || proposedName.length > 80 || !roleTitle || roleTitle.length > 120 || businessCase.length < 10 || businessCase.length > 4000 || !Number.isFinite(cost) || cost < 0) {
        return NextResponse.json({ error: "Provide a proposed name, role, a business case (10–4,000 characters), and a valid non-negative estimated monthly cost." }, { status: 400 });
      }
      const agents = await sql`SELECT id, name, department FROM company_agents WHERE name = ${agentName} LIMIT 1`;
      if (!agents.length) return NextResponse.json({ error: "Choose a registered department agent." }, { status: 404 });
      const rows = await sql`INSERT INTO hiring_requests (requested_by_agent_id, department_agent_id, proposed_name, role_title, business_case, estimated_monthly_cost) VALUES (${agents[0].id}, ${agents[0].id}, ${proposedName}, ${roleTitle}, ${businessCase}, ${cost}) RETURNING *`;
      await sql`INSERT INTO company_audit_events (actor_type, actor_name, event_type, message, entity_type, entity_id) VALUES ('agent', ${agentName}, 'hiring.requested', ${agentName + " requested a worker: " + proposedName}, 'hiring_request', ${rows[0].id})`;
      return NextResponse.json({ request: rows[0], status: "pending_matthew", note: "No worker has been created. Matthew must review this request first, and CHO approval is required before hiring." }, { status: 201 });
    }

    if (action === "matthew_review") {
      const requestId = String(body.requestId || "");
      const decision = String(body.decision || "");
      const note = String(body.note || "").slice(0,4000);
      if (!["approve", "reject"].includes(decision)) return NextResponse.json({ error: "Matthew's decision must be approve or reject." }, { status: 400 });
      const rows = await sql`UPDATE hiring_requests SET status = ${decision === "approve" ? "pending_cho" : "rejected_by_matthew"}, matthew_decision_note = ${note}, reviewed_by_matthew_at = now(), updated_at = now() WHERE id = ${requestId}::uuid AND status = 'pending_matthew' RETURNING *`;
      if (!rows.length) return NextResponse.json({ error: "Hiring request not found or already reviewed." }, { status: 409 });
      if (decision === "reject") {
        await sql`INSERT INTO company_notifications (recipient_role, notification_type, title, message, related_hiring_request_id) VALUES ('cho', 'hiring.rejected_by_matthew', 'Matthew declined a hiring request', ${"Matthew declined " + rows[0].proposed_name + " for " + rows[0].role_title + ". CHO review is required. Reason: " + (note || "No reason supplied.")}, ${rows[0].id})`;
      } else {
        await sql`INSERT INTO company_notifications (recipient_role, notification_type, title, message, related_hiring_request_id) VALUES ('cho', 'hiring.pending_cho', 'Hiring request needs your approval', ${"Matthew reviewed and forwarded " + rows[0].proposed_name + " for " + rows[0].role_title + ". No worker is hired until you approve."}, ${rows[0].id})`;
      }
      await sql`INSERT INTO company_audit_events (actor_type, actor_name, event_type, message, entity_type, entity_id, payload) VALUES ('chief_of_staff', 'Matthew', ${"hiring." + decision}, ${"Matthew " + decision + "d the request for " + rows[0].proposed_name}, 'hiring_request', ${rows[0].id}, ${JSON.stringify({ note })}::jsonb)`;
      return NextResponse.json({ request: rows[0], choNotified: true });
    }

    if (action === "cho_decision") {
      const requestId = String(body.requestId || "");
      const decision = String(body.decision || "");
      const note = String(body.note || "").slice(0,4000);
      if (!["approve", "reject"].includes(decision)) return NextResponse.json({ error: "CHO decision must be approve or reject." }, { status: 400 });
      const pending = await sql`SELECT h.*, a.name AS manager_name FROM hiring_requests h JOIN company_agents a ON a.id = h.department_agent_id WHERE h.id = ${requestId}::uuid AND h.status IN ('pending_cho','rejected_by_matthew') LIMIT 1`;
      if (!pending.length) return NextResponse.json({ error: "Hiring request is not awaiting CHO review." }, { status: 409 });
      const h = pending[0] as Record<string, unknown>;
      if (decision === "reject") {
        const updated = await sql`UPDATE hiring_requests SET status = 'rejected_by_cho', cho_decision_note = ${note}, decided_by_cho_at = now(), updated_at = now() WHERE id = ${requestId}::uuid RETURNING *`;
        await sql`INSERT INTO company_audit_events (actor_type, actor_name, event_type, message, entity_type, entity_id, payload) VALUES ('cho', 'CHO', 'hiring.rejected_by_cho', ${"CHO rejected the request for " + String(h.proposed_name)}, 'hiring_request', ${requestId}::uuid, ${JSON.stringify({ note })}::jsonb)`;
        return NextResponse.json({ request: updated[0], hired: false });
      }
      const worker = await sql`INSERT INTO company_workers (name, department_agent_id, role_title, status, hired_at) VALUES (${h.proposed_name}, ${h.department_agent_id}, ${h.role_title}, 'active', now()) RETURNING *`;
      const updated = await sql`UPDATE hiring_requests SET status = 'hired', cho_decision_note = ${note}, decided_by_cho_at = now(), created_worker_id = ${worker[0].id}, updated_at = now() WHERE id = ${requestId}::uuid RETURNING *`;
      await sql`INSERT INTO company_audit_events (actor_type, actor_name, event_type, message, entity_type, entity_id, payload) VALUES ('cho', 'CHO', 'worker.hired', ${"CHO approved and hired " + String(h.proposed_name) + " as " + String(h.role_title)}, 'hiring_request', ${requestId}::uuid, ${JSON.stringify({ workerId: worker[0].id, note })}::jsonb)`;
      return NextResponse.json({ request: updated[0], worker: worker[0], hired: true }, { status: 201 });
    }

    return NextResponse.json({ error: "Supported actions: create_task, complete_task, request_hire, matthew_review, cho_decision." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Company action failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
