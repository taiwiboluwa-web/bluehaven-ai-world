import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const COOKIE = "bluehaven_social_admin";

export async function POST(request: Request) {
  const expected = process.env.CHO_ADMIN_TOKEN;
  if (!expected) return NextResponse.json({ error: "CHO_ADMIN_TOKEN is not configured on the server." }, { status: 503 });
  let body: { token?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body.token || body.token !== expected) return NextResponse.json({ error: "Admin authorization failed." }, { status: 401 });
  const jar = await cookies();
  jar.set(COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/connections",
    maxAge: 60 * 60 * 8,
  });
  return NextResponse.json({ ok: true, expiresInSeconds: 28800 });
}

export async function DELETE() {
  const jar = await cookies();
  jar.set(COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/connections", maxAge: 0 });
  return NextResponse.json({ ok: true });
}
