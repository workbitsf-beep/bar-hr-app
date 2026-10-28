import { after } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { costsEnabledFor } from "@/lib/costs/access";
import { getActiveBarAccess } from "@/lib/permissions";
import { classifyPendingLines, importInvoiceFiles } from "@/lib/costs/import";
import { withBar } from "@/lib/withBar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 40 * 1024 * 1024;

/**
 * The month's zip from the cassetto fiscale (or loose XML / P7M files). The
 * invoices are read and saved here; Claude's pass over their lines runs after
 * the answer, so the owner is not kept waiting.
 */
export const POST = withBar(async (request, session) => {
  const access = await getActiveBarAccess(session as never);
  if (access.role !== Role.OWNER || !access.activeBar?.id || !costsEnabledFor(session.user.role)) {
    return Response.json({ ok: false, message: "Solo il titolare può caricare le fatture." }, { status: 403 });
  }
  const barId = access.activeBar.id;

  const form = await request.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter((item): item is File => item instanceof File && item.size > 0);
  if (!files.length) return Response.json({ ok: false, message: "Scegli il file zip delle fatture." }, { status: 400 });
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_BYTES) return Response.json({ ok: false, message: "File troppo grande: massimo 40 MB per volta." }, { status: 400 });

  const upload = await prisma.invoiceUpload.create({
    data: { barId, fileName: files.map((file) => file.name).join(", ").slice(0, 300), uploadedById: session.user.id },
  });
  try {
    const summary = await importInvoiceFiles({
      barId,
      uploadId: upload.id,
      source: "upload",
      anyRecipient: String(session.user.role) === "SUPER_ADMIN" && form?.get("anyRecipient") === "1",
      files: await Promise.all(files.map(async (file) => ({ name: file.name, data: Buffer.from(await file.arrayBuffer()) }))),
    });
    await prisma.invoiceUpload.update({
      where: { id: upload.id },
      data: {
        found: summary.found,
        imported: summary.imported,
        duplicates: summary.duplicates,
        skipped: summary.skipped,
        failed: summary.failed,
        notes: summary.notes,
      },
    });
    if (summary.imported) {
      after(() =>
        classifyPendingLines(barId).catch((error) => console.error("[costs] classification failed", error instanceof Error ? error.message : error)),
      );
    }
    return Response.json({ ok: true, summary });
  } catch (error) {
    console.error("[costs] upload failed", error);
    return Response.json({ ok: false, message: error instanceof Error ? error.message : "Caricamento non riuscito." }, { status: 500 });
  }
});
