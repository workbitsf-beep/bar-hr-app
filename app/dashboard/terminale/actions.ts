"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { getActiveBarAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { RuleError, ruleFailure } from "@/lib/rule-error";
import { setPin, startPairing } from "@/lib/terminal/terminal";

const PATH = "/dashboard/terminale";

/** The terminal is the owner's to set up: devices and PINs. */
async function ownerOfActiveBar() {
  const session = await getSession();
  if (!session) throw new RuleError("Accedi di nuovo.");
  const { activeBar, role } = await getActiveBarAccess(session);
  if (!activeBar?.id || role !== Role.OWNER) throw new RuleError("Solo il titolare imposta il terminale.");
  return { barId: activeBar.id, userId: session.user.id };
}

/** A code to type on the new device; it lasts a quarter of an hour. */
export async function createPairingCodeAction(formData: FormData) {
  try {
    const owner = await ownerOfActiveBar();
    const name = String(formData.get("name") ?? "").trim().slice(0, 60) || "Terminale";
    const pairing = await startPairing({ barId: owner.barId, name, createdById: owner.userId });
    revalidatePath(PATH);
    return { ok: true as const, code: pairing.code, minutes: pairing.minutes };
  } catch (error) {
    return ruleFailure(error);
  }
}

export async function revokeTerminalAction(formData: FormData) {
  try {
    const owner = await ownerOfActiveBar();
    await prisma.terminal.updateMany({
      where: { id: String(formData.get("id") ?? ""), barId: owner.barId },
      data: { revokedAt: new Date(), tokenHash: null, pairingCodeHash: null },
    });
    revalidatePath(PATH);
    return { ok: true };
  } catch (error) {
    return ruleFailure(error);
  }
}

export async function setTerminalPinRuleAction(formData: FormData) {
  try {
    const owner = await ownerOfActiveBar();
    const on = formData.get("on") === "1";
    await prisma.barSettings.upsert({
      where: { barId: owner.barId },
      update: { terminalPinForTasks: on },
      create: { barId: owner.barId, terminalPinForTasks: on },
    });
    revalidatePath(PATH);
    revalidatePath("/terminale");
    return { ok: true };
  } catch (error) {
    return ruleFailure(error);
  }
}

/** One person's PIN: the one typed, or a new one chosen by Workbit. */
export async function setPersonPinAction(formData: FormData) {
  try {
    const owner = await ownerOfActiveBar();
    const userId = String(formData.get("userId") ?? "");
    const member = await prisma.employeeBar.findFirst({ where: { barId: owner.barId, userId, isActive: true }, select: { id: true } });
    if (!member) throw new RuleError("Questa persona non è più nel locale.");
    await setPin({ barId: owner.barId, userId, pin: String(formData.get("pin") ?? "") });
    revalidatePath(PATH);
    return { ok: true };
  } catch (error) {
    return ruleFailure(error);
  }
}
