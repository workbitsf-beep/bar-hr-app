import { ClockType } from "@prisma/client";
import { getVenueDepartments } from "@/lib/departments";
import { prisma } from "@/lib/prisma";
import { withBar } from "@/lib/withBar";

/**
 * What the phone's widgets and the Live Activity show, for the person signed
 * in at their active venue: their published shifts around this week and the
 * entry they are working on, if any.
 *
 * The app hands this to the native side every time it opens. The widgets
 * then work out "next shift" and "this week" from it by themselves, so they
 * stay right as the hours pass without asking the server again.
 */

const PAST_MS = 8 * 24 * 60 * 60 * 1000;
const AHEAD_MS = 15 * 24 * 60 * 60 * 1000;
// Past this an entry is a forgotten exit, not someone at work.
const OPEN_ENTRY_MS = 16 * 60 * 60 * 1000;

export const GET = withBar(async (_req, session) => {
  const barId = session.activeBarId;
  const userId = session.user.id;
  const now = new Date();

  const [bar, shifts, last, departments] = await Promise.all([
    prisma.bar.findUnique({ where: { id: barId }, select: { name: true } }),
    prisma.shift.findMany({
      where: {
        barId,
        isOnCall: false,
        confirmedAt: { not: null },
        startTime: { gte: new Date(now.getTime() - PAST_MS), lt: new Date(now.getTime() + AHEAD_MS) },
        assignments: { some: { userId } },
      },
      orderBy: { startTime: "asc" },
      take: 40,
      select: { startTime: true, endTime: true, department: true },
    }),
    prisma.timeLog.findFirst({
      where: { barId, userId },
      orderBy: { timestamp: "desc" },
      select: { type: true, timestamp: true, shift: { select: { endTime: true, department: true } } },
    }),
    getVenueDepartments(barId, userId),
  ]);

  const names = new Map<string, string>();
  if (departments.enabled) {
    for (const entry of [...departments.list, ...departments.sites]) names.set(entry.id, entry.name);
  }
  const area = (department: string | null | undefined) => (department ? names.get(department) ?? "" : "");

  const open =
    last && last.type === ClockType.IN && now.getTime() - last.timestamp.getTime() < OPEN_ENTRY_MS
      ? {
          since: last.timestamp.getTime(),
          end: last.shift && last.shift.endTime > last.timestamp ? last.shift.endTime.getTime() : null,
          area: area(last.shift?.department),
        }
      : null;

  return Response.json({
    v: 1,
    venue: bar?.name ?? "",
    shifts: shifts.map((shift) => ({
      start: shift.startTime.getTime(),
      end: shift.endTime.getTime(),
      area: area(shift.department),
    })),
    open,
  });
});
