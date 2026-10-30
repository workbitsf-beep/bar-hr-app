import type { Metadata } from "next";
import { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { visibleOnBoard } from "@/lib/note-visibility";
import { getTerminal } from "@/lib/terminal/terminal";
import { PairingScreen, TerminalScreen, type TerminalNote } from "./terminal-screen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Terminale · Workbit" };

const DAY = 24 * 60 * 60_000;
const names = (user: { firstName: string; lastName: string } | null) => (user ? `${user.firstName} ${user.lastName.charAt(0)}.`.trim() : null);

/**
 * The venue's shared screen. Only what belongs to everyone: the notes to do,
 * the notices, the shopping list and the clock. Never shifts, documents or
 * hours - nobody is signed in here, people only say who they are with a PIN.
 */
export default async function TerminalPage() {
  const terminal = await getTerminal();
  if (!terminal) return <PairingScreen />;
  if (!terminal.active) {
    return <PairingScreen blocked="L'abbonamento del locale non è attivo: il terminale riprende quando il titolare lo riattiva." />;
  }

  // The venue's day, as the notes store it: UTC midnight of the Italian date.
  const today = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date())}T00:00:00Z`);
  const tomorrow = new Date(today.getTime() + DAY);
  const { features } = terminal;

  const [pending, done, board, shopping] = await Promise.all([
    features.tasks
      ? prisma.task.findMany({
          where: { barId: terminal.barId, status: { not: TaskStatus.DONE }, dueDate: { lt: new Date(tomorrow.getTime() + 7 * DAY) } },
          orderBy: [{ isUrgent: "desc" }, { dueDate: "asc" }],
          take: 120,
          select: {
            id: true,
            title: true,
            description: true,
            dueDate: true,
            isUrgent: true,
            requiresConfirmation: true,
            assignedToAll: true,
            department: true,
            assignedTo: { select: { firstName: true, lastName: true } },
          },
        })
      : [],
    features.tasks
      ? prisma.task.findMany({
          where: { barId: terminal.barId, status: TaskStatus.DONE, completedAt: { gte: new Date(Date.now() - 14 * 60 * 60_000) } },
          orderBy: { completedAt: "desc" },
          take: 30,
          select: {
            id: true,
            title: true,
            completedAt: true,
            completedOnTerminal: true,
            completedBy: { select: { firstName: true, lastName: true } },
          },
        })
      : [],
    features.board
      ? prisma.note.findMany({
          where: { barId: terminal.barId, ...visibleOnBoard() },
          orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
          take: 12,
          select: { id: true, content: true, createdAt: true, author: { select: { firstName: true } } },
        })
      : [],
    features.shopping
      ? prisma.shoppingListItem.findMany({
          where: { barId: terminal.barId },
          orderBy: { createdAt: "desc" },
          take: 200,
          select: { id: true, name: true, quantity: true, createdBy: { select: { firstName: true } } },
        })
      : [],
  ]);

  const notes: TerminalNote[] = pending.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    urgent: task.isUrgent,
    // A notice to read has nothing to complete.
    completable: task.requiresConfirmation,
    upcoming: task.dueDate >= tomorrow,
    late: task.dueDate < today,
    day: new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(task.dueDate),
    who: task.assignedToAll || !task.assignedTo ? "Tutti" : names(task.assignedTo)!,
  }));

  return (
    <TerminalScreen
      barName={terminal.barName}
      terminalName={terminal.name}
      pinForTasks={features.pinForTasks}
      features={{ tasks: features.tasks, shopping: features.shopping, clock: features.clock }}
      notes={notes}
      done={done.map((task) => ({
        id: task.id,
        title: task.title,
        by: names(task.completedBy) ?? (task.completedOnTerminal ? "dal terminale" : null),
        at: task.completedAt ? new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(task.completedAt) : "",
      }))}
      board={board.map((note) => ({ id: note.id, content: note.content, author: note.author.firstName }))}
      shopping={shopping.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity, by: item.createdBy?.firstName ?? null }))}
    />
  );
}
