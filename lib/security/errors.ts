import "server-only";

import { createHash } from "node:crypto";
import { buildEmailTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/resend";
import { INTERNAL_NOTIFICATION_TYPES, notifyUsers } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

/**
 * Server errors, before a client notices: each kind is counted by its
 * signature (message without numbers and ids, plus the page), a new one is
 * told to the super admins at once, a repeat at most once an hour.
 */

function signatureOf(message: string, path: string | null) {
  const normalized = message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\d+/g, "<n>")
    .slice(0, 300);
  const page = (path ?? "").split("?")[0].replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "<id>");
  return createHash("sha256").update(`${normalized}|${page}`).digest("hex").slice(0, 32);
}

export async function recordServerError(input: { message: string; path?: string | null; digest?: string | null }) {
  try {
    const message = input.message.slice(0, 1000) || "Errore senza messaggio";
    const path = input.path?.slice(0, 300) ?? null;
    const signature = signatureOf(message, path);
    const now = new Date();
    const row = await prisma.errorEvent.upsert({
      where: { signature },
      create: { signature, message, path, digest: input.digest ?? null },
      update: { count: { increment: 1 }, lastAt: now, resolvedAt: null, digest: input.digest ?? undefined },
    });
    const due = !row.alertedAt || now.getTime() - row.alertedAt.getTime() > 60 * 60_000;
    if (!due) return;
    await prisma.errorEvent.update({ where: { id: row.id }, data: { alertedAt: now } });
    const admins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN", retiredAt: null }, select: { id: true, email: true } });
    const title = row.count > 1 ? `Errore ripetuto (${row.count} volte)` : "Errore nuovo";
    await notifyUsers(admins.map((admin) => admin.id), {
      title: `Workbit: ${title.toLowerCase()}`,
      message: `${path ?? ""} ${message}`.trim().slice(0, 180),
      type: INTERNAL_NOTIFICATION_TYPES.SECURITY_ALERT,
      actionUrl: "/dashboard/super-admin/sicurezza",
    }).catch(() => null);
    const base = (process.env.APP_URL?.trim() || "https://app.workbit.it").replace(/\/$/, "");
    await sendEmail({
      to: admins.map((admin) => admin.email),
      subject: `Workbit · ${title}: ${message.slice(0, 80)}`,
      html: buildEmailTemplate({
        title,
        message: `Pagina: ${path ?? "non nota"}\nErrore: ${message}${input.digest ? `\nCodice: ${input.digest}` : ""}\nVolte: ${row.count}, la prima il ${row.firstAt.toLocaleString("it-IT", { timeZone: "Europe/Rome" })}.`,
        ctaLabel: "Apri la console",
        ctaUrl: `${base}/dashboard/super-admin/sicurezza`,
      }),
    }).catch(() => null);
  } catch (error) {
    // The error log must never become an error itself.
    console.error("[errors] not recorded", error instanceof Error ? error.message : error);
  }
}
