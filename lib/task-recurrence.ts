import { TaskRepeatUnit, TaskStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Notes that come back on their own.
 *
 * A venue has checks nobody remembers unprompted: the extinguishers every six
 * months, the water filter every three, the till drawer every week. Writing
 * the note again each time is the part that gets forgotten, so the note
 * rewrites itself.
 *
 * One rule holds the whole thing together: the recurrence lives on the newest
 * occurrence only. When an occurrence produces its successor it hands the rule
 * over and keeps none, so a series can never leave two pending notes for the
 * same check, however many times the cron runs.
 */

type RepeatLimits = { max: number; singular: string; plural: string };

const REPEAT_LIMITS: Record<TaskRepeatUnit, RepeatLimits> = {
  [TaskRepeatUnit.DAY]: { max: 365, singular: "giorno", plural: "giorni" },
  [TaskRepeatUnit.WEEK]: { max: 104, singular: "settimana", plural: "settimane" },
  [TaskRepeatUnit.MONTH]: { max: 60, singular: "mese", plural: "mesi" },
};

export type TaskRepeat = {
  repeatEvery: number;
  repeatUnit: TaskRepeatUnit;
};

export function parseTaskRepeat(
  everyValue: FormDataEntryValue | string | null | undefined,
  unitValue: FormDataEntryValue | string | null | undefined
): TaskRepeat | null {
  const unit = String(unitValue ?? "").trim().toUpperCase();

  if (!isRepeatUnit(unit)) {
    return null;
  }

  const every = Number(String(everyValue ?? "").trim());

  if (!Number.isInteger(every) || every < 1 || every > REPEAT_LIMITS[unit].max) {
    return null;
  }

  return { repeatEvery: every, repeatUnit: unit };
}

function isRepeatUnit(value: string): value is TaskRepeatUnit {
  return value === TaskRepeatUnit.DAY || value === TaskRepeatUnit.WEEK || value === TaskRepeatUnit.MONTH;
}

export function describeTaskRepeat(
  repeatEvery: number | null | undefined,
  repeatUnit: TaskRepeatUnit | null | undefined
): string | null {
  if (!repeatEvery || !repeatUnit) {
    return null;
  }

  const limits = REPEAT_LIMITS[repeatUnit];

  if (repeatEvery === 1) {
    return `ogni ${limits.singular}`;
  }

  return `ogni ${repeatEvery} ${limits.plural}`;
}

/**
 * The next date in the series, counted from the date the occurrence carried
 * rather than from the day it was ticked off. A check due on the first of the
 * month stays on the first of the month even when it gets done on the third.
 *
 * Adding never lands in the past: if a series was left alone for long enough
 * that one step is still behind us, it keeps stepping until it is ahead.
 */
export function nextTaskDueDate(
  from: Date,
  repeat: TaskRepeat,
  notBefore: Date = new Date()
): Date {
  const floor = notBefore.getTime();

  // How many steps are needed is worked out rather than counted one at a time:
  // a daily note left alone for two years needs hundreds of them, and a loop
  // that gave up early would leave the series stuck in the past, producing a
  // fresh note on every single run.
  let step = estimateSteps(from, repeat, floor);
  let next = addRepeat(from, repeat.repeatEvery, repeat.repeatUnit, step);

  // The estimate can land a step short where months differ in length. It is
  // never short by more than a few.
  for (let guard = 0; next.getTime() <= floor && guard < 64; guard += 1) {
    step += 1;
    next = addRepeat(from, repeat.repeatEvery, repeat.repeatUnit, step);
  }

  return next;
}

function estimateSteps(from: Date, { repeatEvery, repeatUnit }: TaskRepeat, floor: number): number {
  if (repeatUnit === TaskRepeatUnit.MONTH) {
    const target = new Date(floor);
    const months =
      (target.getUTCFullYear() - from.getUTCFullYear()) * 12 +
      (target.getUTCMonth() - from.getUTCMonth());

    return Math.max(1, Math.floor(months / repeatEvery));
  }

  const intervalMs = repeatEvery * (repeatUnit === TaskRepeatUnit.WEEK ? 7 : 1) * 86_400_000;
  const elapsed = floor - from.getTime();

  return elapsed <= 0 ? 1 : Math.floor(elapsed / intervalMs) + 1;
}

function addRepeat(from: Date, every: number, unit: TaskRepeatUnit, steps: number): Date {
  const amount = every * steps;

  if (unit === TaskRepeatUnit.DAY || unit === TaskRepeatUnit.WEEK) {
    const days = unit === TaskRepeatUnit.WEEK ? amount * 7 : amount;

    return new Date(from.getTime() + days * 86_400_000);
  }

  // Months are not a fixed length, so they are counted on the calendar and
  // then pulled back to the last day that exists: the 31st of March plus one
  // month is the 30th of April, not the 1st of May.
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth() + amount;
  const day = from.getUTCDate();
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(day, lastDayOfTargetMonth),
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds()
    )
  );
}

type RecurringTask = {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date;
  barId: string;
  createdById: string;
  assignedToAll: boolean;
  assignedToId: string | null;
  requiresConfirmation: boolean;
  repeatEvery: number | null;
  repeatUnit: TaskRepeatUnit | null;
};

export const RECURRING_TASK_FIELDS = {
  id: true,
  title: true,
  description: true,
  dueDate: true,
  barId: true,
  createdById: true,
  assignedToAll: true,
  assignedToId: true,
  requiresConfirmation: true,
  repeatEvery: true,
  repeatUnit: true,
} satisfies Prisma.TaskSelect;

/**
 * Writes the next occurrence and hands the rule over to it.
 *
 * Both halves belong in one transaction: a successor that was written while
 * the rule stayed behind would be written again on the next run.
 */
export async function spawnNextTaskOccurrence(task: RecurringTask): Promise<Date | null> {
  if (!task.repeatEvery || !task.repeatUnit) {
    return null;
  }

  const repeat = { repeatEvery: task.repeatEvery, repeatUnit: task.repeatUnit };
  const dueDate = nextTaskDueDate(task.dueDate, repeat);

  await prisma.$transaction([
    prisma.task.create({
      data: {
        title: task.title,
        description: task.description,
        dueDate,
        barId: task.barId,
        createdById: task.createdById,
        assignedToAll: task.assignedToAll,
        assignedToId: task.assignedToAll ? null : task.assignedToId,
        requiresConfirmation: task.requiresConfirmation,
        status: TaskStatus.TODO,
        // Urgency belongs to a date, not to a series. Carrying it over would
        // make every future check urgent for good, because that is exactly
        // what the escalation marks a late one as.
        isUrgent: false,
        repeatEvery: task.repeatEvery,
        repeatUnit: task.repeatUnit,
      },
    }),
    prisma.task.update({
      where: { id: task.id },
      data: { repeatEvery: null, repeatUnit: null },
    }),
  ]);

  return dueDate;
}

/**
 * Advances the reminders that nobody ticks off.
 *
 * A note marked "da confermare" moves on when it is confirmed, which is the
 * honest reading of a check: until someone says it was done, it is still due.
 * A plain reminder has no confirmation to wait for, so its date passing is the
 * only signal there is.
 */
export async function runTaskRecurrence(): Promise<{ count: number }> {
  const now = new Date();

  const dueSeries = await prisma.task.findMany({
    where: {
      repeatEvery: { not: null },
      repeatUnit: { not: null },
      requiresConfirmation: false,
      dueDate: { lt: now },
    },
    select: RECURRING_TASK_FIELDS,
  });

  let count = 0;

  for (const task of dueSeries) {
    await spawnNextTaskOccurrence(task);
    count += 1;
  }

  return { count };
}
