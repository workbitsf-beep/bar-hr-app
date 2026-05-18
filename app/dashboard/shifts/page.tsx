import { RequestStatus, RequestType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createShiftAction } from "../actions";
import { getDashboardContext } from "../context";
import {
  BillingRequiredState,
  EmptyState,
  FormField,
  ItemCard,
  ItemList,
  Panel,
  PrimaryButton,
  Stack,
  TextInput,
  formatDateTime,
} from "../ui";
import { PlannedShiftsList } from "./planned-shifts-list";

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
  const { session, role, activeBarId, language, billingStatus } = await getDashboardContext();

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

  const canManage = role === Role.OWNER || role === Role.MANAGER;
  const [shifts, members, availabilities, approvedTimeOff] = await Promise.all([
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
            role: {
              not: Role.OWNER,
            },
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
          in: [RequestType.VACATION, RequestType.PERMISSION],
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
  ]);

  return (
    <Stack>
      {canManage ? (
        <Panel title="Crea turno condiviso">
          <form action={createShiftAction} style={{ display: "grid", gap: 16 }}>
            <FormField label="Titolo turno">
              <TextInput name="title" placeholder="Servizio pranzo" />
            </FormField>

            <div
              className="dashboard-inline-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <FormField label="Inizio">
                <TextInput name="startTime" type="datetime-local" required />
              </FormField>

              <FormField label="Fine">
                <TextInput name="endTime" type="datetime-local" required />
              </FormField>
            </div>

            <FormField label="Persone nel turno">
              <div className="dashboard-member-grid" style={{ display: "grid", gap: 10 }}>
                {members.map((member) => (
                  <label
                    key={member.user.id}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      color: "#334155",
                    }}
                  >
                    <input type="checkbox" name="employeeIds" value={member.user.id} />
                    {member.user.firstName} {member.user.lastName} - {member.role}
                  </label>
                ))}
              </div>
            </FormField>

            <div className="dashboard-form-actions">
              <PrimaryButton type="submit">Salva turno</PrimaryButton>
            </div>
          </form>
        </Panel>
      ) : null}

      <Panel title="Turni pianificati" action={`${shifts.length} turni`}>
        {shifts.length === 0 ? (
          <EmptyState message="Nessun turno ancora pianificato." />
        ) : (
          <PlannedShiftsList
            locale={getLocale(language)}
            canManage={canManage}
            members={members.map((member) => ({
              id: member.user.id,
              firstName: member.user.firstName,
              lastName: member.user.lastName,
              role: member.role,
            }))}
            shifts={shifts.map((shift) => ({
              id: shift.id,
              title: shift.title,
              startTime: shift.startTime.toISOString(),
              endTime: shift.endTime.toISOString(),
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
          />
        )}
      </Panel>

      <Panel title="Indisponibilita registrate">
        {availabilities.length === 0 ? (
          <EmptyState message="Nessuna indisponibilita futura registrata." />
        ) : (
          <ItemList>
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

      <Panel title="Ferie e permessi approvati">
        {approvedTimeOff.length === 0 ? (
          <EmptyState message="Nessuna assenza approvata nel periodo corrente." />
        ) : (
          <ItemList>
            {approvedTimeOff.map((request) => (
              <ItemCard
                key={request.id}
                title={`${request.employee.firstName} ${request.employee.lastName}`}
                subtitle={`${request.type === "VACATION" ? "Ferie" : "Permesso"} - ${formatDateTime(request.startsAt ?? new Date())} - ${formatDateTime(request.endsAt ?? new Date())}`}
                meta={request.reason || "Richiesta approvata"}
              />
            ))}
          </ItemList>
        )}
      </Panel>
    </Stack>
  );
}
