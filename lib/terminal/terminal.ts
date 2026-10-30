import "server-only";

import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { canAccessBar } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { RuleError } from "@/lib/rule-error";

/**
 * The venue's terminal: a tablet or a PC that everyone shares. It is paired
 * once with a code from the owner's settings and from then on carries a long
 * random key in a cookie of its own - no person is signed in on it, so it can
 * never open shifts, documents or hours. People say who they are with the PIN
 * the owner gave them, and only to complete a note, add to the list or clock.
 */

export const TERMINAL_COOKIE = "wb_terminal";
const TERMINAL_COOKIE_AGE = 60 * 60 * 24 * 400;
const PAIRING_MINUTES = 15;
const MAX_FAILED_PINS = 5;
const LOCK_MINUTES = 2;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** The same PIN in two venues reads differently, and never in clear. */
export function pinKey(barId: string, pin: string) {
  const secret = process.env.DATA_ENCRYPTION_KEY?.trim() || process.env.SESSION_SECRET?.trim() || "workbit-terminal";
  return createHmac("sha256", secret).update(`${barId}:${pin}`).digest("hex");
}

export function isValidPin(pin: string) {
  return /^\d{4,6}$/.test(pin);
}

/** A new pairing code for the owner to type on the device: 8 characters, no look-alikes. */
export async function startPairing(input: { barId: string; name: string; createdById: string }) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join("");
  const terminal = await prisma.terminal.create({
    data: {
      barId: input.barId,
      name: input.name,
      createdById: input.createdById,
      pairingCodeHash: sha256(code),
      pairingExpiresAt: new Date(Date.now() + PAIRING_MINUTES * 60_000),
    },
    select: { id: true },
  });
  return { id: terminal.id, code, minutes: PAIRING_MINUTES };
}

/** The device typed the code: it gets its key, and the code is spent. */
export async function completePairing(rawCode: string) {
  const code = rawCode.replace(/[\s-]/g, "").toUpperCase();
  if (code.length !== 8) return null;
  const terminal = await prisma.terminal.findUnique({ where: { pairingCodeHash: sha256(code) } });
  if (!terminal || terminal.revokedAt || !terminal.pairingExpiresAt || terminal.pairingExpiresAt < new Date()) return null;
  const token = randomBytes(32).toString("base64url");
  await prisma.terminal.update({
    where: { id: terminal.id },
    data: { tokenHash: sha256(token), pairingCodeHash: null, pairingExpiresAt: null, pairedAt: new Date(), lastSeenAt: new Date() },
  });
  const store = await cookies();
  store.set(TERMINAL_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TERMINAL_COOKIE_AGE,
    expires: new Date(Date.now() + TERMINAL_COOKIE_AGE * 1000),
  });
  return terminal;
}

export async function forgetTerminalCookie() {
  (await cookies()).delete(TERMINAL_COOKIE);
}

export async function hasTerminalCookie() {
  return Boolean((await cookies()).get(TERMINAL_COOKIE)?.value);
}

/** The terminal this device is, when it is one and still allowed in. */
export async function getTerminal() {
  const token = (await cookies()).get(TERMINAL_COOKIE)?.value;
  if (!token) return null;
  const terminal = await prisma.terminal.findUnique({
    where: { tokenHash: sha256(token) },
    include: { bar: { select: { id: true, name: true, settings: { select: { tasksEnabled: true, noticeBoardEnabled: true, shoppingListEnabled: true, timeTrackingEnabled: true, terminalPinForTasks: true } } } } },
  });
  if (!terminal || terminal.revokedAt) return null;
  if (!terminal.lastSeenAt || Date.now() - terminal.lastSeenAt.getTime() > 5 * 60_000) {
    await prisma.terminal.update({ where: { id: terminal.id }, data: { lastSeenAt: new Date() } }).catch(() => null);
  }
  const settings = terminal.bar.settings;
  return {
    id: terminal.id,
    name: terminal.name,
    barId: terminal.barId,
    barName: terminal.bar.name,
    active: await canAccessBar(terminal.barId),
    lockedUntil: terminal.lockedUntil,
    features: {
      tasks: settings?.tasksEnabled ?? true,
      board: settings?.noticeBoardEnabled ?? true,
      shopping: settings?.shoppingListEnabled ?? true,
      clock: settings?.timeTrackingEnabled ?? true,
      pinForTasks: settings?.terminalPinForTasks ?? true,
    },
  };
}

export type TerminalContext = NonNullable<Awaited<ReturnType<typeof getTerminal>>>;

/** A refusal worth reading on the terminal: it travels back as a rule (lib/rule-error). */
export class TerminalError extends RuleError {}

/**
 * Who typed this PIN on this terminal. Five wrong in a row lock the keypad
 * for two minutes: four digits are guessed in minutes otherwise.
 */
export async function personForPin(terminal: TerminalContext, rawPin: string) {
  const pin = rawPin.trim();
  const fresh = await prisma.terminal.findUnique({ where: { id: terminal.id }, select: { lockedUntil: true, failedPins: true } });
  if (fresh?.lockedUntil && fresh.lockedUntil > new Date()) {
    throw new TerminalError("Troppi PIN sbagliati: riprova fra due minuti.");
  }
  const member = isValidPin(pin)
    ? await prisma.employeeBar.findFirst({
        where: { barId: terminal.barId, terminalPinKey: pinKey(terminal.barId, pin), isActive: true },
        select: { userId: true, role: true, user: { select: { firstName: true, lastName: true } } },
      })
    : null;
  if (!member) {
    const failed = (fresh?.failedPins ?? 0) + 1;
    const lock = failed >= MAX_FAILED_PINS;
    await prisma.terminal.update({
      where: { id: terminal.id },
      data: { failedPins: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
    });
    throw new TerminalError(lock ? "Troppi PIN sbagliati: riprova fra due minuti." : "PIN non riconosciuto.");
  }
  if (fresh?.failedPins) await prisma.terminal.update({ where: { id: terminal.id }, data: { failedPins: 0 } });
  return { userId: member.userId, role: member.role, firstName: member.user.firstName, lastName: member.user.lastName };
}

/** A PIN nobody else in the venue has: four digits, five once a team is very large. */
export async function freePin(barId: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const digits = attempt < 40 ? 4 : 5;
    const pin = String(randomInt(10 ** digits)).padStart(digits, "0");
    if (/^(\d)\1+$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin)) continue;
    const taken = await prisma.employeeBar.count({ where: { barId, terminalPinKey: pinKey(barId, pin) } });
    if (!taken) return pin;
  }
  throw new TerminalError("Non trovo un PIN libero: riprova.");
}

/** The owner sets one person's PIN: typed, or chosen by Workbit when empty. */
export async function setPin(input: { barId: string; userId: string; pin?: string | null }) {
  const pin = input.pin?.trim() || (await freePin(input.barId));
  if (!isValidPin(pin)) throw new TerminalError("Il PIN è fatto di 4, 5 o 6 cifre.");
  const key = pinKey(input.barId, pin);
  const holder = await prisma.employeeBar.findFirst({
    where: { barId: input.barId, terminalPinKey: key, NOT: { userId: input.userId } },
    select: { user: { select: { firstName: true } } },
  });
  if (holder) throw new TerminalError(`Questo PIN è già di ${holder.user.firstName}: scegline un altro.`);
  await prisma.employeeBar.update({
    where: { userId_barId: { userId: input.userId, barId: input.barId } },
    data: { terminalPin: pin, terminalPinKey: key },
  });
  return pin;
}

/** Everyone active gets a PIN the first time the owner opens the terminal settings. */
export async function ensurePins(barId: string) {
  const missing = await prisma.employeeBar.findMany({
    where: { barId, isActive: true, terminalPinKey: null, role: { not: Role.SUPER_ADMIN } },
    select: { userId: true },
  });
  for (const member of missing) {
    await setPin({ barId, userId: member.userId }).catch(() => null);
  }
}
