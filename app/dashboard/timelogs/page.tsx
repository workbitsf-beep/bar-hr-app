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
  const now = new Date();
  const personalLogStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const ownerLogStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const personalInitialLogLimit = 120;
  const [settings, members, logs, ownTotals, todayTotals] = await Promise.all([
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
        ...(isOwner
          ? { timestamp: { gte: ownerLogStart } }
          : { userId: session.user.id, timestamp: { gte: personalLogStart } }),
      },
      orderBy: {
        timestamp: "desc",
      },
      take: isOwner ? 1500 : personalInitialLogLimit + 1,
      select: {
        id: true,
        type: true,
        timestamp: true,
        // No coordinates: nothing on this page shows them, and sending them to
        // the browser with every clock-in was data no one needed to receive.
        isManual: true,
        note: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    isOwner
      ? Promise.resolve(null)
      : buildMonthlyTotals(activeBarId, session.user.id, now.getMonth() + 1, now.getFullYear()),
    isOwner
      ? Promise.resolve(null)
      : buildDailyTotals(activeBarId, session.user.id, now),
  ]);

  const initialLogs = isOwner ? logs : logs.slice(0, personalInitialLogLimit);

  // Handed to the team panel rather than living in a card of its own: it
  // is one subject, and a whole panel to explain one button left two
  // thirds of the screen empty.
  const manualEntry =
    isOwner && members.length > 0 ? (
      <div className="workbit-manual-timelog" style={{ display: "grid", gap: 8 }}>
        <PopupAction
          title="Aggiungi singola timbratura"
          ariaLabel="Aggiungi singola timbratura"
          triggerContent="Aggiungi timbratura"
        >
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
        <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, lineHeight: 1.5 }}>
          Serve quando qualcuno ha dimenticato di timbrare.
        </span>
      </div>
    ) : null;

  return (
    <Stack>
      {successMessage ? <SuccessCallout>{successMessage}</SuccessCallout> : null}
      <TimeLogsClient
        manualEntry={manualEntry}
        role={role}
        initialLogs={initialLogs.map((log) => ({
          id: log.id,
          type: log.type,
          timestamp: log.timestamp.toISOString(),
          isManual: log.isManual,
          note: log.note,
          user: {
            id: log.user.id,
            firstName: log.user.firstName,
            lastName: log.user.lastName,
          },
        }))}
        hasMoreInitialLogs={!isOwner && logs.length > personalInitialLogLimit}
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
