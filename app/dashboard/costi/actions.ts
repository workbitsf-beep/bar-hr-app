"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { canAccessBar as canAccessBillingBar } from "@/lib/billing";
import { aiEnabled } from "@/lib/costs/ai";
import { isCategoryKey } from "@/lib/costs/categories";
import { classifyPendingLines, correctLineCategory } from "@/lib/costs/import";
import { activateInbox, deactivateInbox, syncInbox } from "@/lib/costs/openapi-inbox";
import { runPriceCheck } from "@/lib/costs/price-check";
import { costsEnabledFor } from "@/lib/costs/access";
import { getActiveBarAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { RuleError, ruleFailure } from "@/lib/rule-error";

/** Costs are the owner's: what the venue pays its suppliers is not staff business. */
async function ownerVenue() {
  const session = await getSession();
  if (!session) throw new RuleError("Accedi di nuovo.");
  const { activeBar, role } = await getActiveBarAccess(session);
  if (!activeBar?.id) throw new RuleError("Scegli prima il locale.");
  if (role !== Role.OWNER) throw new RuleError("Solo il titolare vede e gestisce i costi.");
  if (!costsEnabledFor(session.user.role)) throw new RuleError("Costi e fornitori non è ancora attivo per questo locale.");
  if (!(await canAccessBillingBar(activeBar.id))) throw new RuleError("Abbonamento non attivo.");
  return activeBar.id;
}

function refresh() {
  revalidatePath("/dashboard/costi");
  revalidatePath("/dashboard/costi/fatture");
}

export async function saveRevenueAction(formData: FormData) {
  try {
    const barId = await ownerVenue();
    const month = String(formData.get("month") ?? "");
    if (!/^\d{4}-\d{2}$/.test(month)) throw new RuleError("Mese non valido.");
    const raw = String(formData.get("amount") ?? "").replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
    if (!raw) {
      await prisma.monthlyRevenue.deleteMany({ where: { barId, month } });
    } else {
      const amount = Number(raw);
      if (!Number.isFinite(amount) || amount < 0 || amount > 100_000_000) throw new RuleError("Scrivi l'incasso in euro, per esempio 18500.");
      await prisma.monthlyRevenue.upsert({
        where: { barId_month: { barId, month } },
        create: { barId, month, amountCents: Math.round(amount * 100) },
        update: { amountCents: Math.round(amount * 100) },
      });
    }
    refresh();
    return { ok: true };
  } catch (error) {
    return ruleFailure(error);
  }
}

export async function correctCategoryAction(formData: FormData) {
  try {
    const barId = await ownerVenue();
    const lineId = String(formData.get("lineId") ?? "");
    const category = String(formData.get("category") ?? "");
    if (!isCategoryKey(category)) throw new RuleError("Scegli una categoria.");
    const count = await correctLineCategory({ barId, lineId, category, wholeSupplier: formData.get("wholeSupplier") === "on" });
    refresh();
    return { ok: true, count };
  } catch (error) {
    return ruleFailure(error);
  }
}

export async function priceCheckAction(formData: FormData) {
  try {
    const barId = await ownerVenue();
    if (!aiEnabled()) throw new RuleError("La ricerca online non è ancora attiva su Workbit.");
    const productKey = String(formData.get("productKey") ?? "").slice(0, 80);
    const month = String(formData.get("month") ?? "") || null;
    if (!productKey) throw new RuleError("Prodotto mancante.");
    const recent = await prisma.priceCheck.findFirst({
      where: { barId, productKey, checkedAt: { gt: new Date(Date.now() - 6 * 3_600_000) } },
      select: { id: true },
    });
    if (recent) throw new RuleError("Già cercato nelle ultime ore: il risultato è qui sotto.");
    const check = await runPriceCheck(barId, productKey, month);
    if (!check) throw new RuleError("Ricerca non riuscita. Riprova tra poco.");
    refresh();
    return { ok: true, offers: Array.isArray(check.offers) ? check.offers.length : 0 };
  } catch (error) {
    return ruleFailure(error);
  }
}

export async function reclassifyAction() {
  try {
    const barId = await ownerVenue();
    if (!aiEnabled()) throw new RuleError("La lettura automatica delle righe non è ancora attiva su Workbit.");
    const updated = await classifyPendingLines(barId);
    refresh();
    return { ok: true, updated };
  } catch (error) {
    return ruleFailure(error);
  }
}

export async function activateInboxAction() {
  try {
    const barId = await ownerVenue();
    await activateInbox(barId).catch((error: unknown) => {
      if (error instanceof RuleError) throw error;
      throw new RuleError(`Openapi non ha accettato l'attivazione: ${error instanceof Error ? error.message : "errore"}`);
    });
    refresh();
    return { ok: true };
  } catch (error) {
    return ruleFailure(error);
  }
}

export async function deactivateInboxAction() {
  try {
    const barId = await ownerVenue();
    await deactivateInbox(barId);
    refresh();
    return { ok: true };
  } catch (error) {
    return ruleFailure(error);
  }
}

export async function syncInboxAction() {
  try {
    const barId = await ownerVenue();
    const { imported } = await syncInbox(barId).catch((error: unknown) => {
      throw new RuleError(`Openapi non risponde: ${error instanceof Error ? error.message : "errore"}`);
    });
    if (imported) await classifyPendingLines(barId).catch(() => 0);
    refresh();
    return { ok: true, imported };
  } catch (error) {
    return ruleFailure(error);
  }
}

/** An upload made by mistake (another venue's zip): its invoices go with it. */
export async function deleteUploadAction(formData: FormData) {
  try {
    const barId = await ownerVenue();
    const uploadId = String(formData.get("uploadId") ?? "");
    const upload = await prisma.invoiceUpload.findFirst({ where: { id: uploadId, barId }, select: { id: true } });
    if (!upload) throw new RuleError("Caricamento non trovato.");
    await prisma.supplierInvoice.deleteMany({ where: { barId, uploadId } });
    await prisma.invoiceUpload.delete({ where: { id: uploadId } });
    refresh();
    return { ok: true };
  } catch (error) {
    return ruleFailure(error);
  }
}
