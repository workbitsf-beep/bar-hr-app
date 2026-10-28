import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncInbox } from "@/lib/costs/openapi-inbox";
import { classifyPendingLines } from "@/lib/costs/import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * A supplier invoice has reached a venue's Openapi inbox (supplier-invoice).
 * The body only says whose it is: the invoice itself is then downloaded from
 * Openapi, with the rest of what is waiting for that venue.
 */
function keyMatches(given: string | null) {
  const expected = process.env.OPENAPI_SDI_CALLBACK_KEY?.trim();
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function recipientIdsOf(body: unknown) {
  const ids = new Set<string>();
  const visit = (value: unknown, depth: number) => {
    if (!value || typeof value !== "object" || depth > 4) return;
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (typeof item === "string" && /recipient|cessionario|fiscal_id|vat_number|fiscal_code/i.test(key)) {
        const digits = item.replace(/\D/g, "");
        if (digits.length === 11) ids.add(digits);
      } else if (typeof item === "object") {
        visit(item, depth + 1);
      }
    }
  };
  visit(body, 0);
  return [...ids];
}

export async function POST(request: Request) {
  if (!keyMatches(new URL(request.url).searchParams.get("key"))) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const ids = recipientIdsOf(body);
  const venues = await prisma.barSettings.findMany({
    where: {
      invoiceInboxStatus: { in: ["WAITING", "ACTIVE"] },
      ...(ids.length ? { invoiceInboxFiscalId: { in: ids } } : {}),
    },
    select: { barId: true },
  });

  // Answered at once; the download and the reading happen after.
  after(async () => {
    for (const { barId } of venues) {
      try {
        const { imported } = await syncInbox(barId);
        if (imported) await classifyPendingLines(barId);
      } catch (error) {
        console.error("[openapi-invoices] sync failed", barId, error instanceof Error ? error.message : error);
      }
    }
  });
  return Response.json({ ok: true, venues: venues.length });
}
