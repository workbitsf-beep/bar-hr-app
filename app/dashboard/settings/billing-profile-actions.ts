"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { isItalianVat, isTaxCode, missingRecipientFields } from "@/lib/invoicing/fattura-pa";
import { prepareWaitingFiscalInvoices } from "@/lib/invoicing/issue";
import { getActiveBarAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { RuleError, ruleFailure } from "@/lib/rule-error";

function read(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value || null;
}

/** The owner's billing details, for the electronic invoice. */
export async function saveBillingProfileAction(formData: FormData) {
  try {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const { activeBar, role } = await getActiveBarAccess(session);
    if (!activeBar?.id) throw new Error("No active bar selected");
    if (role !== Role.OWNER) throw new RuleError("I dati di fatturazione li inserisce il titolare.");

    const countryCode = (read(formData, "countryCode") ?? "IT").toUpperCase().slice(0, 2);
    const vatNumber = read(formData, "vatNumber")?.replace(/\s/g, "").toUpperCase() ?? null;
    const taxCode = read(formData, "taxCode")?.replace(/\s/g, "").toUpperCase() ?? null;
    const recipientCode = read(formData, "recipientCode")?.toUpperCase() ?? null;
    const certifiedEmail = read(formData, "certifiedEmail")?.toLowerCase() ?? null;

    if (countryCode === "IT" && vatNumber && !isItalianVat(vatNumber)) {
      throw new RuleError("Questa partita IVA non è valida: controlla le 11 cifre.");
    }
    if (countryCode === "IT" && taxCode && !isTaxCode(taxCode)) {
      throw new RuleError("Questo codice fiscale non è valido.");
    }
    if (recipientCode && !/^[A-Z0-9]{7}$/.test(recipientCode)) {
      throw new RuleError("Il codice destinatario SDI ha 7 caratteri, lettere e numeri.");
    }

    const data = {
      businessName: read(formData, "businessName"),
      vatNumber: vatNumber?.replace(/^IT/, "") ?? null,
      taxCode,
      recipientCode,
      certifiedEmail,
      billingEmail: read(formData, "billingEmail")?.toLowerCase() ?? null,
      addressLine1: read(formData, "addressLine1"),
      city: read(formData, "city"),
      province: read(formData, "province")?.toUpperCase() ?? null,
      postalCode: read(formData, "postalCode"),
      countryCode,
    };
    const missing = missingRecipientFields({
      ...data,
      businessName: data.businessName ?? "",
      street: data.addressLine1 ?? "",
      postalCode: data.postalCode ?? "",
      city: data.city ?? "",
    });

    await prisma.billingProfile.upsert({
      where: { barId: activeBar.id },
      create: { barId: activeBar.id, ...data, validatedAt: missing.length ? null : new Date() },
      update: { ...data, validatedAt: missing.length ? null : new Date() },
    });

    // Payments that waited for these details get their invoice now.
    if (!missing.length) await prepareWaitingFiscalInvoices(activeBar.id).catch(() => null);

    revalidatePath("/dashboard/settings");
    return {
      ok: true as const,
      message: missing.length ? `Salvato. Manca ancora: ${missing.join(", ")}.` : "Dati di fatturazione salvati.",
    };
  } catch (error) {
    return ruleFailure(error);
  }
}
