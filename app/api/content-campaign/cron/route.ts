import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import roadmapFile from "@/content/campaign-roadmap.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RoadmapDay = { day: number; date: string; theme: string; angle: string; postsTarget: number };
const roadmap = roadmapFile as { campaign: { slug: string; website: string; timezone: string }; days: RoadmapDay[] };

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET || process.env.AGENT_SERVICE_TOKEN;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model response did not contain a JSON object.");
  return JSON.parse(cleaned.slice(start, end + 1)) as { posts?: Array<{ topic: string; x_copy: string; caption: string; seo_snippet: string; visual_brief: Record<string, unknown>; sources?: string[]; handles?: string[] }> };
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized campaign cron invocation." }, { status: 401 });
  const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.OPENROUTER_API_KEY;
  const model = process.env.AI_DEFAULT_MODEL;
  if (!apiKey || !model) return NextResponse.json({ error: "AI gateway is not configured. Add AI_GATEWAY_API_KEY and AI_DEFAULT_MODEL.", configurationRequired: true }, { status: 503 });

  try {
    const sql = getSql();
    const campaigns = await sql`SELECT id, slug, website_url, timezone, start_date::text FROM content_campaigns WHERE slug = ${roadmap.campaign.slug} AND status = 'active' LIMIT 1`;
    if (!campaigns.length) return NextResponse.json({ error: "Campaign is not initialized. Apply db/content-campaign-schema.sql, then initialize it through the campaign API.", migrationRequired: true }, { status: 409 });
    const campaign = campaigns[0] as { id: string; slug: string; website_url: string; timezone: string; start_date: string };
    const next = await sql`
      SELECT id, day_number, campaign_date::text, theme, status
      FROM content_campaign_days
      WHERE campaign_id = ${campaign.id}::uuid AND status IN ('planned','failed')
      ORDER BY campaign_date ASC LIMIT 1
    `;
    if (!next.length) return NextResponse.json({ ok: true, complete: true, message: "All campaign days have been prepared or moved beyond the planned state." });
    const day = next[0] as { id: string; day_number: number; campaign_date: string; theme: string; status: string };
    const roadmapDay = roadmap.days.find(item => item.day === day.day_number);
    if (!roadmapDay) return NextResponse.json({ error: "No editorial brief exists for this campaign day." }, { status: 500 });
    await sql`UPDATE content_campaign_days SET status = 'generating', run_started_at = now(), error_message = NULL, updated_at = now() WHERE id = ${day.id}::uuid`;
    const runs = await sql`INSERT INTO content_campaign_runs (campaign_id, campaign_day_id, run_type, status, details) VALUES (${campaign.id}::uuid, ${day.id}::uuid, 'prepare', 'started', ${JSON.stringify({ day: day.day_number, theme: day.theme })}::jsonb) RETURNING id`;
    const runId = String(runs[0].id);

    const prompt = `Create exactly 3 distinct content ideas for BlueHaven Studios' 40-day media-tech education campaign.
Brand: BlueHaven Studios, tagline "Creativity Beyond Limits", website https://www.bluehavens.name.ng/, colors #ffde59 and #7f56d6.
Day ${day.day_number} (${day.campaign_date}); theme: ${day.theme}; angle: ${roadmapDay.angle}.
Audience: creators, livestream operators, designers, developers, and small creative teams, especially practical emerging-market workflows.
Voice: conversational practitioner, specific and useful; strengths first, respectful constructive critique; avoid generic AI-marketing phrases.
Each idea must teach a different actionable point. Do not invent current product features, pricing, official handles, URLs, personal experience, or performance figures. Do not fabricate sources: use empty sources/handles unless known with high confidence; these will need editorial verification before publication.
Return ONLY valid JSON matching this shape:
{"posts":[{"topic":"unique short title","x_copy":"under 280 characters including CTA/link","caption":"Instagram-ready caption with hook, practical steps, CTA to https://www.bluehavens.name.ng/ and 3-6 relevant hashtags","seo_snippet":"about 150 words, useful standalone explanation with natural search terms and website link","visual_brief":{"format":"carousel or single image","frame_by_frame":["..."],"on_image_copy":"...","composition":"...","alt_text":"..."},"sources":[],"handles":[]}]}
Exactly 3 posts. Do not repeat the same hook across the three. `;
    const response = await fetch(`${(process.env.AI_GATEWAY_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, temperature: 0.65, messages: [
        { role: "system", content: "You are BlueHaven Studios' senior media-tech editor. Follow the user's requested JSON schema exactly. No markdown fences, invented facts, or claims of publication." },
        { role: "user", content: prompt }
      ] }),
      signal: AbortSignal.timeout(50000)
    });
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message || `AI gateway returned HTTP ${response.status}.`);
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI gateway returned an empty response.");
    const parsed = parseJson(content);
    if (!Array.isArray(parsed.posts) || parsed.posts.length !== 3) throw new Error("The model must return exactly three posts.");
    let savedPosts = 0;
    for (let i = 0; i < parsed.posts.length; i++) {
      const post = parsed.posts[i];
      if (!post.topic || !post.x_copy || post.x_copy.length > 280 || !post.caption || !post.seo_snippet || !post.visual_brief) {
        throw new Error(`Post ${i + 1} failed required-field or X character-limit validation.`);
      }
      const schedule = ["08:00", "12:00", "16:00"][i];
      const scheduledFor = `${day.campaign_date}T${schedule}:00+01:00`;
      const platforms = [
        { platform: "x", copy: post.x_copy, caption: null, seo: null },
        { platform: "instagram", copy: null, caption: post.caption, seo: null },
        { platform: "website", copy: null, caption: null, seo: post.seo_snippet }
      ];
      for (const item of platforms) {
        await sql`
          INSERT INTO content_campaign_posts (campaign_id, campaign_day_id, post_number, topic, platform, x_copy, caption, seo_snippet, visual_brief, source_urls, verified_handles, scheduled_for, status)
          VALUES (${campaign.id}::uuid, ${day.id}::uuid, ${i + 1}, ${post.topic}, ${item.platform}, ${item.copy}, ${item.caption}, ${item.seo}, ${JSON.stringify(post.visual_brief)}::jsonb, ${JSON.stringify(post.sources || [])}::jsonb, ${JSON.stringify(post.handles || [])}::jsonb, ${scheduledFor}::timestamptz, 'draft')
          ON CONFLICT (campaign_day_id, post_number, platform) DO NOTHING
        `;
        savedPosts++;
      }
    }
    await sql`UPDATE content_campaign_days SET status = 'drafted', run_finished_at = now(), updated_at = now() WHERE id = ${day.id}::uuid`;
    await sql`UPDATE content_campaign_runs SET status = 'succeeded', details = ${JSON.stringify({ day: day.day_number, generatedIdeas: parsed.posts.length, savedPlatformDrafts: savedPosts, publicationPerformed: false })}::jsonb, finished_at = now() WHERE id = ${runId}::uuid`;
    return NextResponse.json({ ok: true, day: day.day_number, date: day.campaign_date, theme: day.theme, generatedIdeas: parsed.posts.length, savedPlatformDrafts: savedPosts, status: "drafted", published: false, note: "Drafts are stored in Neon. No external posts were published or scheduled." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Campaign generation failed.";
    try {
      const sql = getSql();
      await sql`UPDATE content_campaign_days SET status = 'failed', error_message = ${message.slice(0,1500)}, run_finished_at = now(), updated_at = now() WHERE campaign_id = (SELECT id FROM content_campaigns WHERE slug = ${roadmap.campaign.slug} LIMIT 1) AND status = 'generating'`;
      await sql`UPDATE content_campaign_runs SET status = 'failed', details = ${JSON.stringify({ error: message.slice(0,1500) })}::jsonb, finished_at = now() WHERE status = 'started' AND campaign_id = (SELECT id FROM content_campaigns WHERE slug = ${roadmap.campaign.slug} LIMIT 1)`;
    } catch {}
    return NextResponse.json({ error: message, published: false }, { status: 500 });
  }
}
