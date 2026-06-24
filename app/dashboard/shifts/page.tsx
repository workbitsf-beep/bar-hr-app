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
import { PopupAction } from "../popup-action";
import { PlannedShiftsList } from "./planned-shifts-list";
import { ShiftCreateForm } from "./shift-create-form";

type ShiftPageSettings = {
  morningStartTime?: string | null;
  morningEndTime?: string | null;
  afternoonStartTime?: string | null;
  afternoonEndTime?: string | null;
  eveningStartTime?: string | null;
  eveningEndTime?: string | null;
  standardShiftPresets?: unknown;
  companyShiftsEnabled?: boolean | null;
};

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

function isMissingColumnError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2022"
  );
}

async function getShiftPageSettings(barId: string, canManage: boolean) {
  if (!canManage) {
    return null;
  }

  try {
    return await prisma.barSettings.findUnique({
      where: {
        barId,
      },
      select: {
        morningStartTime: true,
        morningEndTime: true,
        afternoonStartTime: true,
        afternoonEndTime: true,
        eveningStartTime: true,
        eveningEndTime: true,
        standardShiftPresets: true,
        companyShiftsEnabled: true,
      },
    });
  } catch (error) {
    if (!isMissingColumnError(error)) {
      throw error;
    }
  }

  const expectedColumns = [
    "morningStartTime",
    "morningEndTime",
    "afternoonStartTime",
    "afternoonEndTime",
    "eveningStartTime",
    "eveningEndTime",
    "standardShiftPresets",
    "companyShiftsEnabled",
  ];
  const availableColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'BarSettings'
      AND column_name IN (
        'morningStartTime',
        'morningEndTime',
        'afternoonStartTime',
        'afternoonEndTime',
        'eveningStartTime',
        'eveningEndTime',
        'standardShiftPresets',
        'companyShiftsEnabled'
      )
  `;
  const columnSet = new Set(availableColumns.map((column) => column.column_name));
  const selectedColumns = expectedColumns.filter((column) => columnSet.has(column));

  if (selectedColumns.length === 0) {
    return null;
  }

  const quotedColumns = selectedColumns.map((column) => `"${column}"`).join(", ");
  const rows = await prisma.$queryRawUnsafe<ShiftPageSettings[]>(
    `SELECT ${quotedColumns} FROM "BarSettings" WHERE "barId" = $1 LIMIT 1`,
    barId
  );

  const row = rows[0];

  return row ? { ...row, companyShiftsEnabled: row.companyShiftsEnabled ?? true } : null;
}

export default async function DashboardShiftsPage() {
  const {
    session,
    role,
    activeBarId,
    activeBarActivityType,
    language,
    billingStatus,
    features,
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

  if (!features.shifts) {
    return (
      <Panel title="Turni">
        <EmptyState message="Modulo turni disattivato nelle impostazioni." />
      </Panel>
    );
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
    features.availability
      ? prisma.availability.findMany({
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
        })
      : Promise.resolve([]),
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
    getShiftPageSettings(activeBarId, canManage),
  ]);
  const shiftPresets = buildShiftPresets(settings);
  const shiftsEnabled = !isCompany || Boolean(settings?.companyShiftsEnabled);
  const canManageShifts = canManage && shiftsEnabled;

  return (
    <Stack>
      {canManageShifts ? (
        <Panel
          title="Crea turno condiviso"
          action={
            <PopupAction title="Nuovo turno" ariaLabel="Aggiungi turno">
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
            </PopupAction>
          }
        >
          <EmptyState message="Apri il popup con il + per creare o modificare un turno." />
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

      {features.availability ? (
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
      ) : null}

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
