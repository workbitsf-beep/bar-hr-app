"use server";

import { FiscalState } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { prepareWaitingFiscalInvoices, rebuildRejectedFiscalInvoice } from "@/lib/invoicing/issue";
import { sendFiscalInvoice, syncFiscalInvoice } from "@/lib/invoicing/send";
import { prisma } from "@/lib/prisma";
import { RuleError, ruleFailure } from "@/lib/rule-error";

const PATH = "/dashboard/super-admin/money/invoices";

async function superAdmin() {
  const session = await getSession();
  if (!session || String(session.user.role) !== "SUPER_ADMIN") throw new RuleError("Solo il super admin gestisce le fatture.");
  return session;
}

/** Makes every e-invoice that was waiting for data, now that it is filled in. */
export async function prepareWaitingInvoicesAction() {
  try {
    await superAdmin();
    const { waiting, ready } = await prepareWaitingFiscalInvoices();
    revalidatePath(PATH);
    if (waiting === 0) return { ok: true as const, message: "Nessuna fattura in attesa." };
    return {
      ok: true as const,
      message:
        ready === waiting
          ? `${ready} fatture pronte.`
          : `${ready} pronte su ${waiting}: le altre dicono ancora cosa manca.`,
    };
  } catch (error) {
    return ruleFailure(error);
  }
}

/**
 * Until a provider sends them: the invoice was uploaded by hand on Fatture e
 * Corrispettivi, and here it is marked as sent.
 */
export async function markInvoiceSentAction(formData: FormData) {
  try {
    await superAdmin();
    const id = String(formData.get("invoiceId") ?? "");
    const updated = await prisma.invoice.updateMany({
      where: { id, fiscalState: { in: [FiscalState.READY, FiscalState.REJECTED] } },
      data: { fiscalState: FiscalState.SENT, fiscalError: null },
    });
    if (!updated.count) throw new RuleError("Questa fattura non è da inviare.");
    revalidatePath(PATH);
    return { ok: true as const, message: "Segnata come inviata allo SDI." };
  } catch (error) {
    return ruleFailure(error);
  }
}

/** Openapi set up: sends one invoice to the SDI now (again, after a rejection). */
export async function sendInvoiceToSdiAction(formData: FormData) {
  try {
    await superAdmin();
    const id = String(formData.get("invoiceId") ?? "");
    // Rejected: written again with the data as it is now, same number.
    await rebuildRejectedFiscalInvoice(id).catch((error: Error) => {
      throw new RuleError(`Non posso rifarla: ${error.message}`);
    });
    const result = await sendFiscalInvoice(id);
    revalidatePath(PATH);
    if (result.sent) return { ok: true as const, message: "Inviata allo SDI: lo stato si aggiorna appena risponde." };
    if (result.reason === "manual") throw new RuleError("L'invio automatico non è configurato.");
    if (result.reason === "error") {
      const failed = await prisma.invoice.findUnique({ where: { id }, select: { fiscalError: true } });
      throw new RuleError(failed?.fiscalError ?? "Invio non riuscito.");
    }
    throw new RuleError("Questa fattura non è da inviare.");
  } catch (error) {
    return ruleFailure(error);
  }
}

/** Asks Openapi what the SDI has said about one invoice. */
export async function refreshInvoiceStateAction(formData: FormData) {
  try {
    await superAdmin();
    const state = await syncFiscalInvoice(String(formData.get("invoiceId") ?? ""));
    revalidatePath(PATH);
    return {
      ok: true as const,
      message:
        state === FiscalState.DELIVERED
          ? "Consegnata."
          : state === FiscalState.REJECTED
            ? "Scartata dallo SDI: il motivo è sotto la fattura."
            : "Lo SDI non ha ancora risposto.",
    };
  } catch (error) {
    return ruleFailure(error);
  }
}
