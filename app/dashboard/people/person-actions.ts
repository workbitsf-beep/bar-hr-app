"use server";

import { Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getActiveBarAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { RuleError, ruleFailure } from "@/lib/rule-error";

/**
 * One line of a person's card: the hourly pay, or how the consultant knows
 * them (matricola or codice fiscale). Both are the owner's to set.
 */
export async function savePersonDetailAction(formData: FormData) {
  try {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const { activeBar, role } = await getActiveBarAccess(session);
    if (!activeBar?.id) throw new Error("No active bar selected");
    if (role !== Role.OWNER && String(role) !== "SUPER_ADMIN") {
      throw new RuleError("Paga e matricola le scrive il titolare.");
    }

    const membership = await prisma.employeeBar.findFirst({
      where: { id: String(formData.get("membershipId") ?? ""), barId: activeBar.id, isActive: true },
      select: { id: true },
    });
    if (!membership) throw new RuleError("Persona non trovata in questo locale.");

    const field = String(formData.get("field") ?? "");
    const value = String(formData.get("value") ?? "").trim();

    if (field === "hourlyRate") {
      const rate = value ? Number(value.replace(",", ".")) : null;
      if (rate !== null && (!Number.isFinite(rate) || rate <= 0 || rate > 500)) {
        throw new RuleError("La paga oraria va scritta in euro, per esempio 9,50.");
      }
      await prisma.employeeBar.update({
        where: { id: membership.id },
        data: { hourlyRate: rate === null ? null : new Prisma.Decimal(rate.toFixed(2)) },
      });
    } else if (field === "payrollCode") {
      await prisma.employeeBar.update({
        where: { id: membership.id },
        data: { payrollCode: value.toUpperCase().slice(0, 30) || null },
      });
    } else {
      throw new RuleError("Niente da salvare.");
    }

    revalidatePath("/dashboard/people", "layout");
    revalidatePath("/dashboard/presenze", "layout");
    return { ok: true as const };
  } catch (error) {
    return ruleFailure(error);
  }
}
