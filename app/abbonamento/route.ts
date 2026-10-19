import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * The site's "Passa al Pro" / "Aggiungi Reparti" links land here:
 * app.workbit.it/abbonamento?scegli=pro,reparti. Signed in, it opens the
 * subscription with that already chosen; signed out, it asks to log in
 * first and comes back. Only the plan's own words pass through.
 */
const ALLOWED = new Set(["pro", "base", "reparti", "stile", "persone5", "persone", "sede", "sedi"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chosen = (url.searchParams.get("scegli") ?? "")
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((word) => ALLOWED.has(word))
    .join(",");
  const target = `/dashboard/settings?piano=1${chosen ? `&scegli=${chosen}` : ""}`;
  const session = await getSession();
  const destination = session ? target : `/login?next=${encodeURIComponent(target)}`;
  return NextResponse.redirect(new URL(destination, url.origin), 303);
}
