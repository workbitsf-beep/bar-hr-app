"use server";

import { revalidatePath } from "next/cache";
import { buildEmailTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/resend";
import { prisma } from "@/lib/prisma";
import { RuleError, ruleFailure } from "@/lib/rule-error";
import { encryptExisting } from "@/lib/security/backfill";
import { encryptionEnabled } from "@/lib/security/crypto";
import { clientNoticeText } from "@/lib/security/notices";
import { getDashboardContext } from "../../context";
import type { ConsoleResult } from "../console-form";

async function superAdmin() {
  const { role, session } = await getDashboardContext();
  if (String(role) !== "SUPER_ADMIN") throw new RuleError("Solo i super admin.");
  return session;
}

const PATH = "/dashboard/super-admin/sicurezza";

/** Looked at: off the list of alerts to see. */
export async function reviewAlertAction(formData: FormData): Promise<ConsoleResult> {
  try {
    await superAdmin();
    await prisma.securityEvent.updateMany({ where: { id: String(formData.get("id") ?? "") }, data: { reviewedAt: new Date() } });
    revalidatePath(PATH);
    return { ok: true, message: "Segnato come visto." };
  } catch (error) {
    return ruleFailure(error);
  }
}

export async function notifyClientAction(formData: FormData): Promise<ConsoleResult> {
  try {
    await superAdmin();
    const event = await prisma.securityEvent.findUnique({ where: { id: String(formData.get("id") ?? "") } });
    if (!event?.email) throw new RuleError("Questo avviso non ha un cliente a cui scrivere.");
    if (event.clientNotifiedAt) throw new RuleError("Il cliente è già stato avvisato.");
    const user = await prisma.user.findUnique({ where: { email: event.email }, select: { firstName: true } });
    if (!user) throw new RuleError("L'indirizzo non è di un utente Workbit: non c'è nessuno da avvisare.");
    const text = clientNoticeText(event.alertKey ?? "");
    await sendEmail({ to: event.email, subject: text.subject, html: buildEmailTemplate({ title: `Ciao ${user.firstName},`, message: text.body }) });
    await prisma.securityEvent.update({ where: { id: event.id }, data: { clientNotifiedAt: new Date(), reviewedAt: event.reviewedAt ?? new Date() } });
    revalidatePath(PATH);
    return { ok: true, message: `Avvisato ${event.email}.` };
  } catch (error) {
    return ruleFailure(error);
  }
}

export async function resolveErrorAction(formData: FormData): Promise<ConsoleResult> {
  try {
    await superAdmin();
    await prisma.errorEvent.updateMany({ where: { id: String(formData.get("id") ?? "") }, data: { resolvedAt: new Date() } });
    revalidatePath(PATH);
    return { ok: true, message: "Segnato come risolto." };
  } catch (error) {
    return ruleFailure(error);
  }
}

export async function encryptExistingAction(): Promise<ConsoleResult> {
  try {
    await superAdmin();
    if (!encryptionEnabled()) throw new RuleError("Manca DATA_ENCRYPTION_KEY su Railway: senza la chiave non si cifra niente.");
    // Minutes on a big database: it carries on after this answer.
    void encryptExisting().then((count) => console.info("[crypto] backfill done", count));
    return { ok: true, message: "Cifratura avviata: ricarica fra qualche minuto per vedere i numeri scendere." };
  } catch (error) {
    return ruleFailure(error);
  }
}
