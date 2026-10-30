import "server-only";

import { createHash } from "node:crypto";
import { buildEmailTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/resend";
import { INTERNAL_NOTIFICATION_TYPES, notifyUsers } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

/**
 * The doors of Workbit, watched. Every sign-in, good or bad, every code for an
 * accountant or a supplier, a super admin opening a venue, a zip downloaded:
 * written down. A few patterns raise an alert, and alerts go to the super
 * admins only - a client hears of anything only when a super admin has looked
 * and pressed "Avvisa il cliente" (no false alarm ever reaches a client).
 */

export type SecurityContext = { ip: string | null; userAgent: string | null };

/** Who is knocking: the first forwarded address (Railway's proxy) and the browser. */
export function contextFrom(headers: Headers): SecurityContext {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || null;
  return { ip: forwarded ? forwarded.slice(0, 64) : null, userAgent: headers.get("user-agent")?.slice(0, 300) ?? null };
}

/** The same browser on the same network reads the same: the last part of an IPv4 is left out. */
function deviceOf(context: SecurityContext) {
  const network = context.ip?.includes(".") ? context.ip.split(".").slice(0, 3).join(".") : context.ip?.split(":").slice(0, 4).join(":");
  const browser = (context.userAgent ?? "").replace(/[\d.]+/g, "");
  return createHash("sha256").update(`${browser}|${network ?? ""}`).digest("hex").slice(0, 16);
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

/** A super admin hears of it, once an hour per key: push and email, with the link to the console. */
async function raiseAlert(input: { key: string; title: string; detail: string; userId?: string | null; email?: string | null; context?: SecurityContext }) {
  const recent = await prisma.securityEvent.count({ where: { alertKey: input.key, severity: "alert", createdAt: { gte: minutesAgo(60) } } });
  if (recent) return;
  await prisma.securityEvent.create({
    data: {
      type: "alert",
      severity: "alert",
      alertKey: input.key,
      userId: input.userId ?? null,
      email: input.email ?? null,
      ip: input.context?.ip ?? null,
      userAgent: input.context?.userAgent ?? null,
      detail: `${input.title} · ${input.detail}`.slice(0, 1000),
    },
  });
  const admins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN", retiredAt: null }, select: { id: true, email: true } });
  await notifyUsers(admins.map((admin) => admin.id), {
    title: `Sicurezza: ${input.title}`,
    message: input.detail.slice(0, 180),
    type: INTERNAL_NOTIFICATION_TYPES.SECURITY_ALERT,
    actionUrl: "/dashboard/super-admin/sicurezza",
  }).catch(() => null);
  const base = (process.env.APP_URL?.trim() || "https://app.workbit.it").replace(/\/$/, "");
  await sendEmail({
    to: admins.map((admin) => admin.email),
    subject: `Workbit · avviso di sicurezza: ${input.title}`,
    html: buildEmailTemplate({
      title: input.title,
      message: `${input.detail}${input.context?.ip ? `\nIndirizzo: ${input.context.ip}` : ""}${input.context?.userAgent ? `\nDispositivo: ${input.context.userAgent}` : ""}\n\nControlla in console: se serve, da lì avvisi il cliente.`,
      ctaLabel: "Apri la sicurezza",
      ctaUrl: `${base}/dashboard/super-admin/sicurezza`,
    }),
  }).catch(() => null);
}

/** A wrong password, code or passkey: counted per address and per network. */
export async function recordFailedSignIn(input: { kind: "password" | "passkey" | "accountant_code" | "supplier_code"; email: string | null; context: SecurityContext }) {
  try {
    const type = input.kind === "password" || input.kind === "passkey" ? "login_failed" : "code_failed";
    await prisma.securityEvent.create({
      data: { type, severity: "warn", email: input.email, ip: input.context.ip, userAgent: input.context.userAgent, device: deviceOf(input.context), detail: input.kind },
    });
    if (input.email) {
      const forEmail = await prisma.securityEvent.count({ where: { type, email: input.email, createdAt: { gte: minutesAgo(15) } } });
      if (forEmail >= 5) {
        const user = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
        await raiseAlert({
          key: `failed:${input.email}`,
          title: "tentativi di accesso sbagliati",
          detail: `${forEmail} tentativi falliti in 15 minuti per ${input.email}${user ? "" : " (indirizzo non registrato)"}.`,
          userId: user?.id,
          email: input.email,
          context: input.context,
        });
      }
    }
    if (input.context.ip) {
      const forIp = await prisma.securityEvent.count({ where: { type: { in: ["login_failed", "code_failed"] }, ip: input.context.ip, createdAt: { gte: minutesAgo(15) } } });
      if (forIp >= 20) {
        await raiseAlert({
          key: `ip:${input.context.ip}`,
          title: "molti tentativi dallo stesso indirizzo",
          detail: `${forIp} accessi sbagliati in 15 minuti da ${input.context.ip}, su account diversi: può essere un attacco automatico.`,
          context: input.context,
        });
      }
    }
  } catch (error) {
    console.error("[security] failed sign-in not recorded", error instanceof Error ? error.message : error);
  }
}

/**
 * A sign-in that worked. A device never seen for this account in 90 days is
 * "new": noted for the super admins, and an alert straight away when the
 * account is a super admin's.
 */
export async function recordSignIn(input: { userId: string; email: string; role: string; method: "password" | "passkey" | "temporary"; context: SecurityContext }) {
  try {
    const device = deviceOf(input.context);
    const [seen, before] = await Promise.all([
      prisma.securityEvent.count({ where: { userId: input.userId, type: "login_ok", device, createdAt: { gte: minutesAgo(90 * 24 * 60) } } }),
      prisma.securityEvent.count({ where: { userId: input.userId, type: "login_ok" } }),
    ]);
    const fresh = before > 0 && seen === 0;
    await prisma.securityEvent.create({
      data: {
        type: "login_ok",
        severity: fresh ? "warn" : "info",
        userId: input.userId,
        email: input.email,
        ip: input.context.ip,
        userAgent: input.context.userAgent,
        device,
        detail: `${input.method}${fresh ? " · nuovo dispositivo" : ""}`,
      },
    });
    if (fresh && input.role === "SUPER_ADMIN") {
      await raiseAlert({
        key: `admin-device:${input.userId}:${device}`,
        title: "un super admin è entrato da un dispositivo nuovo",
        detail: `${input.email} è entrato con ${input.method === "passkey" ? "passkey" : "password"} da un dispositivo mai visto. Se non sei tu, cambia subito la password e chiudi le sessioni.`,
        userId: input.userId,
        email: input.email,
        context: input.context,
      });
    }
    if (input.method === "temporary") {
      await raiseAlert({
        key: `temporary:${input.userId}`,
        title: "accesso con password temporanea",
        detail: `${input.email} è entrato con la password temporanea di «password dimenticata».`,
        userId: input.userId,
        email: input.email,
        context: input.context,
      });
    }
  } catch (error) {
    console.error("[security] sign-in not recorded", error instanceof Error ? error.message : error);
  }
}

/** Anything else worth keeping: codes, console views, downloads. Some patterns raise an alert. */
export async function recordSecurityEvent(input: {
  type: "code_ok" | "console_view" | "zip_download" | "password_changed" | "sessions_closed" | "role_changed" | "data_export";
  userId?: string | null;
  email?: string | null;
  barId?: string | null;
  detail?: string;
  context?: SecurityContext;
}) {
  try {
    await prisma.securityEvent.create({
      data: {
        type: input.type,
        userId: input.userId ?? null,
        email: input.email ?? null,
        barId: input.barId ?? null,
        ip: input.context?.ip ?? null,
        userAgent: input.context?.userAgent ?? null,
        device: input.context ? deviceOf(input.context) : null,
        detail: input.detail?.slice(0, 500) ?? null,
      },
    });
    if (input.type === "zip_download" && input.email) {
      const count = await prisma.securityEvent.count({ where: { type: "zip_download", email: input.email, createdAt: { gte: minutesAgo(60) } } });
      if (count >= 30) {
        await raiseAlert({
          key: `zip:${input.email}`,
          title: "molti scaricamenti di fatture",
          detail: `${input.email} ha scaricato ${count} zip di fatture in un'ora.`,
          email: input.email,
          context: input.context,
        });
      }
    }
  } catch (error) {
    console.error("[security] event not recorded", error instanceof Error ? error.message : error);
  }
}
