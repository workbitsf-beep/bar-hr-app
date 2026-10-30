import { getSession } from "@/lib/auth";
import { aiEnabled } from "@/lib/costs/ai";
import { importPriceList } from "@/lib/costs/price-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 20 * 1024 * 1024;

/** A supplier's price list from the console: read by Claude, saved for every client's comparison. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || String(session.user.role) !== "SUPER_ADMIN") return Response.json({ ok: false, message: "Solo i super admin." }, { status: 403 });
  if (!aiEnabled()) return Response.json({ ok: false, message: "Manca la chiave di Anthropic sul server." }, { status: 400 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const supplierName = String(form?.get("supplierName") ?? "").trim().slice(0, 120);
  const zone = String(form?.get("zone") ?? "").trim().slice(0, 80) || null;
  const validText = String(form?.get("validFrom") ?? "");
  if (!(file instanceof File) || !file.size) return Response.json({ ok: false, message: "Scegli il file del listino." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ ok: false, message: "File troppo grande: massimo 20 MB." }, { status: 400 });
  if (!/\.(pdf|xlsx|xlsm|csv|txt)$/i.test(file.name)) return Response.json({ ok: false, message: "Va bene un PDF, un Excel o un CSV." }, { status: 400 });
  if (!supplierName) return Response.json({ ok: false, message: "Scrivi il nome del fornitore." }, { status: 400 });

  try {
    const count = await importPriceList({
      fileName: file.name,
      bytes: Buffer.from(await file.arrayBuffer()),
      supplierName,
      zone,
      validFrom: /^\d{4}-\d{2}-\d{2}$/.test(validText) ? new Date(`${validText}T00:00:00.000Z`) : new Date(),
      barId: null,
    });
    if (!count) return Response.json({ ok: false, message: "Non ho trovato prezzi leggibili in questo file." }, { status: 422 });
    return Response.json({ ok: true, message: `${count} prodotti letti dal listino di ${supplierName}.` });
  } catch (error) {
    console.error("[price-list] import failed", error instanceof Error ? error.message : error);
    return Response.json({ ok: false, message: "Lettura non riuscita: riprova o prova con l'Excel." }, { status: 500 });
  }
}
