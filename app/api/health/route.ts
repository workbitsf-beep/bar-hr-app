import { NextResponse } from "next/server";

// The commit Railway built, so a check from outside can tell whether a deploy went live.
export async function GET() {
  return NextResponse.json({ ok: true, commit: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? null });
}
