import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canManageOperations, getActiveBarAccess } from "@/lib/permissions";
import { parseDateTimeLocal } from "@/lib/date-time-local";
import {
  matchShiftPhotoMember,
  type ShiftPhotoMember,
} from "@/lib/shift-photo-parser";
import { withBar } from "@/lib/withBar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionWithBar = {
  activeBarId: string;
  user: {
    id: string;
    role: Role;
  };
};

type ImportedShiftRow = {
  employeeId?: string | null;
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  confidence?: number;
  notes?: string;
};

function isValidDateValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTimeValue(value: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function buildStaffMemberList(input: {
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    role: Role;
  };
  memberships: Array<{
    role: Role;
    user: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }>;
}): ShiftPhotoMember[] {
  const members = new Map<string, ShiftPhotoMember>();

  members.set(input.owner.id, {
    id: input.owner.id,
    firstName: input.owner.firstName,
    lastName: input.owner.lastName,
    role: input.owner.role,
  });

  for (const membership of input.memberships) {
    members.set(membership.user.id, {
      id: membership.user.id,
      firstName: membership.user.firstName,
      lastName: membership.user.lastName,
      role: membership.role,
    });
  }

  return Array.from(members.values());
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export const POST = withBar(async (req: Request, session: SessionWithBar): Promise<Response> => {
  const access = await getActiveBarAccess(session as never);

  if (!canManageOperations(access.role)) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { shifts?: ImportedShiftRow[] };
    const rows = Array.isArray(body.shifts) ? body.shifts : [];

    if (rows.length === 0) {
      return Response.json({ ok: false, message: "Nessun turno da importare." }, { status: 400 });
    }

    const bar = await prisma.bar.findUnique({
      where: { id: session.activeBarId },
      select: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        memberships: {
          where: { isActive: true },
          select: {
            role: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!bar) {
      return Response.json({ ok: false, message: "Locale non trovato." }, { status: 404 });
    }

    const members = buildStaffMemberList({
      owner: bar.owner,
      memberships: bar.memberships,
    });
    const memberIds = new Set(members.map((member) => member.id));
    const errors: Array<{ index: number; message: string }> = [];
    const normalizedRows = rows.map((row, index) => {
      const employeeId = String(row.employeeId ?? "").trim();
      const employeeName = normalizeName(String(row.employeeName ?? ""));
      const date = String(row.date ?? "").trim();
      const startTime = String(row.startTime ?? "").trim();
      const endTime = String(row.endTime ?? "").trim();
      const notes = String(row.notes ?? "").trim();

      if (!employeeName) {
        errors.push({ index, message: "Seleziona un dipendente." });
      }

      if (!isValidDateValue(date)) {
        errors.push({ index, message: "Data non valida." });
      }

      if (!isValidTimeValue(startTime) || !isValidTimeValue(endTime)) {
        errors.push({ index, message: "Orari non validi." });
      }

      const startAt = parseDateTimeLocal(`${date}T${startTime}`);
      const endAt = parseDateTimeLocal(`${date}T${endTime}`);

      if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
        errors.push({ index, message: "L'intervallo del turno non è valido." });
      }

      let resolvedEmployeeId = employeeId;

      if (resolvedEmployeeId && !memberIds.has(resolvedEmployeeId)) {
        errors.push({ index, message: "Dipendente non valido per questo locale." });
      }

      if (!resolvedEmployeeId) {
        const matched = matchShiftPhotoMember(employeeName, members);
        resolvedEmployeeId = matched?.id ?? "";

        if (!resolvedEmployeeId) {
          errors.push({ index, message: "Abbina il dipendente prima di importare." });
        }
      }

      return {
        index,
        employeeId: resolvedEmployeeId,
        employeeName,
        date,
        startTime,
        endTime,
        notes,
        startAt,
        endAt,
      };
    });

    if (errors.length > 0) {
      return Response.json(
        {
          ok: false,
          message: "Completa o correggi le righe prima di importare.",
          errors,
        },
        { status: 400 }
      );
    }

    let createdCount = 0;
    let skippedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const row of normalizedRows) {
        const existing = await tx.shift.findFirst({
          where: {
            barId: session.activeBarId,
            startTime: row.startAt,
            endTime: row.endAt,
            assignments: {
              some: {
                userId: row.employeeId,
              },
            },
          },
          select: {
            id: true,
          },
        });

        if (existing) {
          skippedCount += 1;
          continue;
        }

        await tx.shift.create({
          data: {
            title: null,
            startTime: row.startAt,
            endTime: row.endAt,
            isOnCall: false,
            confirmedAt:
              row.employeeId === session.user.id ? new Date() : null,
            confirmedById:
              row.employeeId === session.user.id ? session.user.id : null,
            assignedToId: row.employeeId,
            barId: session.activeBarId,
            createdById: session.user.id,
            assignments: {
              createMany: {
                data: [
                  {
                    userId: row.employeeId,
                  },
                ],
              },
            },
          },
        });

        createdCount += 1;
      }
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/shifts");

    return Response.json({
      ok: true,
      createdCount,
      skippedCount,
    });
  } catch (error) {
    console.error("[shifts/import-confirm] failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return Response.json(
      {
        ok: false,
        message:
          error instanceof Error && error.message
            ? error.message
            : "Impossibile importare i turni.",
      },
      { status: 500 }
    );
  }
});
