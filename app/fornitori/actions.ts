"use server";

import { revalidatePath } from "next/cache";
import { getCompanyProfile } from "@/lib/company-profile";
import { prisma } from "@/lib/prisma";
import { RuleError, ruleFailure } from "@/lib/rule-error";
import { getSupplierEmail, requestSupplierCode, signOutSupplier, verifySupplierCode } from "@/lib/supplier/auth";

export async function requestCodeAction(email: string) {
  try {
    await requestSupplierCode(email);
    return { ok: true as const };
  } catch (error) {
    return ruleFailure(error);
  }
}

export async function verifyCodeAction(email: string, code: string) {
  try {
    await verifySupplierCode(email, code);
    return { ok: true as const };
  } catch (error) {
    return ruleFailure(error);
  }
}

export async function signOutAction() {
  await signOutSupplier();
}

/** The company's details and, the first time, the acceptance of the supplier terms. */
export async function saveSupplierProfileAction(formData: FormData) {
  try {
    const email = await getSupplierEmail();
    if (!email) throw new RuleError("Accedi di nuovo.");
    const companyName = String(formData.get("companyName") ?? "").trim().slice(0, 160);
    const vatNumber = String(formData.get("vatNumber") ?? "").replace(/\s+/g, "").toUpperCase().slice(0, 20);
    const zone = String(formData.get("zone") ?? "").trim().slice(0, 120);
    const categories = String(formData.get("categories") ?? "").trim().slice(0, 300);
    const phone = String(formData.get("phone") ?? "").trim().slice(0, 40);
    const accepted = formData.get("acceptTerms") === "on";
    if (!companyName) throw new RuleError("Scrivi la ragione sociale.");
    if (!/^(IT)?\d{11}$/.test(vatNumber)) throw new RuleError("La partita IVA ha 11 cifre.");
    const current = await prisma.supplier.findUnique({ where: { email }, select: { termsAcceptedAt: true } });
    if (!current?.termsAcceptedAt && !accepted) throw new RuleError("Per pubblicare il listino accetta le condizioni per i fornitori.");
    const profile = await getCompanyProfile();
    await prisma.supplier.update({
      where: { email },
      data: {
        companyName,
        vatNumber,
        zone: zone || null,
        categories: categories || null,
        phone: phone || null,
        ...(accepted && !current?.termsAcceptedAt ? { termsAcceptedAt: new Date(), termsVersion: profile.documentVersion || "1.0" } : {}),
      },
    });
    revalidatePath("/fornitori");
    return { ok: true };
  } catch (error) {
    return ruleFailure(error);
  }
}

/** The list comes off Workbit at once. */
export async function removeListAction() {
  try {
    const email = await getSupplierEmail();
    if (!email) throw new RuleError("Accedi di nuovo.");
    const supplier = await prisma.supplier.findUniqueOrThrow({ where: { email }, select: { id: true } });
    await prisma.supplierListPrice.deleteMany({ where: { supplierId: supplier.id } });
    revalidatePath("/fornitori");
    return { ok: true };
  } catch (error) {
    return ruleFailure(error);
  }
}
