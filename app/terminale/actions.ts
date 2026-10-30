"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TaskStatus } from "@prisma/client";
import { INTERNAL_NOTIFICATION_TYPES, notifyUsers } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { RuleError, ruleFailure } from "@/lib/rule-error";
import { contextFrom, recordFailedSignIn } from "@/lib/security/events";
import { RECURRING_TASK_FIELDS, spawnNextTaskOccurrence } from "@/lib/task-recurrence";
import { clockOnTerminal } from "@/lib/terminal/clock";
import { headers } from "next/headers";
import { completePairing, forgetTerminalCookie, getTerminal, personForPin, TerminalError } from "@/lib/terminal/terminal";

export type TerminalResult = { ok: true; message: string } | { ruleError: string };

async function activeTerminal() {
  const terminal = await getTerminal();
  if (!terminal) throw new RuleError("Questo dispositivo non è più collegato al locale: ricollegalo con un nuovo codice.");
  if (!terminal.active) throw new RuleError("L'abbonamento del locale non è attivo: avvisa il titolare.");
  return terminal;
}

function refreshViews() {
  revalidatePath("/terminale");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard/shopping-list");
}

/** The device types the owner's code and becomes the venue's terminal. */
export async function pairTerminalAction(formData: FormData) {
  try {
    const terminal = await completePairing(String(formData.get("code") ?? ""));
    if (!terminal) {
      await recordFailedSignIn({ kind: "terminal_code", email: null, context: contextFrom(await headers()) });
      throw new RuleError("Codice non valido o scaduto: creane uno nuovo in Impostazioni › Terminale.");
    }
  } catch (error) {
    return ruleFailure(error);
  }
  redirect("/terminale");
}

/** Leaves the terminal on this device: back to the pairing screen. */
export async function unpairTerminalAction() {
  await forgetTerminalCookie();
  redirect("/terminale");
}

/**
 * A note done, from the terminal. With the venue's PIN rule on, the PIN says
 * who; off, the note is simply done "dal terminale". Either way it is the same
 * note the phones show, so it is done there too.
 */
export async function completeTaskOnTerminalAction(formData: FormData): Promise<TerminalResult> {
  try {
    const terminal = await activeTerminal();
    if (!terminal.features.tasks) throw new RuleError("Le note sono spente per questo locale.");
    const taskId = String(formData.get("taskId") ?? "");
    const person = terminal.features.pinForTasks ? await personForPin(terminal, String(formData.get("pin") ?? "")) : null;

    const task = await prisma.task.findFirst({ where: { id: taskId, barId: terminal.barId }, select: { ...RECURRING_TASK_FIELDS, status: true } });
    if (!task) throw new RuleError("Questa nota non c'è più.");
    if (task.status === TaskStatus.DONE) {
      refreshViews();
      return { ok: true, message: "Era già fatta." };
    }

    const now = new Date();
    await prisma.$transaction([
      ...(person
        ? [
            prisma.taskCompletion.upsert({
              where: { taskId_userId: { taskId, userId: person.userId } },
              update: { completedAt: now },
              create: { taskId, userId: person.userId },
            }),
          ]
        : []),
      prisma.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.DONE, completedAt: now, completedById: person?.userId ?? null, completedOnTerminal: true },
      }),
    ]);
    await spawnNextTaskOccurrence(task);

    if (task.createdById !== person?.userId) {
      await notifyUsers([task.createdById], {
        barId: terminal.barId,
        title: person ? `${person.firstName} ha completato una nota` : "Nota completata dal terminale",
        message: task.title,
        type: INTERNAL_NOTIFICATION_TYPES.TASK_COMPLETED,
        actionUrl: "/dashboard/tasks",
      }).catch(() => null);
    }
    refreshViews();
    return { ok: true, message: person ? `Fatto, ${person.firstName}.` : "Fatto." };
  } catch (error) {
    return ruleFailure(error);
  }
}

/** Something missing, written on the list from the terminal. */
export async function addShoppingOnTerminalAction(formData: FormData): Promise<TerminalResult> {
  try {
    const terminal = await activeTerminal();
    if (!terminal.features.shopping) throw new RuleError("La lista della spesa è spenta per questo locale.");
    const name = String(formData.get("name") ?? "").trim().slice(0, 120);
    const quantity = String(formData.get("quantity") ?? "").trim().slice(0, 40);
    if (!name) throw new RuleError("Scrivi cosa manca.");
    const person = terminal.features.pinForTasks ? await personForPin(terminal, String(formData.get("pin") ?? "")) : null;
    await prisma.shoppingListItem.create({
      data: { barId: terminal.barId, name, quantity: quantity || null, createdById: person?.userId ?? null, addedOnTerminal: true },
    });
    refreshViews();
    return { ok: true, message: `Aggiunto: ${name}.` };
  } catch (error) {
    return ruleFailure(error);
  }
}

/** Entry or exit with the PIN, when the phone is not at hand. */
export async function clockOnTerminalAction(formData: FormData): Promise<TerminalResult> {
  try {
    const terminal = await activeTerminal();
    if (!terminal.features.clock) throw new RuleError("La timbratura è spenta per questo locale.");
    const person = await personForPin(terminal, String(formData.get("pin") ?? ""));
    const result = await clockOnTerminal({ barId: terminal.barId, userId: person.userId, role: person.role });
    const time = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(result.at);
    refreshViews();
    revalidatePath("/dashboard/presenze");
    if (result.kind === "in") return { ok: true, message: `Entrata alle ${time}. Buon lavoro, ${person.firstName}!` };
    const hours = Math.floor((result.workedMs ?? 0) / 3_600_000);
    const minutes = Math.round(((result.workedMs ?? 0) % 3_600_000) / 60_000);
    return { ok: true, message: `Uscita alle ${time}, ${hours}h ${String(minutes).padStart(2, "0")}m. A presto, ${person.firstName}!` };
  } catch (error) {
    if (error instanceof TerminalError) return { ruleError: error.message };
    return ruleFailure(error);
  }
}
