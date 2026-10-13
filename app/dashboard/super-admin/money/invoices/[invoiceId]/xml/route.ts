import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** The e-invoice as the SDI receives it, to upload by hand or to keep. */
export async function GET(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const session = await getSession();
  if (!session || String(session.user.role) !== "SUPER_ADMIN") {
    return new Response("Non autorizzato", { status: 403 });
  }

  const { invoiceId } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { fiscalXml: true, fiscalFileName: true },
  });
  if (!invoice?.fiscalXml) return new Response("Fattura non ancora pronta", { status: 404 });

  return new Response(invoice.fiscalXml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${invoice.fiscalFileName ?? "fattura.xml"}"`,
      "Cache-Control": "no-store",
    },
  });
}
