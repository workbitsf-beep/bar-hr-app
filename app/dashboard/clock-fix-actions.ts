"use server";

import { ClockFixKind, ClockFixStatus, ClockType, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { clockTime, getEmployeeClockFixState, reviewersOf, timeNear } from "@/lib/clock-fixes";
import { shortName } from "@/lib/clock-notifications";
import { INTERNAL_NOTIFICATION_TYPES, notifyUsers } from "@/lib/notifications";
import { getActiveBarAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { invalidateReportingCache } from "@/lib/reporting";
import { RuleError, ruleFailure } from "@/lib/rule-error";
import { can, isStaffRole } from "@/lib/staff-permissions";
import { ensureMembersInScope } from "@/lib/staff-scope";
import { closeClockInReminders, closeClockOutReminders } from "@/lib/timelog-reminders";

/**
 * Forgotten entries and exits (see lib/clock-fixes.ts): the person asks, the
 * owner or a manager approves, and only the approval writes the stamp.
 */

const HOUR = 60 * 60 * 1000;

async function context() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const { activeBar, role, staff } = await getActiveBarAccess(session);
  if (!activeBar?.id) throw new Error("No active bar selected");
  return { session, role, staff, barId: activeBar.id };
}

function refresh() {
  for (const path of ["/dashboard", "/dashboard/presenze"]) revalidatePath(path, "layout");
}

function readTime(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value || null;
}

/** The person: "I came in at…" or "I left at…", sent to the owner. */
export async function requestClockFixAction(formData: FormData) {
  try {
    const { session, role, barId } = await context();
    if (role === Role.OWNER) throw new RuleError("Il titolare non timbra.");

    const now = new Date();
    const { offer } = await getEmployeeClockFixState(barId, session.user.id, now);
    const kind = String(formData.get("kind") ?? "");
    if (!offer || offer.kind !== kind) throw new RuleError("Non c'è niente da segnalare: aggiorna la pagina.");

    const shiftStart = offer.shiftStart ? new Date(offer.shiftStart) : null;
    const shiftEnd = offer.shiftEnd ? new Date(offer.shiftEnd) : null;
    const inAt = offer.inAt ? new Date(offer.inAt) : null;

    let requestedInAt: Date | null = null;
    let requestedOutAt: Date | null = null;

    if (offer.kind === ClockFixKind.MISSED_OUT) {
      const reference = shiftEnd ?? new Date((inAt ?? now).getTime() + 8 * HOUR);
      const raw = readTime(formData, "out");
      requestedOutAt = raw ? timeNear(reference, raw) : null;
      if (!requestedOutAt) throw new RuleError("Scegli l'ora di uscita.");
      if (inAt && requestedOutAt <= inAt) {
        throw new RuleError(`L'uscita deve essere dopo l'entrata delle ${clockTime(inAt)}.`);
      }
    } else {
      const rawIn = readTime(formData, "in");
      requestedInAt = rawIn && shiftStart ? timeNear(shiftStart, rawIn) : null;
      if (!requestedInAt) throw new RuleError("Scegli l'ora di entrata.");
      if (offer.needsOut) {
        const rawOut = readTime(formData, "out");
        requestedOutAt = rawOut && shiftEnd ? timeNear(shiftEnd, rawOut) : null;
        if (!requestedOutAt) throw new RuleError("Scegli l'ora di uscita.");
        if (requestedOutAt <= requestedInAt) throw new RuleError("L'uscita deve essere dopo l'entrata.");
      }
    }

    if ((requestedInAt && requestedInAt > now) || (requestedOutAt && requestedOutAt > now)) {
      throw new RuleError("L'orario non può essere nel futuro.");
    }

    await prisma.clockFix.create({
      data: {
        barId,
        userId: session.user.id,
        shiftId: offer.shiftId,
        clockInId: offer.clockInId,
        kind: offer.kind,
        requestedInAt,
        requestedOutAt,
      },
    });

    if (offer.kind === ClockFixKind.MISSED_OUT) {
      await closeClockOutReminders({ userId: session.user.id, barId, shiftId: offer.shiftId });
    } else {
      await closeClockInReminders({ userId: session.user.id, barId, shiftId: offer.shiftId });
    }

    const what =
      offer.kind === ClockFixKind.MISSED_OUT
        ? `Uscita alle ${clockTime(requestedOutAt)}`
        : `Entrata alle ${clockTime(requestedInAt)}` + (requestedOutAt ? `, uscita alle ${clockTime(requestedOutAt)}` : "");
    await notifyUsers(await reviewersOf(barId, session.user.id), {
      barId,
      title: `${shortName(session.user)}: ${offer.kind === ClockFixKind.MISSED_OUT ? "uscita dimenticata" : "entrata dimenticata"}`,
      message: `${what} · Tocca per approvare`,
      type: INTERNAL_NOTIFICATION_TYPES.REQUEST_CREATED,
      actionUrl: "/dashboard",
    });

    refresh();
    return { ok: true as const };
  } catch (error) {
    return ruleFailure(error);
  }
}

async function reviewerContext() {
  const ctx = await context();
  if (!can(ctx.staff, "timelogs")) {
    throw new RuleError("Solo il titolare o un responsabile può approvarla.");
  }
  return ctx;
}

async function pendingFix(ctx: Awaited<ReturnType<typeof reviewerContext>>, id: string) {
  const { barId } = ctx;
  const fix = await prisma.clockFix.findFirst({
    where: { id, barId, status: ClockFixStatus.PENDING },
    select: {
      id: true,
      kind: true,
      userId: true,
      shiftId: true,
      clockInId: true,
      requestedInAt: true,
      requestedOutAt: true,
      shift: { select: { startTime: true, endTime: true } },
    },
  });
  if (!fix) throw new RuleError("Questa richiesta è già stata gestita.");
  if (isStaffRole(ctx.staff.role) && fix.userId === ctx.session.user.id) {
    throw new RuleError("Le tue ore le corregge il titolare.");
  }
  await ensureMembersInScope(ctx.staff, "timelogs", barId, [fix.userId]);
  return fix;
}

/** The owner: stamps the entry or exit, at the time asked for or at another. */
export async function approveClockFixAction(formData: FormData) {
  try {
    const ctx = await reviewerContext();
    const { session, barId } = ctx;
    const fix = await pendingFix(ctx, String(formData.get("id") ?? ""));
    const now = new Date();
    const note =
      fix.kind === ClockFixKind.MISSED_OUT ? "Uscita dimenticata, approvata" : "Entrata dimenticata, approvata";

    let resolvedInAt: Date | null = null;
    let resolvedOutAt: Date | null = null;
    const writes: Array<{ type: ClockType; timestamp: Date }> = [];
    let provisionalWindow: { from: Date; to: Date | null } | null = null;

    if (fix.kind === ClockFixKind.MISSED_OUT) {
      const entry = fix.clockInId
        ? await prisma.timeLog.findFirst({ where: { id: fix.clockInId, barId, userId: fix.userId }, select: { timestamp: true } })
        : null;
      if (!entry) {
        await prisma.clockFix.update({ where: { id: fix.id }, data: { status: ClockFixStatus.REJECTED, reviewedById: session.user.id, reviewedAt: now } });
        throw new RuleError("L'entrata di quel turno non c'è più: richiesta chiusa.");
      }
      const reference = fix.requestedOutAt ?? fix.shift?.endTime ?? entry.timestamp;
      const raw = readTime(formData, "out");
      resolvedOutAt = raw ? timeNear(reference, raw) : fix.requestedOutAt;
      if (!resolvedOutAt) throw new RuleError("Scegli l'orario di uscita.");
      if (resolvedOutAt <= entry.timestamp) {
        throw new RuleError(`L'uscita deve essere dopo l'entrata delle ${clockTime(entry.timestamp)}.`);
      }
      if (resolvedOutAt > now) throw new RuleError("L'orario non può essere nel futuro.");

      const nextEntry = await prisma.timeLog.findFirst({
        where: { barId, userId: fix.userId, type: ClockType.IN, timestamp: { gt: entry.timestamp } },
        orderBy: { timestamp: "asc" },
        select: { timestamp: true },
      });
      if (nextEntry && resolvedOutAt >= nextEntry.timestamp) {
        throw new RuleError(`L'uscita deve essere prima della sua entrata successiva, alle ${clockTime(nextEntry.timestamp)}.`);
      }
      const alreadyOut = await prisma.timeLog.count({
        where: {
          barId,
          userId: fix.userId,
          type: ClockType.OUT,
          // The provisional exit at the shift's end is what this replaces.
          autoClockOut: false,
          timestamp: { gt: entry.timestamp, ...(nextEntry ? { lt: nextEntry.timestamp } : {}) },
        },
      });
      if (!alreadyOut) {
        writes.push({ type: ClockType.OUT, timestamp: resolvedOutAt });
        provisionalWindow = { from: entry.timestamp, to: nextEntry?.timestamp ?? null };
      }
    } else {
      const rawIn = readTime(formData, "in");
      const inReference = fix.requestedInAt ?? fix.shift?.startTime ?? now;
      resolvedInAt = rawIn ? timeNear(inReference, rawIn) : fix.requestedInAt;
      if (!resolvedInAt) throw new RuleError("Scegli l'orario di entrata.");
      if (fix.requestedOutAt) {
        const rawOut = readTime(formData, "out");
        resolvedOutAt = rawOut ? timeNear(fix.requestedOutAt, rawOut) : fix.requestedOutAt;
        if (!resolvedOutAt || resolvedOutAt <= resolvedInAt) throw new RuleError("L'uscita deve essere dopo l'entrata.");
      }
      if (resolvedInAt > now || (resolvedOutAt && resolvedOutAt > now)) {
        throw new RuleError("L'orario non può essere nel futuro.");
      }
      // The exit they stamped themselves, if they did, must come after the entry.
      const ownExit = fix.shiftId
        ? await prisma.timeLog.findFirst({
            where: { barId, userId: fix.userId, type: ClockType.OUT, shiftId: fix.shiftId },
            orderBy: { timestamp: "asc" },
            select: { timestamp: true },
          })
        : null;
      if (ownExit && resolvedInAt >= ownExit.timestamp) {
        throw new RuleError(`L'entrata deve essere prima della sua uscita delle ${clockTime(ownExit.timestamp)}.`);
      }
      const alreadyIn = fix.shiftId
        ? await prisma.timeLog.count({ where: { barId, userId: fix.userId, type: ClockType.IN, shiftId: fix.shiftId } })
        : 0;
      if (!alreadyIn) {
        writes.push({ type: ClockType.IN, timestamp: resolvedInAt });
        if (resolvedOutAt && !ownExit) writes.push({ type: ClockType.OUT, timestamp: resolvedOutAt });
      }
    }

    const claimed = await prisma.$transaction(async (tx) => {
      const { count } = await tx.clockFix.updateMany({
        where: { id: fix.id, status: ClockFixStatus.PENDING },
        data: {
          status: ClockFixStatus.APPROVED,
          resolvedInAt,
          resolvedOutAt,
          reviewedById: session.user.id,
          reviewedAt: now,
        },
      });
      if (count === 0) return false;
      if (provisionalWindow) {
        await tx.timeLog.deleteMany({
          where: {
            barId,
            userId: fix.userId,
            type: ClockType.OUT,
            autoClockOut: true,
            timestamp: { gt: provisionalWindow.from, ...(provisionalWindow.to ? { lt: provisionalWindow.to } : {}) },
          },
        });
      }
      if (writes.length) {
        await tx.timeLog.createMany({
          data: writes.map((write) => ({
            type: write.type,
            timestamp: write.timestamp,
            userId: fix.userId,
            barId,
            shiftId: fix.shiftId,
            createdById: session.user.id,
            isManual: true,
            note,
          })),
        });
      }
      return true;
    });
    if (!claimed) throw new RuleError("Questa richiesta è già stata gestita.");

    invalidateReportingCache(barId, fix.userId);
    const reviewer = session.user.firstName;
    await notifyUsers([fix.userId], {
      barId,
      title: fix.kind === ClockFixKind.MISSED_OUT ? "Uscita registrata" : "Entrata registrata",
      message:
        fix.kind === ClockFixKind.MISSED_OUT
          ? `Alle ${clockTime(resolvedOutAt)} · da ${reviewer}`
          : `Alle ${clockTime(resolvedInAt)}` + (resolvedOutAt ? `, uscita alle ${clockTime(resolvedOutAt)}` : "") + ` · da ${reviewer}`,
      type: INTERNAL_NOTIFICATION_TYPES.REQUEST_REVIEWED,
      actionUrl: "/dashboard/presenze",
    });

    refresh();
    return { ok: true as const };
  } catch (error) {
    return ruleFailure(error);
  }
}

/** The owner: not approved. The stamp stays to be sorted out by hand. */
export async function rejectClockFixAction(formData: FormData) {
  try {
    const ctx = await reviewerContext();
    const { session, barId } = ctx;
    const fix = await pendingFix(ctx, String(formData.get("id") ?? ""));
    const { count } = await prisma.clockFix.updateMany({
      where: { id: fix.id, status: ClockFixStatus.PENDING },
      data: { status: ClockFixStatus.REJECTED, reviewedById: session.user.id, reviewedAt: new Date() },
    });
    if (count === 0) throw new RuleError("Questa richiesta è già stata gestita.");

    await notifyUsers([fix.userId], {
      barId,
      title: fix.kind === ClockFixKind.MISSED_OUT ? "Uscita non approvata" : "Entrata non approvata",
      message: `Parlane con ${session.user.firstName}.`,
      type: INTERNAL_NOTIFICATION_TYPES.REQUEST_REVIEWED,
      actionUrl: "/dashboard",
    });

    refresh();
    return { ok: true as const };
  } catch (error) {
    return ruleFailure(error);
  }
}
