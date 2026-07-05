import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildDailyTotals, buildMonthlyTotals } from "@/lib/reporting";
import { DateTimeInput } from "@/app/components/date-time-input";
import { createManualTimeLogAction } from "../actions";
import { getDashboardContext } from "../context";
import {
  BillingRequiredState,
  EmptyState,
  FormField,
  Panel,
  PrimaryButton,
  Select,
  Stack,
  SuccessCallout,
  TextInput,
} from "../ui";
import { PopupAction } from "../popup-action";
import { TimeLogsClient } from "./timelogs-client";

export default async function DashboardTimeLogsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const success = Array.isArray(params.success) ? params.success[0] : params.success;
  const { session, role, activeBarId, billingStatus, features } = await getDashboardContext();

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

  if (!features.timeTracking) {
    return (
      <Panel title="Timbrature">
        <EmptyState message="Modulo timbrature disattivato nelle impostazioni." />
      </Panel>
    );
  }

  const isOwner = role === Role.OWNER;
  const successMessage = success === "timelog-created" ? "Timbratura manuale salvata correttamente." : null;
  const [settings, members, logs, ownTotals, todayTotals] = await Promise.all([
    isOwner
      ? Promise.resolve(null)
      : prisma.barSettings.findUnique({
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
    isOwner
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
        ...(isOwner ? {} : { userId: session.user.id }),
      },
      orderBy: {
        timestamp: "desc",
      },
      take: isOwner ? 50 : 20,
      select: {
        id: true,
        type: true,
        timestamp: true,
        latitude: true,
        longitude: true,
        isManual: true,
        note: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    isOwner
      ? Promise.resolve(null)
      : buildMonthlyTotals(activeBarId, session.user.id, new Date().getMonth() + 1, new Date().getFullYear()),
    isOwner
      ? Promise.resolve(null)
      : buildDailyTotals(activeBarId, session.user.id, new Date()),
  ]);

  return (
    <Stack>
      {successMessage ? <SuccessCallout>{successMessage}</SuccessCallout> : null}
      {isOwner ? (
        <Panel
          title="Timbrature manuali"
          action={
            <PopupAction title="Aggiungi timbratura manuale" ariaLabel="Aggiungi timbratura manuale">
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

                    <FormField label="Data e ora entrata">
                      <DateTimeInput name="clockInAt" required allowPast />
                    </FormField>

                    <FormField label="Data e ora uscita">
                      <DateTimeInput name="clockOutAt" required allowPast />
                    </FormField>

                    <FormField label="Nota">
                      <TextInput name="note" />
                    </FormField>
                  </div>

                  <input type="hidden" name="notifySuccess" value="1" />

                  <div className="dashboard-form-actions">
                    <PrimaryButton type="submit">Salva turno manuale</PrimaryButton>
                  </div>
                </form>
              )}
            </PopupAction>
          }
        >
          {members.length === 0 ? (
            <EmptyState message="Nessun dipendente disponibile per aggiungere timbrature manuali." />
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <EmptyState message="Aggiungi un turno completo oppure una singola timbratura mancante." />
              <PopupAction title="Aggiungi singola timbratura" ariaLabel="Aggiungi singola timbratura">
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

                    <FormField label="Data e ora">
                      <DateTimeInput name="timestamp" required allowPast />
                    </FormField>

                    <FormField label="Nota">
                      <TextInput name="note" />
                    </FormField>
                  </div>

                  <input type="hidden" name="notifySuccess" value="1" />

                  <div className="dashboard-form-actions">
                    <PrimaryButton type="submit">Salva timbratura manuale</PrimaryButton>
                  </div>
                </form>
              </PopupAction>
            </div>
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
        totals={
          ownTotals
            ? {
                realHours: ownTotals.realHours,
                roundedHours: ownTotals.roundedHours,
              }
            : null
        }
        todayTotals={
          todayTotals
            ? {
                realHours: todayTotals.realHours,
                roundedHours: todayTotals.roundedHours,
              }
            : null
        }
      />
    </Stack>
  );
}
