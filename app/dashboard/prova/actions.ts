"use server";

import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { INTERNAL_NOTIFICATION_TYPES, notifyUsers } from "@/lib/notifications";
import { getActiveBarAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { RuleError, ruleFailure } from "@/lib/rule-error";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim().slice(0, 3000) || null;

/** What a business in the pilot thinks, sent to the super admins as it arrives. */
export async function savePilotFeedbackAction(formData: FormData) {
  try {
    const session = await getSession();
    if (!session) throw new RuleError("Accedi di nuovo.");
    const { activeBar, role } = await getActiveBarAccess(session);
    if (!activeBar?.id) throw new RuleError("Scegli prima il locale.");
    if (role !== Role.OWNER) throw new RuleError("Lo compila il titolare.");

    const euro = (key: string) => {
      const digits = String(formData.get(key) ?? "").replace(/[^\d]/g, "");
      return digits ? Number(digits) : null;
    };
    const wouldPay = euro("wouldPay");
    const tooExpensive = euro("tooExpensive");
    const tooCheap = euro("tooCheap");
    const recommendText = String(formData.get("recommend") ?? "");
    const recommend = recommendText === "" ? null : Number(recommendText);
    for (const value of [wouldPay, tooExpensive, tooCheap]) {
      if (value !== null && value > 5000) throw new RuleError("Scrivi una cifra al mese, per esempio 40.");
    }
    if (recommend !== null && (!Number.isInteger(recommend) || recommend < 0 || recommend > 10)) throw new RuleError("Il voto va da 0 a 10.");
    const data = {
      strengths: text(formData, "strengths"),
      problems: text(formData, "problems"),
      missing: text(formData, "missing"),
      payNote: text(formData, "payNote"),
      mostUsed: formData.getAll("mostUsed").map(String).join(", ").slice(0, 500) || null,
      wouldPay,
      tooExpensive,
      tooCheap,
      recommend,
    };
    if (!data.strengths && !data.problems && !data.missing && wouldPay === null) throw new RuleError("Scrivi almeno una risposta.");

    await prisma.pilotFeedback.create({ data: { barId: activeBar.id, userId: session.user.id, ...data } });
    const admins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN" }, select: { id: true } });
    await notifyUsers(admins.map((admin) => admin.id), {
      title: `Prova: ha risposto ${activeBar.name}`,
      message: `${wouldPay !== null ? `Pagherebbe ${wouldPay} €/mese. ` : ""}${recommend !== null ? `Voto ${recommend}/10.` : ""}`.trim() || "Nuova risposta al questionario.",
      type: INTERNAL_NOTIFICATION_TYPES.PILOT_FEEDBACK,
      actionUrl: "/dashboard/super-admin/prova",
    }).catch(() => null);
    return { ok: true };
  } catch (error) {
    return ruleFailure(error);
  }
}
