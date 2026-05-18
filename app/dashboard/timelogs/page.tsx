import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildMonthlyDataset } from "@/lib/reporting";
import { createManualTimeLogAction } from "../actions";
import { getDashboardContext } from "../context";
import { BillingRequiredState, EmptyState, FormField, Panel, PrimaryButton, Select, Stack, TextInput } from "../ui";
import { TimeLogsClient } from "./timelogs-client";

export default async function DashboardTimeLogsPage() {
  const { session, role, activeBarId, billingStatus } = await getDashboardContext();

  if (!activeBarId) {
    return (
      <Panel title="Timbrature">
        <EmptyState message="Seleziona un locale attivo per usare il sistema timbrature." />
      </Panel>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return <BillingRequiredState role={String(role)} />;
  }

  const [settings, members, logs, ownTotals] = await Promise.all([
    prisma.barSettings.findUnique({
      where: { barId: activeBarId },
      select: {
        gpsLatitude: true,
        gpsLongitude: true,
        gpsRadius: true,
        roundingEnabled: true,
        roundingMinutes: true,
        roundingMode: true,
      },
    }),
    role === Role.OWNER
      ? prisma.employeeBar.findMany({
          where: {
            barId: activeBarId,
            isActive: true,
            role: {
              not: Role.OWNER,
            },
          },
          orderBy: [{ role: "asc" }, { hiredAt: "asc" }],
          include: {
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
    prisma.timeLog.findMany({
      where: {
        barId: activeBarId,
        ...(role === Role.OWNER ? {} : { userId: session.user.id }),
      },
      orderBy: {
        timestamp: "desc",
      },
      take: role === Role.OWNER ? 50 : 20,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    role === Role.OWNER
      ? Promise.resolve(null)
      : buildMonthlyDataset(activeBarId, session.user.id, new Date().getMonth() + 1, new Date().getFullYear()),
  ]);

  return (
    <>
      <Stack>
        {role === Role.OWNER ? (
          <Panel title="Aggiungi timbratura manuale">
            {members.length === 0 ? (
              <EmptyState message="Nessun dipendente disponibile per aggiungere timbrature manuali." />
            ) : (
              <form action={createManualTimeLogAction} style={{ display: "grid", gap: 16 }}>
                <div
                  className="dashboard-inline-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  <FormField label="Dipendente">
                    <Select name="userId" required defaultValue="">
                      <option value="" disabled>
                        Seleziona
                      </option>
                      {members.map((member) => (
                        <option key={member.user.id} value={member.user.id}>
                          {member.user.firstName} {member.user.lastName}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField label="Tipo">
                    <Select name="type" defaultValue="IN">
                      <option value="IN">Entrata</option>
                      <option value="OUT">Uscita</option>
                    </Select>
                  </FormField>

                  <FormField label="Timestamp">
                    <TextInput name="timestamp" type="datetime-local" required />
                  </FormField>

                  <FormField label="Nota">
                    <TextInput name="note" />
                  </FormField>
                </div>

                <div className="dashboard-form-actions">
                  <PrimaryButton type="submit">Salva timbratura manuale</PrimaryButton>
                </div>
              </form>
            )}
          </Panel>
        ) : null}

        <TimeLogsClient
          role={role}
          initialLogs={logs.map((log) => ({
            id: log.id,
            type: log.type,
            timestamp: log.timestamp.toISOString(),
            latitude: log.latitude,
            longitude: log.longitude,
            isManual: log.isManual,
            note: log.note,
            user: {
              firstName: log.user.firstName,
              lastName: log.user.lastName,
            },
          }))}
          settings={settings}
          totals={ownTotals
            ? {
                realHours: ownTotals.totals.realHours,
                roundedHours: ownTotals.totals.roundedHours,
              }
            : null}
        />
      </Stack>
    </>
  );
}
