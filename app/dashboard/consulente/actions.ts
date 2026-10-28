"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { canAccessBar } from "@/lib/billing";
import { DEFAULT_PAYROLL_CODES, type PayrollCodeKey } from "@/lib/payroll/consultant-export";
import { getActiveBarAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { RuleError, ruleFailure } from "@/lib/rule-error";

/** Who the consultant is, and how they code hours, are the owner's to set. */
async function ownerVenue() {
  const session = await getSession();
  if (!session) throw new RuleError("Accedi di nuovo.");
  const { activeBar, role } = await getActiveBarAccess(session);
  if (!activeBar?.id) throw new RuleError("Scegli prima il locale.");
  if (role !== Role.OWNER) throw new RuleError("Solo il titolare cambia i dati del consulente.");
  if (!(await canAccessBar(activeBar.id))) throw new RuleError("Abbonamento non attivo.");
  return activeBar.id;
}

export async function saveConsultantAction(formData: FormData) {
  try {
    const barId = await ownerVenue();
    const email = String(formData.get("consultantEmail") ?? "").trim().toLowerCase();
    const name = String(formData.get("consultantName") ?? "").trim().slice(0, 80);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RuleError("L'email del consulente non sembra giusta.");

    const codes: Record<string, string> = {};
    for (const key of Object.keys(DEFAULT_PAYROLL_CODES) as PayrollCodeKey[]) {
      const value = String(formData.get(`code_${key}`) ?? "").trim().toUpperCase().slice(0, 12);
      codes[key] = value || DEFAULT_PAYROLL_CODES[key];
    }

    await prisma.barSettings.upsert({
      where: { barId },
      create: { barId, consultantEmail: email || null, consultantName: name || null, payrollCodes: codes },
      update: { consultantEmail: email || null, consultantName: name || null, payrollCodes: codes },
    });
    revalidatePath("/dashboard/consulente");
    return { ok: true };
  } catch (error) {
    return ruleFailure(error);
  }
}

/** Matricola and contract hours of everyone, in one go. */
export async function savePayrollPeopleAction(formData: FormData) {
  try {
    const barId = await ownerVenue();
    const ids = formData.getAll("userId").map(String);
    const members = await prisma.employeeBar.findMany({ where: { barId, userId: { in: ids } }, select: { id: true, userId: true } });
    for (const member of members) {
      const code = String(formData.get(`payrollCode_${member.userId}`) ?? "").trim().toUpperCase().slice(0, 30);
      const hoursText = String(formData.get(`weeklyHours_${member.userId}`) ?? "").trim().replace(",", ".");
      const hours = hoursText ? Number(hoursText) : null;
      if (hours !== null && (!Number.isFinite(hours) || hours <= 0 || hours > 60)) {
        throw new RuleError("Le ore settimanali vanno da 1 a 60, per esempio 40 o 24.");
      }
      await prisma.employeeBar.update({ where: { id: member.id }, data: { payrollCode: code || null, contractWeeklyHours: hours } });
    }
    revalidatePath("/dashboard/consulente");
    return { ok: true };
  } catch (error) {
    return ruleFailure(error);
  }
}
