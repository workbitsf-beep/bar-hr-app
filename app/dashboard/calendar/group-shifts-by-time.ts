import { APP_TIME_ZONE } from "@/lib/time-zone";

type ShiftAssignmentLike = {
  id: string;
};

type ShiftLike = {
  id: string;
  startTime: string;
  endTime: string;
  confirmedAt: string | null;
  isOnCall: boolean;
  assignments: ShiftAssignmentLike[];
};

const timeKeyFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function toMinuteKey(value: string) {
  return timeKeyFormatter.format(new Date(value));
}

export function groupShiftsByTime<T extends ShiftLike>(shifts: T[]): T[] {
  const grouped = new Map<string, T>();

  for (const shift of shifts) {
    const key = `${toMinuteKey(shift.startTime)}|${toMinuteKey(shift.endTime)}|${shift.isOnCall ? "on-call" : "shift"}`;
    const current = grouped.get(key);

    if (!current) {
      grouped.set(key, {
        ...shift,
        assignments: [...shift.assignments],
      });
      continue;
    }

    const assignmentIds = new Set(current.assignments.map((assignment) => assignment.id));
    const assignments = current.assignments.concat(
      shift.assignments.filter((assignment) => !assignmentIds.has(assignment.id))
    );

    grouped.set(key, {
      ...current,
      assignments,
      confirmedAt: current.confirmedAt && shift.confirmedAt ? current.confirmedAt : null,
    });
  }

  return Array.from(grouped.values());
}
