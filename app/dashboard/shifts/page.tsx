import { ActivityType, RequestStatus, RequestType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildShiftPresets } from "@/lib/shift-presets";
import { createShiftAction } from "../actions";
import { getDashboardContext } from "../context";
import {
  BillingRequiredState,
  EmptyState,
  ItemCard,
  ItemList,
  Panel,
  Stack,
  formatDateTime,
} from "../ui";
import { PlannedShiftsList } from "./planned-shifts-list";
import { ShiftCreateForm } from "./shift-create-form";

function getLocale(language: string) {
  if (language === "en") {
    return "en-US";
  }

  if (language === "es") {
    return "es-ES";
  }

  if (language === "fr") {
    return "fr-FR";
  }

  return "it-IT";
}

export default async function DashboardShiftsPage() {
  const {
    session,
    role,
    activeBarId,
    activeBarActivityType,
    language,
    billingStatus,
  } = await getDashboardContext();

  if (!activeBarId) {
    return (
      <Panel title="Turni">
        <EmptyState message="Seleziona un locale attivo per gestire il calendario turni." />
      </Panel>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return <BillingRequiredState role={String(role)} />;
  }

  const isCompany = activeBarActivityType === ActivityType.COMPANY;
  const canManage = role === Role.OWNER || role === Role.MANAGER;
  const [shifts, members, availabilities, approvedTimeOff, settings] = await Promise.all([
    prisma.shift.findMany({
      where: { barId: activeBarId },
      orderBy: {
        startTime: "asc",
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        confirmedAt: true,
        isOnCall: true,
        assignments: {
          select: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    canManage
      ? prisma.employeeBar.findMany({
          where: {
            barId: activeBarId,
            isActive: true,
          },
          orderBy: [{ role: "asc" }, { hiredAt: "asc" }],
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
        })
      : Promise.resolve([]),
    prisma.availability.findMany({
      where: {
        barId: activeBarId,
        endsAt: {
          gte: new Date(),
        },
      },
      orderBy: {
        startsAt: "asc",
      },
      take: 8,
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        reason: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    prisma.request.findMany({
      where: {
        barId: activeBarId,
        type: {
          in: [RequestType.VACATION, RequestType.PERMISSION, RequestType.SICKNESS],
        },
        status: RequestStatus.APPROVED,
        endsAt: {
          gte: new Date(),
        },
      },
      orderBy: {
        startsAt: "asc",
      },
      take: 8,
      select: {
        id: true,
        type: true,
        startsAt: true,
        endsAt: true,
        reason: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    canManage
      ? prisma.barSettings.findUnique({
          where: {
            barId: activeBarId,
          },
          select: {
            morningStartTime: true,
            morningEndTime: true,
            afternoonStartTime: true,
            afternoonEndTime: true,
            eveningStartTime: true,
            eveningEndTime: true,
            companyShiftsEnabled: true,
          },
        })
      : Promise.resolve(null),
  ]);
  const shiftPresets = buildShiftPresets(settings);
  const shiftsEnabled = !isCompany || Boolean(settings?.companyShiftsEnabled);
  const canManageShifts = canManage && shiftsEnabled;

  return (
    <Stack>
      {canManageShifts ? (
        <Panel title="Crea turno condiviso">
          <ShiftCreateForm
            action={createShiftAction}
            presets={shiftPresets}
            members={members.map((member) => ({
              id: member.user.id,
              firstName: member.user.firstName,
              lastName: member.user.lastName,
              role: member.role,
            }))}
          />
        </Panel>
      ) : isCompany ? (
        <Panel title="Turni aziendali">
          <EmptyState message="Attiva i turni nelle impostazioni per gestirli." />
        </Panel>
      ) : null}

      <Panel title="Turni pianificati" action={`${shifts.length} turni`}>
        {shifts.length === 0 ? (
          <EmptyState message="Nessun turno ancora pianificato." />
        ) : (
          <PlannedShiftsList
            locale={getLocale(language)}
            canManage={canManageShifts}
            members={members.map((member) => ({
              id: member.user.id,
              firstName: member.user.firstName,
              lastName: member.user.lastName,
              role: member.role,
            }))}
            presets={shiftPresets}
            shifts={shifts.map((shift) => ({
              id: shift.id,
              title: shift.title,
              startTime: shift.startTime.toISOString(),
              endTime: shift.endTime.toISOString(),
              confirmedAt: shift.confirmedAt?.toISOString() ?? null,
              isOnCall: shift.isOnCall,
              assignments: shift.assignments.map((entry) => ({
                id: entry.user.id,
                firstName: entry.user.firstName,
                lastName: entry.user.lastName,
              })),
              createdBy: {
                firstName: shift.createdBy.firstName,
                lastName: shift.createdBy.lastName,
              },
              highlight:
                role === Role.EMPLOYEE &&
                shift.assignments.some((entry) => entry.user.id === session.user.id),
            }))}
            currentUserId={session.user.id}
          />
        )}
      </Panel>

      <Panel title="Indisponibilita registrate">
        {availabilities.length === 0 ? (
          <EmptyState message="Nessuna indisponibilita futura registrata." />
        ) : (
          <ItemList scrollable>
            {availabilities.map((availability) => (
              <ItemCard
                key={availability.id}
                title={`${availability.user.firstName} ${availability.user.lastName}`}
                subtitle={`${formatDateTime(availability.startsAt)} - ${formatDateTime(availability.endsAt)}`}
                meta={availability.reason || "Nessuna nota aggiuntiva"}
              />
            ))}
          </ItemList>
        )}
      </Panel>

      <Panel title="Assenze approvate">
        {approvedTimeOff.length === 0 ? (
          <EmptyState message="Nessuna assenza approvata nel periodo corrente." />
        ) : (
          <ItemList scrollable>
            {approvedTimeOff.map((request) => (
              <ItemCard
                key={request.id}
                title={`${request.employee.firstName} ${request.employee.lastName}`}
                subtitle={`${
                  request.type === "VACATION"
                    ? "Ferie"
                    : request.type === "SICKNESS"
                      ? "Malattia"
                      : "Permesso"
                } - ${formatDateTime(request.startsAt ?? new Date())} - ${formatDateTime(request.endsAt ?? new Date())}`}
                meta={request.reason || "Richiesta approvata"}
              />
            ))}
          </ItemList>
        )}
      </Panel>
    </Stack>
  );
}
