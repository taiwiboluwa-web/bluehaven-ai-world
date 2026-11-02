import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const value = request.headers.get("authorization");
  return Boolean(value && (
    (process.env.CHO_ADMIN_TOKEN && value === `Bearer ${process.env.CHO_ADMIN_TOKEN}`) ||
    (process.env.AGENT_SERVICE_TOKEN && value === `Bearer ${process.env.AGENT_SERVICE_TOKEN}`)
  ));
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Valid CHO or agent service authorization is required." }, { status: 401 });
  }

  try {
    const sql = getSql();
    const rows = await sql`
      SELECT j.id, j.project_id, p.name AS project_name, j.engine, j.engine_task_id,
             j.job_type, j.status, j.progress, j.input, j.output, j.error_code,
             j.error_message, j.estimated_cost_usd, j.actual_cost_usd,
             j.created_at, j.updated_at, j.started_at, j.finished_at
      FROM video_jobs j
      JOIN video_projects p ON p.id = j.project_id
      JOIN video_workspaces w ON w.id = j.workspace_id
      WHERE w.slug = 'bluehaven-studios'
      ORDER BY j.created_at DESC
      LIMIT 50
    `;
    return NextResponse.json({ jobs: rows });
  } catch {
    return NextResponse.json({ error: "Video job storage is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Valid CHO or agent service authorization is required." }, { status: 401 });
  }

  let body: {
    projectId?: string;
    subject?: string;
    script?: string;
    aspectRatio?: string;
    videoCount?: number;
    source?: string;
    voice?: string;
    subtitles?: boolean;
  };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 });
  }

  const projectId = body.projectId?.trim() || "";
  const subject = body.subject?.trim() || "";
  const script = body.script?.trim() || "";
  const aspectRatio = body.aspectRatio || "9:16";
  const videoCount = Number(body.videoCount ?? 1);
  const allowedRatios = new Set(["9:16", "16:9", "1:1"]);
  if (!/^[0-9a-f-]{36}$/i.test(projectId) ||
      (!subject && !script) ||
      subject.length > 240 ||
      script.length > 12000 ||
      !allowedRatios.has(aspectRatio) ||
      !Number.isInteger(videoCount) || videoCount < 1 || videoCount > 5) {
    return NextResponse.json({
      error: "Provide a valid projectId, a subject or script, a supported aspect ratio, and 1–5 video variants.",
    }, { status: 400 });
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.slice(0, 128) || crypto.randomUUID();

  try {
    const sql = getSql();
    const projects = await sql`
      SELECT p.id, p.workspace_id
      FROM video_projects p
      JOIN video_workspaces w ON w.id = p.workspace_id
      WHERE p.id = ${projectId}::uuid
        AND w.slug = 'bluehaven-studios'
        AND p.status = 'active'
      LIMIT 1
    `;
    if (!projects.length) {
      return NextResponse.json({ error: "Active video project not found in the BlueHaven workspace." }, { status: 404 });
    }

    const input = {
      video_subject: subject,
      video_script: script,
      video_aspect: aspectRatio,
      video_count: videoCount,
      video_source: body.source || "pexels",
      voice_name: body.voice || "",
      subtitle_enabled: body.subtitles !== false,
    };

    const rows = await sql`
      INSERT INTO video_jobs (
        workspace_id, project_id, engine, job_type, status, progress,
        input, idempotency_key, created_by
      )
      VALUES (
        ${projects[0].workspace_id}::uuid, ${projectId}::uuid,
        'moneyprinterturbo', 'script_to_video', 'draft', 0,
        ${JSON.stringify(input)}::jsonb, ${idempotencyKey}, 'CHO'
      )
      ON CONFLICT (workspace_id, idempotency_key) DO NOTHING
      RETURNING id, project_id, status, progress, input, created_at
    `;

    const job = rows[0] || (await sql`
      SELECT id, project_id, status, progress, input, created_at
      FROM video_jobs
      WHERE workspace_id = ${projects[0].workspace_id}::uuid
        AND idempotency_key = ${idempotencyKey}
      LIMIT 1
    `)[0];

    if (rows.length) {
      await sql`
        INSERT INTO video_job_events (workspace_id, job_id, event_type, message, payload)
        VALUES (
          ${projects[0].workspace_id}::uuid, ${job.id}::uuid,
          'video.job.draft_created', 'A video production draft was created.',
          ${JSON.stringify({ aspectRatio, videoCount })}::jsonb
        )
      `;
    }

    return NextResponse.json({
      job,
      engine: "not_connected",
      nextStep: "Connect and verify the private MoneyPrinterTurbo worker before submitting this draft for generation.",
      generationStarted: false,
    }, { status: rows.length ? 201 : 200 });
  } catch {
    return NextResponse.json({ error: "The video production draft could not be saved." }, { status: 503 });
  }
}
