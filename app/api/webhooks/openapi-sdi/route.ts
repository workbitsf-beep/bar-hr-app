import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { syncFiscalInvoice } from "@/lib/invoicing/send";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The SDI's answers about Workbit's invoices, posted by Openapi
 * (customer-notification). The callback URL carries a secret key; the
 * state itself is then read back from Openapi, not taken from this body.
 */
function keyMatches(given: string | null) {
  const expected = process.env.OPENAPI_SDI_CALLBACK_KEY?.trim();
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function invoiceUuidOf(body: unknown): string | null {
  const root = (body ?? {}) as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;
  const notification = (data.notification ?? data) as Record<string, unknown>;
  const uuid = notification.invoice_uuid ?? data.invoice_uuid ?? root.invoice_uuid;
  return typeof uuid === "string" && uuid ? uuid : null;
}

export async function POST(request: Request) {
  if (!keyMatches(new URL(request.url).searchParams.get("key"))) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const uuid = invoiceUuidOf(body);
  if (!uuid) return Response.json({ ok: true, ignored: "no invoice" });

  const invoice = await prisma.invoice.findFirst({ where: { fiscalDocumentId: uuid }, select: { id: true } });
  if (!invoice) return Response.json({ ok: true, ignored: "unknown invoice" });

  try {
    const state = await syncFiscalInvoice(invoice.id);
    return Response.json({ ok: true, state });
  } catch (error) {
    console.error("[openapi-sdi] sync failed", error instanceof Error ? error.message : error);
    // A 5xx makes Openapi try again later.
    return Response.json({ ok: false }, { status: 502 });
  }
}
