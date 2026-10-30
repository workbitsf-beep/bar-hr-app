"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EMAIL_PATTERN, emailList, payrollAccess } from "@/lib/payroll/access";
import { adjustmentOf, isEmptyAdjustment, rowKey, type MonthAdjustment } from "@/lib/payroll/adjust";
import { DAY_KINDS, PAYROLL_KINDS, templateOf, type PayrollCodeKey } from "@/lib/payroll/template";
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
      if (!["AUTO", "CLOCK", "SHIFTS", "CONTRACT"].includes(source)) throw new RuleError("Scegli da dove prendere le ore.");
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
  if (createdId) redirect(`${PATH}?success=destinatario`);
  return { ok: true };
}

/** One row of the recipient's card: only that value changes. */
export async function saveRecipientFieldAction(formData: FormData) {
  try {
    const { barId } = await payrollAccess({ ownerOnly: true });
    const id = String(formData.get("id") ?? "");
    const field = String(formData.get("field") ?? "");
    let data: Prisma.PayrollRecipientUpdateManyMutationInput;
    if (field === "who") {
      const role = String(formData.get("role") ?? "consulente");
      const name = String(formData.get("name") ?? "").trim().slice(0, 80);
      if (!name) throw new RuleError("Scrivi il nome o lo studio.");
      data = { name, role: ["consulente", "commercialista", "altro"].includes(role) ? role : "altro" };
    } else if (field === "email") {
      const email = String(formData.get("email") ?? "").trim().toLowerCase();
      if (!EMAIL_PATTERN.test(email)) throw new RuleError("L'email non sembra giusta.");
      data = { email };
    } else if (field === "cc") {
      data = { cc: emailList(String(formData.get("cc") ?? "")).slice(0, 5).join(", ") || null };
    } else if (field === "message") {
      data = { message: String(formData.get("message") ?? "").trim().slice(0, 2000) || null };
    } else if (field === "sendDay") {
      const dayText = String(formData.get("sendDay") ?? "").trim();
      const sendDay = dayText ? Number(dayText) : null;
      if (sendDay !== null && (!Number.isInteger(sendDay) || sendDay < 1 || sendDay > 28)) throw new RuleError("Il giorno dell'invio va da 1 a 28.");
      data = { sendDay };
    } else if (field === "template") {
      let template: unknown = null;
      try {
        template = JSON.parse(String(formData.get("template") ?? "null"));
      } catch {
        throw new RuleError("Il formato del file non si è salvato: riprova.");
      }
      data = { template: templateOf(template) };
    } else {
      throw new RuleError("Campo non valido.");
    }
    const updated = await prisma.payrollRecipient.updateMany({ where: { id, barId }, data });
    if (!updated.count) throw new RuleError("Destinatario non trovato.");
    revalidatePath(PATH, "layout");
  } catch (error) {
    return ruleFailure(error);
  }
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

/** "150", "150,5" or "150:30" as hours; empty is no change for that item. */
function hoursInput(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  const clock = /^(\d{1,3}):([0-5]\d)$/.exec(text);
  const hours = clock ? Number(clock[1]) + Number(clock[2]) / 60 : Number(text.replace(",", "."));
  if (!Number.isFinite(hours) || hours < 0 || hours > 400) throw new RuleError("Scrivi le ore come 150 o 150:30.");
  return Math.round(hours * 100) / 100;
}

async function monthTarget(formData: FormData) {
  const access = await payrollAccess();
  const userId = String(formData.get("userId") ?? "");
  const month = String(formData.get("month") ?? "");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new RuleError("Mese non valido.");
  const member = await prisma.employeeBar.findFirst({ where: { barId: access.barId, userId }, select: { userId: true } });
  if (!member) throw new RuleError("Persona non trovata.");
  if (!access.isOwner) await ensureMembersInScope(access.staff, "reports", access.barId, [userId]);
  return { ...access, userId, month };
}

async function loadAdjustment(barId: string, userId: string, month: string) {
  const row = await prisma.payrollMonthAdjustment.findUnique({ where: { barId_userId_month: { barId, userId, month } }, select: { totals: true, note: true } });
  return { adjustment: adjustmentOf(row?.totals ?? null), note: row?.note ?? null };
}

async function storeAdjustment(input: { barId: string; userId: string; month: string; updatedById: string; adjustment: MonthAdjustment; note: string | null }) {
  const { barId, userId, month, adjustment, note, updatedById } = input;
  if (isEmptyAdjustment(adjustment) && !note) {
    await prisma.payrollMonthAdjustment.deleteMany({ where: { barId, userId, month } });
  } else {
    const totals = adjustment as unknown as Prisma.InputJsonValue;
    await prisma.payrollMonthAdjustment.upsert({
      where: { barId_userId_month: { barId, userId, month } },
      create: { barId, userId, month, totals, note, updatedById },
      update: { totals, note, updatedById },
    });
  }
  revalidatePath(PATH, "layout");
}

function rowTarget(formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const kind = String(formData.get("kind") ?? "");
  return {
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    kind: PAYROLL_KINDS.includes(kind as PayrollCodeKey) ? (kind as PayrollCodeKey) : null,
  };
}

/**
 * A person's month totals as the owner wants them in the file: the totals
 * typed in replace the computed ones (lib/payroll/adjust.ts). Only the items
 * that differ from the computed value are kept; the clock-ins stay as they were.
 */
export async function saveMonthTotalsAction(formData: FormData) {
  try {
    const { barId, userId, month, session } = await monthTarget(formData);
    const { adjustment } = await loadAdjustment(barId, userId, month);
    const targets: MonthAdjustment["targets"] = {};
    for (const kind of PAYROLL_KINDS) {
      const hours = hoursInput(formData.get(`hours_${kind}`));
      const daysText = String(formData.get(`days_${kind}`) ?? "").trim();
      const days = daysText ? Number(daysText) : undefined;
      if (days !== undefined && (!Number.isInteger(days) || days < 0 || days > 31)) throw new RuleError("I giorni vanno da 0 a 31.");
      const computedHours = Number(formData.get(`was_hours_${kind}`) ?? 0);
      const computedDays = Number(formData.get(`was_days_${kind}`) ?? 0);
      const entry: { hours?: number; days?: number } = {};
      if (hours !== undefined && Math.abs(hours - computedHours) >= 0.01) entry.hours = hours;
      if (days !== undefined && days !== computedDays) entry.days = days;
      if (entry.hours !== undefined || entry.days !== undefined) targets[kind] = entry;
    }
    const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;
    await storeAdjustment({ barId, userId, month, updatedById: session.user.id, adjustment: { ...adjustment, targets }, note });
    return { ok: true };
  } catch (error) {
    return ruleFailure(error);
  }
}

/** A row of the file with other hours or days: a day's item, or an item's month total. */
export async function saveFileRowAction(formData: FormData) {
  try {
    const { barId, userId, month, session } = await monthTarget(formData);
    const { date, kind } = rowTarget(formData);
    if (!kind) throw new RuleError("Riga non valida.");
    const hours = hoursInput(formData.get("hours")) ?? 0;
    const daysText = String(formData.get("days") ?? "").trim();
    const days = daysText ? Number(daysText) : undefined;
    const { adjustment, note } = await loadAdjustment(barId, userId, month);
    if (date) {
      if (hours > 24) throw new RuleError("Un giorno ha al massimo 24 ore.");
      if (days !== undefined && days !== 0 && days !== 1) throw new RuleError("In un giorno: 0 o 1.");
      const key = rowKey(date, kind);
      adjustment.rows[key] = { ...adjustment.rows[key], hours, ...(days !== undefined ? { days } : {}) };
      // A month total for the item would undo the day's change.
      delete adjustment.targets[kind];
    } else {
      if (days !== undefined && (!Number.isInteger(days) || days < 0 || days > 31)) throw new RuleError("I giorni vanno da 0 a 31.");
      adjustment.targets[kind] = { hours, ...(days !== undefined && DAY_KINDS.includes(kind) ? { days } : {}) };
    }
    await storeAdjustment({ barId, userId, month, updatedById: session.user.id, adjustment, note });
    return { ok: true };
  } catch (error) {
    return ruleFailure(error);
  }
}

/** The green tick on a row of the file: in the file, or left out. */
export async function toggleFileRowAction(formData: FormData) {
  try {
    const { barId, userId, month, session } = await monthTarget(formData);
    const { date, kind } = rowTarget(formData);
    const { adjustment, note } = await loadAdjustment(barId, userId, month);
    if (date && kind) {
      const key = rowKey(date, kind);
      const { off, ...rest } = adjustment.rows[key] ?? {};
      if (off) {
        if (Object.keys(rest).length) adjustment.rows[key] = rest;
        else delete adjustment.rows[key];
      } else {
        adjustment.rows[key] = { ...rest, off: true };
      }
    } else if (kind) {
      adjustment.kindsOff = adjustment.kindsOff.includes(kind) ? adjustment.kindsOff.filter((item) => item !== kind) : [...adjustment.kindsOff, kind];
    } else {
      adjustment.off = !adjustment.off;
    }
    await storeAdjustment({ barId, userId, month, updatedById: session.user.id, adjustment, note });
    return { ok: true };
  } catch (error) {
    return ruleFailure(error);
  }
}

/** Back to the totals the clock-ins or the shifts give. */
export async function resetMonthTotalsAction(formData: FormData) {
  try {
    const { barId, userId, month } = await monthTarget(formData);
    await prisma.payrollMonthAdjustment.deleteMany({ where: { barId, userId, month } });
    revalidatePath(PATH, "layout");
    return { ok: true };
  } catch (error) {
    return ruleFailure(error);
  }
}
