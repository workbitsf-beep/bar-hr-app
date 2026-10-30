import { aiEnabled } from "@/lib/costs/ai";
import { importPriceList } from "@/lib/costs/price-list";
import { prisma } from "@/lib/prisma";
import { getSupplierEmail } from "@/lib/supplier/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 20 * 1024 * 1024;

/** The supplier's own list, from its portal: read by Claude and published under its name. */
export async function POST(request: Request) {
  const email = await getSupplierEmail();
  if (!email) return Response.json({ ok: false, message: "Accedi di nuovo." }, { status: 401 });
  const supplier = await prisma.supplier.findUnique({ where: { email }, select: { id: true, companyName: true, zone: true, termsAcceptedAt: true } });
  if (!supplier?.companyName || !supplier.termsAcceptedAt) {
    return Response.json({ ok: false, message: "Prima completa i dati dell'azienda e accetta le condizioni." }, { status: 400 });
  }
  if (!aiEnabled()) return Response.json({ ok: false, message: "La lettura dei listini non è ancora attiva: riprova più tardi." }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const validText = String(form?.get("validFrom") ?? "");
  if (!(file instanceof File) || !file.size) return Response.json({ ok: false, message: "Scegli il file del listino." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ ok: false, message: "File troppo grande: massimo 20 MB." }, { status: 400 });
  if (!/\.(pdf|xlsx|xlsm|csv|txt)$/i.test(file.name)) return Response.json({ ok: false, message: "Va bene un PDF, un Excel o un CSV." }, { status: 400 });

  try {
    const count = await importPriceList({
      fileName: file.name,
      bytes: Buffer.from(await file.arrayBuffer()),
      supplierName: supplier.companyName,
      zone: supplier.zone,
      validFrom: /^\d{4}-\d{2}-\d{2}$/.test(validText) ? new Date(`${validText}T00:00:00.000Z`) : new Date(),
      barId: null,
      supplierId: supplier.id,
    });
    if (!count) return Response.json({ ok: false, message: "Non ho trovato prezzi leggibili in questo file: prova con l'Excel." }, { status: 422 });
    return Response.json({ ok: true, message: `Listino pubblicato: ${count} prodotti.` });
  } catch (error) {
    console.error("[fornitori] list import failed", error instanceof Error ? error.message : error);
    return Response.json({ ok: false, message: "Lettura non riuscita: riprova fra poco." }, { status: 500 });
  }
}
