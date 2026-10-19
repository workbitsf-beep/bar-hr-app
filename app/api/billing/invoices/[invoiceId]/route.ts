import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { renderCourtesyPdf } from "@/lib/invoicing/courtesy";
import { prisma } from "@/lib/prisma";

/** An invoice's courtesy PDF (or ?xml=1 the XML), for the venue's owners and the super admin. */
export async function GET(request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Sessione scaduta. Accedi di nuovo." }, { status: 401 });
  const { invoiceId } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { barId: true, fiscalXml: true, fiscalFileName: true },
  });
  if (!invoice?.fiscalXml) return NextResponse.json({ ok: false, error: "Fattura non trovata." }, { status: 404 });

  if (String(session.user.role) !== "SUPER_ADMIN") {
    const owner = await prisma.employeeBar.findFirst({
      where: { userId: session.user.id, barId: invoice.barId, isActive: true, role: Role.OWNER },
      select: { id: true },
    });
    if (!owner) return NextResponse.json({ ok: false, error: "Non hai i permessi per farlo." }, { status: 403 });
  }

  if (new URL(request.url).searchParams.get("xml") === "1") {
    return new Response(invoice.fiscalXml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${invoice.fiscalFileName || "fattura.xml"}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  const rendered = await renderCourtesyPdf(invoiceId);
  if (!rendered) return NextResponse.json({ ok: false, error: "Fattura non trovata." }, { status: 404 });
  return new Response(new Uint8Array(rendered.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${rendered.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
