import { getAccountantEmail } from "@/lib/accountant/auth";
import { allowedBars, buildAccountantZip } from "@/lib/accountant/invoices";
import { contextFrom, recordSecurityEvent } from "@/lib/security/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** ?month=2026-10, plus ?bar=<id> for one venue; without it, all the accountant's venues. */
export async function GET(request: Request) {
  const email = await getAccountantEmail();
  if (!email) return new Response("Accedi di nuovo.", { status: 401 });

  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return new Response("Mese non valido.", { status: 400 });
  const bar = url.searchParams.get("bar");

  const venues = await allowedBars(email, bar ? [bar] : undefined);
  if (!venues.length) return new Response("Locale non trovato.", { status: 404 });

  const zip = await buildAccountantZip(venues, month);
  await recordSecurityEvent({ type: "zip_download", email, barId: bar, detail: `${month} · ${venues.length} locali · ${zip.count} fatture`, context: contextFrom(request.headers) });
  return new Response(new Uint8Array(zip.content), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zip.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
