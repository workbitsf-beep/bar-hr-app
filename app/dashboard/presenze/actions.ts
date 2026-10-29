"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EMAIL_PATTERN, emailList, payrollAccess } from "@/lib/payroll/access";
import { PAYROLL_KINDS, templateOf, type PayrollCodeKey } from "@/lib/payroll/template";
import { prisma } from "@/lib/prisma";
import { RuleError, ruleFailure } from "@/lib/rule-error";
import { ensureMembersInScope } from "@/lib/staff-scope";

const PATH = "/dashboard/presenze";

/**
 * Where the hours come from, the break off a shift, whether overtime counts.
 * Each control saves on its own, so only the fields sent are changed.
 */
export async function saveSourceAction(formData: FormData) {
  try {
    const { barId } = await payrollAccess({ ownerOnly: true });
    const data: { payrollSource?: string; payrollBreakMinutes?: number | null; payrollBreakAfterHours?: number | null; payrollOvertime?: boolean | null } = {};
    if (formData.has("source")) {
      const source = String(formData.get("source"));
      if (!["AUTO", "CLOCK", "SHIFTS"].includes(source)) throw new RuleError("Scegli da dove prendere le ore.");
      data.payrollSource = source;
    }
    if (formData.has("breakMinutes")) {
      const minutesText = String(formData.get("breakMinutes") ?? "").trim();
      const afterText = String(formData.get("breakAfterHours") ?? "").trim().replace(",", ".");
      const breakMinutes = minutesText ? Number(minutesText) : null;
      const breakAfterHours = afterText ? Number(afterText) : null;
      if (breakMinutes !== null && (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 180)) {
        throw new RuleError("La pausa va da 0 a 180 minuti.");
      }
      if (breakAfterHours !== null && (!Number.isFinite(breakAfterHours) || breakAfterHours < 0 || breakAfterHours > 12)) {
        throw new RuleError("Le ore del turno per la pausa vanno da 0 a 12.");
      }
      data.payrollBreakMinutes = breakMinutes || null;
      data.payrollBreakAfterHours = breakMinutes ? breakAfterHours ?? 6 : null;
    }
    if (formData.has("overtime")) {
      const overtime = String(formData.get("overtime"));
      data.payrollOvertime = overtime === "on" ? true : overtime === "off" ? false : null;
    }
    await prisma.barSettings.upsert({ where: { barId }, create: { barId, ...data }, update: data });
    revalidatePath(PATH, "layout");
    return { ok: true };
  } catch (error) {
    return ruleFailure(error);
  }
}

/** Matricola and contract hours of everyone, in one go. */
export async function savePayrollPeopleAction(formData: FormData) {
  try {
    const { barId } = await payrollAccess({ ownerOnly: true });
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
    revalidatePath(PATH, "layout");
    return { ok: true };
  } catch (error) {
    return ruleFailure(error);
  }
}

/** A consultant or an accountant, with the file the way they want it. */
export async function saveRecipientAction(formData: FormData) {
  let createdId: string | null = null;
  try {
    const { barId } = await payrollAccess({ ownerOnly: true });
    const id = String(formData.get("id") ?? "").trim();
    const role = String(formData.get("role") ?? "consulente");
    const name = String(formData.get("name") ?? "").trim().slice(0, 80);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const cc = emailList(String(formData.get("cc") ?? "")).slice(0, 5).join(", ");
    const dayText = String(formData.get("sendDay") ?? "").trim();
    const sendDay = dayText ? Number(dayText) : null;
    const message = String(formData.get("message") ?? "").trim().slice(0, 2000);
    let template: unknown = null;
    try {
      template = JSON.parse(String(formData.get("template") ?? "null"));
    } catch {
      throw new RuleError("Il formato del file non si è salvato: riprova.");
    }

    if (!name) throw new RuleError("Scrivi il nome o lo studio.");
    if (!EMAIL_PATTERN.test(email)) throw new RuleError("L'email non sembra giusta.");
    if (sendDay !== null && (!Number.isInteger(sendDay) || sendDay < 1 || sendDay > 28)) throw new RuleError("Il giorno dell'invio va da 1 a 28.");

    const data = {
      role: ["consulente", "commercialista", "altro"].includes(role) ? role : "altro",
      name,
      email,
      cc: cc || null,
      sendDay,
      message: message || null,
      template: templateOf(template),
    };
    if (id) {
      const updated = await prisma.payrollRecipient.updateMany({ where: { id, barId }, data });
      if (!updated.count) throw new RuleError("Destinatario non trovato.");
    } else {
      const count = await prisma.payrollRecipient.count({ where: { barId } });
      if (count >= 5) throw new RuleError("Al massimo cinque destinatari per locale.");
      createdId = (await prisma.payrollRecipient.create({ data: { barId, ...data }, select: { id: true } })).id;
    }
    revalidatePath(PATH, "layout");
  } catch (error) {
    return ruleFailure(error);
  }
  if (createdId) redirect(`${PATH}/impostazioni?success=destinatario`);
  return { ok: true };
}

export async function deleteRecipientAction(formData: FormData) {
  try {
    const { barId } = await payrollAccess({ ownerOnly: true });
    await prisma.payrollRecipient.deleteMany({ where: { id: String(formData.get("id") ?? ""), barId } });
    revalidatePath(PATH, "layout");
  } catch (error) {
    return ruleFailure(error);
  }
  redirect(`${PATH}/impostazioni`);
}

async function dayTarget(formData: FormData) {
  const access = await payrollAccess();
  const userId = String(formData.get("userId") ?? "");
  const dateText = String(formData.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) throw new RuleError("Giorno non valido.");
  const member = await prisma.employeeBar.findFirst({ where: { barId: access.barId, userId }, select: { userId: true } });
  if (!member) throw new RuleError("Persona non trovata.");
  if (!access.isOwner) await ensureMembersInScope(access.staff, "reports", access.barId, [userId]);
  // UTC midnight: the day key stays the day it reads.
  return { ...access, userId, date: new Date(`${dateText}T00:00:00.000Z`) };
}

/** A day corrected at review: what the files say for it, the clock-ins untouched. */
export async function saveDayAction(formData: FormData) {
  try {
    const { barId, userId, date, session } = await dayTarget(formData);
    const kinds = formData.getAll("kind").map(String);
    const hours = formData.getAll("hours").map((value) => Number(String(value).replace(",", ".")) || 0);
    const days = formData.getAll("days").map((value) => Number(String(value).replace(",", ".")) || 0);
    const entries = kinds
      .map((kind, index) => ({ kind: kind as PayrollCodeKey, hours: Math.round((hours[index] ?? 0) * 100) / 100, days: days[index] ?? 0 }))
      .filter((entry) => PAYROLL_KINDS.includes(entry.kind) && (entry.hours > 0 || entry.days > 0));
    if (entries.some((entry) => entry.hours > 24 || entry.days > 1)) throw new RuleError("Un giorno ha al massimo 24 ore e 1 giorno per voce.");
    const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;

    await prisma.payrollDayOverride.upsert({
      where: { barId_userId_date: { barId, userId, date } },
      create: { barId, userId, date, entries, note, updatedById: session.user.id },
      update: { entries, note, updatedById: session.user.id },
    });
    revalidatePath(PATH, "layout");
    return { ok: true };
  } catch (error) {
    return ruleFailure(error);
  }
}

/** Back to what the clock-ins or the shifts say. */
export async function resetDayAction(formData: FormData) {
  try {
    const { barId, userId, date } = await dayTarget(formData);
    await prisma.payrollDayOverride.deleteMany({ where: { barId, userId, date } });
    revalidatePath(PATH, "layout");
    return { ok: true };
  } catch (error) {
    return ruleFailure(error);
  }
}

/** The mail was opened in the phone's mail app or another: the month counts as sent. */
export async function markSentAction(input: { recipientId: string; month: string; channel: string }) {
  try {
    const { barId, session } = await payrollAccess();
    if (!/^\d{4}-\d{2}$/.test(input.month)) throw new RuleError("Mese non valido.");
    const recipient = await prisma.payrollRecipient.findFirst({ where: { id: input.recipientId, barId }, select: { id: true } });
    if (!recipient) throw new RuleError("Destinatario non trovato.");
    await prisma.payrollSend.create({
      data: {
        barId,
        recipientId: recipient.id,
        month: input.month,
        channel: ["mail_app", "share", "mailto"].includes(input.channel) ? input.channel : "mail_app",
        sentById: session.user.id,
      },
    });
    revalidatePath(PATH, "layout");
    return { ok: true };
  } catch (error) {
    return ruleFailure(error);
  }
}
