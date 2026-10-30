import "server-only";

import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createAttemptThrottle } from "@/lib/attempt-throttle";
import { buildEmailTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/resend";
import { prisma } from "@/lib/prisma";
import { RuleError } from "@/lib/rule-error";
import { contextFrom, recordFailedSignIn, recordSecurityEvent } from "@/lib/security/events";

/**
 * The supplier's sign-in, the same way as the accountant's: their email and a
 * six-digit code mailed to it, no password. Anyone may ask a code here - a
 * supplier signs up by signing in; publishing waits for the supplier terms.
 */

export const SUPPLIER_COOKIE = "supplier-session";
const KIND = "supplier";
const CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_DAYS = 30;
const MAX_CODE_ATTEMPTS = 5;

const codeRequests = createAttemptThrottle(15 * 60 * 1000, 5);

export function normalizeEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 200 ? email : null;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function appUrl() {
  return (process.env.APP_URL?.trim() || "https://app.workbit.it").replace(/\/$/, "");
}

/**
 * Mails a code. Signing up is signing in: the supplier's record is made on
 * the first entry.
 */
export async function requestSupplierCode(rawEmail: unknown) {
  const email = normalizeEmail(rawEmail);
  if (!email) throw new RuleError("Scrivi un indirizzo email valido.");
  if (!codeRequests.isAllowed(email)) throw new RuleError("Troppi codici chiesti: riprova fra un quarto d'ora.");
  codeRequests.record(email);


  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.portalLoginCode.create({
    data: { kind: KIND, email, codeHash: hash(`${email}:${code}`), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
  });
  await prisma.portalLoginCode.deleteMany({ where: { kind: KIND, expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }).catch(() => {});

  await sendEmail({
    to: email,
    subject: `Il tuo codice Workbit: ${code}`,
    html: buildEmailTemplate({
      title: `Codice: ${code}`,
      message: "Scrivilo nella pagina di accesso per i fornitori Workbit, dove carichi e aggiorni il tuo listino. Vale 10 minuti.\nSe non l'hai chiesto tu, ignora questa email.",
    }),
  });
}

export async function verifySupplierCode(rawEmail: unknown, rawCode: unknown) {
  const email = normalizeEmail(rawEmail);
  const code = String(rawCode ?? "").replace(/\D/g, "");
  if (!email || code.length !== 6) throw new RuleError("Scrivi le 6 cifre del codice.");

  const row = await prisma.portalLoginCode.findFirst({
    where: { kind: KIND, email, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!row || row.attempts >= MAX_CODE_ATTEMPTS) throw new RuleError("Codice scaduto: chiedine uno nuovo.");

  const expected = Buffer.from(row.codeHash, "hex");
  const given = Buffer.from(hash(`${email}:${code}`), "hex");
  const context = contextFrom(await headers());
  if (!timingSafeEqual(expected, given)) {
    await recordFailedSignIn({ kind: "supplier_code", email, context });
    await prisma.portalLoginCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    throw new RuleError("Codice sbagliato.");
  }
  await prisma.portalLoginCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  await prisma.supplier.upsert({ where: { email }, create: { email }, update: {} });

  await recordSecurityEvent({ type: "code_ok", email, detail: "fornitore", context });
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.portalSession.create({ data: { kind: KIND, email, tokenHash: hash(token), expiresAt } });

  const store = await cookies();
  store.set(SUPPLIER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** The signed-in supplier's email, or null. */
export async function getSupplierEmail() {
  const store = await cookies();
  const token = store.get(SUPPLIER_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.portalSession.findUnique({
    where: { tokenHash: hash(token) },
    select: { email: true, expiresAt: true, kind: true },
  });
  if (!session || session.kind !== KIND || session.expiresAt <= new Date()) return null;
  return session.email;
}

export async function signOutSupplier() {
  const store = await cookies();
  const token = store.get(SUPPLIER_COOKIE)?.value;
  if (token) await prisma.portalSession.deleteMany({ where: { tokenHash: hash(token) } });
  store.delete(SUPPLIER_COOKIE);
}
