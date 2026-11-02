import { NextResponse } from "next/server";
import { getSql, hasDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let database = "not_configured";
  if (hasDatabase) {
    try {
      const sql = getSql();
      await sql`SELECT 1 AS ok`;
      database = "connected";
    } catch {
      database = "unavailable";
    }
  }

  const enabled = process.env.VIDEO_ENGINE_ENABLED === "true";
  const workerConfigured = Boolean(
    process.env.VIDEO_ENGINE_BASE_URL &&
    process.env.VIDEO_ENGINE_API_KEY
  );

  return NextResponse.json({
    service: "BlueHaven AI Video Studio",
    database,
    engine: enabled && workerConfigured
      ? "configured_unverified"
      : "not_connected",
    generationEnabled: enabled && workerConfigured && database === "connected",
    capabilities: {
      scriptToVideo: false,
      voiceover: false,
      subtitles: false,
      publishing: false,
    },
    note: "The production worker is not connected yet. No generation or publishing is being triggered by this status endpoint.",
  }, { status: database === "connected" ? 200 : 503 });
}
