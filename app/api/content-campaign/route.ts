import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import roadmapFile from "@/content/campaign-roadmap.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RoadmapDay = { day: number; date: string; theme: string; angle: string; postsTarget: number };
const roadmap = roadmapFile as { campaign: { slug: string; name: string; website: string; timezone: string; startDate: string; durationDays: number; defaultPublishMode: string }; days: RoadmapDay[] };

function isAuthorized(request: Request) {
  const token = process.env.CHO_ADMIN_TOKEN || process.env.CRON_SECRET;
  return Boolean(token && request.headers.get("authorization") === `Bearer ${token}`);
}

export async function GET() {
  try {
    const sql = getSql();
    const campaigns = await sql`SELECT id, slug, name, start_date, duration_days, status, publish_mode, created_at, updated_at FROM content_campaigns ORDER BY created_at DESC LIMIT 10`;
    const stats = await sql`SELECT status, COUNT(*)::int AS count FROM content_campaign_posts GROUP BY status`;
    const nextDays = await sql`SELECT day_number, campaign_date::text, theme, status FROM content_campaign_days WHERE status IN ('planned','failed','partial') ORDER BY campaign_date ASC LIMIT 5`;
    return NextResponse.json({ campaigns, postStatusCounts: stats, nextDays, roadmapDays: roadmap.days.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read campaign status.";
    return NextResponse.json({ error: message, migrationRequired: true, migration: "db/content-campaign-schema.sql" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Campaign initialization requires an authorized server credential." }, { status: 401 });
  try {
    const sql = getSql();
    const campaignRows = await sql`
      INSERT INTO content_campaigns (slug, name, website_url, timezone, start_date, duration_days, status, publish_mode)
      VALUES (${roadmap.campaign.slug}, ${roadmap.campaign.name}, ${roadmap.campaign.website}, ${roadmap.campaign.timezone}, ${roadmap.campaign.startDate}::date, ${roadmap.campaign.durationDays}, 'active', 'draft_only')
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, website_url = EXCLUDED.website_url, timezone = EXCLUDED.timezone, start_date = EXCLUDED.start_date, duration_days = EXCLUDED.duration_days, updated_at = now()
      RETURNING id, slug, start_date::text, duration_days, status, publish_mode
    `;
    const campaign = campaignRows[0] as { id: string; slug: string };
    let insertedDays = 0;
    for (const day of roadmap.days) {
      const rows = await sql`
        INSERT INTO content_campaign_days (campaign_id, day_number, campaign_date, theme, status)
        VALUES (${campaign.id}::uuid, ${day.day}, ${day.date}::date, ${day.theme}, 'planned')
        ON CONFLICT (campaign_id, day_number) DO NOTHING
        RETURNING id
      `;
      insertedDays += rows.length;
    }
    return NextResponse.json({ ok: true, campaign, roadmapDays: roadmap.days.length, insertedDays, publishMode: "draft_only", note: "The campaign and roadmap are initialized. This does not publish or schedule posts." }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Campaign initialization failed.";
    return NextResponse.json({ error: message, migrationRequired: true, migration: "db/content-campaign-schema.sql" }, { status: 500 });
  }
}
