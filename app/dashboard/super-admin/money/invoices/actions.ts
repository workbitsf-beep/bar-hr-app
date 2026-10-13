"use server";

import { FiscalState } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { prepareWaitingFiscalInvoices } from "@/lib/invoicing/issue";
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
