"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { canManageTraining, getActiveBarAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { RuleError, ruleFailure } from "@/lib/rule-error";

async function trainingContext() {
  const session = await getSession();
  if (!session) throw new RuleError("Accedi di nuovo.");
  const { activeBar, role } = await getActiveBarAccess(session);
  if (!activeBar?.id) throw new RuleError("Scegli prima il locale.");
  if (!canManageTraining(role as Role)) throw new RuleError("I corsi li gestisce il titolare.");
  return { barId: activeBar.id };
}

export async function deleteCertificateAction(formData: FormData) {
  try {
    const { barId } = await trainingContext();
    const removed = await prisma.courseCertificate.deleteMany({ where: { id: String(formData.get("certificateId") ?? ""), barId } });
    if (!removed.count) throw new RuleError("Attestato non trovato.");
    revalidatePath("/dashboard/courses");
    return { ok: true };
  } catch (error) {
    return ruleFailure(error);
  }
}

/** How many days ahead the first reminder goes out. */
export async function saveCourseReminderDaysAction(formData: FormData) {
  try {
    const { barId } = await trainingContext();
    const days = Number(formData.get("days"));
    if (![30, 60, 90, 120].includes(days)) throw new RuleError("Scegli 30, 60, 90 o 120 giorni.");
    await prisma.barSettings.upsert({ where: { barId }, create: { barId, courseReminderDays: days }, update: { courseReminderDays: days } });
    // Reminders already sent stay sent; a longer notice starts from the next pass.
    revalidatePath("/dashboard/courses");
    return { ok: true };
  } catch (error) {
    return ruleFailure(error);
  }
}
