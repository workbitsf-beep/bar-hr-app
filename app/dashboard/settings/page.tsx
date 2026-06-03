import { ActivityType, Prisma, Role } from "@prisma/client";
import { GpsLocationField } from "@/app/components/gps-location-field";
import { TimeInput } from "@/app/components/time-input";
import { WebAuthnRegistrationPanel } from "@/app/components/webauthn-registration-panel";
import { getBillingStatus } from "@/lib/billing";
import { getGlobalGpsRadius } from "@/lib/gps-settings";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../context";
import { updateSettingsAction } from "../actions";
import {
  EmptyState,
  FormField,
  Panel,
  PrimaryButton,
  Stack,
  TextInput,
} from "../ui";
import { BillingSettingsPanel } from "./billing-settings-panel";
import { PasswordChangePanel } from "./password-change-panel";

async function getPasskeyCount(userId: string) {
  try {
    return await prisma.webAuthnCredential.count({
      where: { userId },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      console.error("[webauthn] passkey table missing; run prisma migrate deploy");
      return 0;
    }

    throw error;
  }
}

export default async function DashboardSettingsPage() {
  const {
    session,
    role,
    activeBarId,
    activeBarName,
    activeBarActivityType,
    billingStatus,
  } = await getDashboardContext();
  const passkeyCount = await getPasskeyCount(session.user.id);
  const securityPanel = (
    <Panel title="Sicurezza account">
      <WebAuthnRegistrationPanel initialPasskeyCount={passkeyCount} />
    </Panel>
  );
  const passwordPanel = <PasswordChangePanel />;

  if (role !== Role.OWNER) {
    return <Stack columns="minmax(0, 760px)">{passwordPanel}{securityPanel}</Stack>;
  }

  if (!activeBarId) {
    return (
      <Stack columns="minmax(0, 760px)">
        {passwordPanel}
        {securityPanel}
        <Panel title="Impostazioni locale">
          <EmptyState message="Locale non selezionato." />
        </Panel>
      </Stack>
    );
  }

  const [settings, globalGpsRadius, resolvedBillingStatus] = await Promise.all([
    prisma.barSettings.findUnique({
      where: {
        barId: activeBarId,
      },
    }),
    getGlobalGpsRadius(),
    billingStatus ? Promise.resolve(billingStatus) : getBillingStatus(activeBarId),
  ]);

  return (
    <>
      <Stack columns="minmax(0, 760px)">
        {passwordPanel}
        {securityPanel}

        <BillingSettingsPanel activeBarName={activeBarName} status={resolvedBillingStatus} />

        {activeBarActivityType === ActivityType.RESTAURANT ? (
          <Panel title="Configura locale">
            <form action={updateSettingsAction} style={{ display: "grid", gap: 16 }}>
            <GpsLocationField
              latitudeName="gpsLatitude"
              longitudeName="gpsLongitude"
              initialLatitude={settings?.gpsLatitude}
              initialLongitude={settings?.gpsLongitude}
              submitOnLocate
            />

            <input type="hidden" name="gpsRadius" value={String(globalGpsRadius)} />

            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                name="roundingEnabled"
                defaultChecked={Boolean(settings?.roundingEnabled)}
              />
              Arrotondamento attivo
            </label>

            <input type="hidden" name="roundingMinutes" value="15" />
            <input type="hidden" name="roundingMode" value="NEAREST" />

            <div style={{ display: "grid", gap: 12 }}>
              <strong style={{ color: "#0f172a", fontSize: 18 }}>Orari standard turni</strong>
              <div
                className="dashboard-inline-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                <FormField label="Mattina - inizio">
                  <TimeInput
                    name="morningStartTime"
                    value={settings?.morningStartTime ?? ""}
                    onChange={() => undefined}
                  />
                </FormField>
                <FormField label="Mattina - fine">
                  <TimeInput
                    name="morningEndTime"
                    value={settings?.morningEndTime ?? ""}
                    onChange={() => undefined}
                  />
                </FormField>
                <FormField label="Pomeriggio - inizio">
                  <TimeInput
                    name="afternoonStartTime"
                    value={settings?.afternoonStartTime ?? ""}
                    onChange={() => undefined}
                  />
                </FormField>
                <FormField label="Pomeriggio - fine">
                  <TimeInput
                    name="afternoonEndTime"
                    value={settings?.afternoonEndTime ?? ""}
                    onChange={() => undefined}
                  />
                </FormField>
                <FormField label="Sera - inizio">
                  <TimeInput
                    name="eveningStartTime"
                    value={settings?.eveningStartTime ?? ""}
                    onChange={() => undefined}
                  />
                </FormField>
                <FormField label="Sera - fine">
                  <TimeInput
                    name="eveningEndTime"
                    value={settings?.eveningEndTime ?? ""}
                    onChange={() => undefined}
                  />
                </FormField>
              </div>
            </div>

            <div className="dashboard-form-actions">
              <PrimaryButton type="submit">Salva orari</PrimaryButton>
            </div>
            </form>
          </Panel>
        ) : (
          <Panel title="Impostazioni azienda">
            <EmptyState message="Configurazione azienda pronta." />
          </Panel>
        )}
      </Stack>
    </>
  );
}
