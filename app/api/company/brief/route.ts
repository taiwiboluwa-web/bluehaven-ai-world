import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET || process.env.AGENT_SERVICE_TOKEN;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Daily brief generation requires an authorized scheduler or service token." }, { status: 401 });
  }

  try {
    const sql = getSql();
    const dateRows = await sql`SELECT (now() AT TIME ZONE 'Africa/Lagos')::date::text AS local_date`;
    const date = String(dateRows[0].local_date);
    const [tasks, agentStats, hiring, events, counts] = await Promise.all([
      sql`SELECT t.id, t.title, t.description, t.status, t.priority, t.created_by, t.result_summary, t.created_at, t.started_at, t.completed_at, a.name AS agent_name, a.department, w.name AS worker_name FROM company_tasks t LEFT JOIN company_agents a ON a.id = t.department_agent_id LEFT JOIN company_workers w ON w.id = t.worker_id WHERE (t.created_at AT TIME ZONE 'Africa/Lagos')::date = ${date}::date OR (t.updated_at AT TIME ZONE 'Africa/Lagos')::date = ${date}::date ORDER BY t.created_at ASC`,
      sql`SELECT a.name, a.department, a.status, COUNT(t.id)::int AS tasks_today, COUNT(t.id) FILTER (WHERE t.status = 'completed')::int AS completed_today FROM company_agents a LEFT JOIN company_tasks t ON t.department_agent_id = a.id AND ((t.created_at AT TIME ZONE 'Africa/Lagos')::date = ${date}::date OR (t.updated_at AT TIME ZONE 'Africa/Lagos')::date = ${date}::date) GROUP BY a.id ORDER BY a.name`,
      sql`SELECT h.proposed_name, h.role_title, h.status, h.matthew_decision_note, h.cho_decision_note, h.created_at, a.name AS agent_name FROM hiring_requests h JOIN company_agents a ON a.id = h.department_agent_id WHERE (h.created_at AT TIME ZONE 'Africa/Lagos')::date = ${date}::date OR (h.updated_at AT TIME ZONE 'Africa/Lagos')::date = ${date}::date ORDER BY h.created_at ASC`,
      sql`SELECT actor_type, actor_name, event_type, message, entity_type, created_at FROM company_audit_events WHERE (created_at AT TIME ZONE 'Africa/Lagos')::date = ${date}::date ORDER BY created_at ASC LIMIT 500`,
      sql`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'completed')::int AS completed, COUNT(*) FILTER (WHERE status = 'failed')::int AS failed, COUNT(*) FILTER (WHERE status = 'blocked')::int AS blocked FROM company_tasks WHERE (created_at AT TIME ZONE 'Africa/Lagos')::date = ${date}::date OR (updated_at AT TIME ZONE 'Africa/Lagos')::date = ${date}::date`,
    ]);

    const c = counts[0] as { total: number; completed: number; failed: number; blocked: number };
    const hiringCounts = {
      requested: hiring.length,
      waitingForMatthew: hiring.filter((item) => item.status === "pending_matthew").length,
      waitingForCho: hiring.filter((item) => ["pending_cho", "rejected_by_matthew"].includes(String(item.status))).length,
      hired: hiring.filter((item) => item.status === "hired").length,
      rejected: hiring.filter((item) => ["rejected_by_matthew", "rejected_by_cho"].includes(String(item.status))).length,
    };
    const summary = [
      `BlueHaven AI World daily brief for ${date} (Africa/Lagos).`,
      `Tasks touched today: ${c.total}; completed: ${c.completed}; failed: ${c.failed}; blocked: ${c.blocked}.`,
      `Hiring requests: ${hiringCounts.requested}; waiting for Matthew: ${hiringCounts.waitingForMatthew}; waiting for CHO: ${hiringCounts.waitingForCho}; hired: ${hiringCounts.hired}; rejected: ${hiringCounts.rejected}.`,
      `Recorded company events: ${events.length}. Every task and audit event below is included for review.`,
    ].join("\n\n");

    const saved = await sql`INSERT INTO daily_briefs (brief_date, generated_at, summary, tasks_total, tasks_completed, tasks_failed, tasks_blocked, hiring_summary, agent_summary, notable_events)
      VALUES (${date}::date, now(), ${summary}, ${c.total}, ${c.completed}, ${c.failed}, ${c.blocked}, ${JSON.stringify(hiringCounts)}::jsonb, ${JSON.stringify(agentStats)}::jsonb, ${JSON.stringify({ tasks, hiringRequests: hiring, auditEvents: events })}::jsonb)
      ON CONFLICT (brief_date) DO UPDATE SET generated_at = now(), summary = EXCLUDED.summary, tasks_total = EXCLUDED.tasks_total, tasks_completed = EXCLUDED.tasks_completed, tasks_failed = EXCLUDED.tasks_failed, tasks_blocked = EXCLUDED.tasks_blocked, hiring_summary = EXCLUDED.hiring_summary, agent_summary = EXCLUDED.agent_summary, notable_events = EXCLUDED.notable_events
      RETURNING *`;
    return NextResponse.json({ brief: saved[0], taskRowsIncluded: tasks.length, auditEventsIncluded: events.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate the daily brief.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
