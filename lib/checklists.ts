import { ChecklistMoment, Role, type Department } from "@prisma/client";
import { getVenueDepartments, staffDepartments, type DepartmentInfo } from "@/lib/departments";
import { prisma } from "@/lib/prisma";
import { toDateInputValueInTimeZone, toTimeInputValueInTimeZone } from "@/lib/time-zone";

/**
 * Opening and closing checklists, one per department (Pro).
 *
 * A checklist starts empty every day. Its day is the venue's calendar day,
 * stored at UTC midnight like every other day key (lib/day-key.ts), so the
 * same list ticked at 23:50 and at 00:10 lands on the right days.
 */

export const MOMENT_LABELS: Record<ChecklistMoment, string> = {
  OPENING: "Apertura",
  CLOSING: "Chiusura",
};

export function checklistDay(now = new Date()) {
  return new Date(`${toDateInputValueInTimeZone(now)}T00:00:00.000Z`);
}

/** At most 20 lines of up to 80 characters: a checklist, not a manual. */
export function parseChecklistItems(raw: string) {
  return raw
    .split("\n")
    .map((line) => line.trim().replace(/^[-•*]\s*/, "").slice(0, 80))
    .filter(Boolean)
    .slice(0, 20);
}

export type TodayChecklist = {
  id: string;
  department: DepartmentInfo;
  moment: ChecklistMoment;
  items: string[];
  done: string[];
  completedBy: string | null;
  completedAt: string | null;
  /** Whether the person looking may tick it. */
  canTick: boolean;
};

/**
 * Today's checklists for one person: the owner and managers see every
 * department; everyone else the departments they work in or help with.
 */
export async function getTodayChecklists(barId: string, userId: string, role: Role | string): Promise<TodayChecklist[]> {
  const departments = await getVenueDepartments(barId, userId);
  if (!departments.enabled) return [];

  const runsAll = role === Role.OWNER || role === Role.MANAGER || String(role) === "SUPER_ADMIN";
  const mine = new Set<Department>(
    [departments.mine.department, ...departments.mine.helpsIn].filter((value): value is Department => Boolean(value))
  );
  const visible = staffDepartments(departments.list).filter((department) => runsAll || mine.has(department.id));
  if (visible.length === 0) return [];

  const checklists = await prisma.checklist.findMany({
    where: { barId, department: { in: visible.map((department) => department.id) } },
    select: {
      id: true,
      department: true,
      moment: true,
      items: true,
      runs: {
        where: { day: checklistDay() },
        select: { doneItems: true, completedAt: true, completedBy: { select: { firstName: true } } },
      },
    },
  });

  return visible.flatMap((department) =>
    [ChecklistMoment.OPENING, ChecklistMoment.CLOSING].flatMap((moment) => {
      const checklist = checklists.find((entry) => entry.department === department.id && entry.moment === moment);
      if (!checklist || checklist.items.length === 0) return [];
      const run = checklist.runs[0];
      return [
        {
          id: checklist.id,
          department,
          moment,
          items: checklist.items,
          done: (run?.doneItems ?? []).filter((item) => checklist.items.includes(item)),
          completedBy: run?.completedBy?.firstName ?? null,
          completedAt: run?.completedAt ? toTimeInputValueInTimeZone(run.completedAt) : null,
          canTick: runsAll || mine.has(department.id),
        },
      ];
    })
  );
}
