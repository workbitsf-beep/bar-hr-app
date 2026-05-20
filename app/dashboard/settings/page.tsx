import { Role } from "@prisma/client";
import { GpsLocationField } from "@/app/components/gps-location-field";
import { WebAuthnRegistrationPanel } from "@/app/components/webauthn-registration-panel";
import { getGlobalGpsRadius } from "@/lib/gps-settings";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../context";
import { updateSettingsAction } from "../actions";
import {
  BillingRequiredState,
  EmptyState,
  FormField,
  Panel,
  PrimaryButton,
  Select,
  Stack,
} from "../ui";

export default async function DashboardSettingsPage() {
  const { session, role, activeBarId, billingStatus } = await getDashboardContext();
  const passkeyCount = await prisma.webAuthnCredential.count({
    where: { userId: session.user.id },
  });
  const securityPanel = (
    <Panel title="Sicurezza account">
      <WebAuthnRegistrationPanel initialPasskeyCount={passkeyCount} />
    </Panel>
  );

  if (role !== Role.OWNER) {
    return <Stack columns="minmax(0, 760px)">{securityPanel}</Stack>;
  }

  if (!activeBarId) {
    return (
      <Stack columns="minmax(0, 760px)">
        {securityPanel}
        <Panel title="Impostazioni locale">
          <EmptyState message="Seleziona un locale attivo per gestire le impostazioni." />
        </Panel>
      </Stack>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return (
      <Stack columns="minmax(0, 760px)">
        {securityPanel}
        <BillingRequiredState role={String(role)} />
      </Stack>
    );
  }

  const [settings, globalGpsRadius] = await Promise.all([
    prisma.barSettings.findUnique({
      where: {
        barId: activeBarId,
      },
    }),
    getGlobalGpsRadius(),
  ]);

  return (
    <>
      <Stack columns="minmax(0, 760px)">
        {securityPanel}

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

            <div
              style={{
                padding: "12px 14px",
                borderRadius: 18,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                color: "#475569",
                lineHeight: 1.6,
              }}
            >
              Range globale timbrature attivo: {globalGpsRadius} metri.
            </div>

            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                name="roundingEnabled"
                defaultChecked={Boolean(settings?.roundingEnabled)}
              />
              Abilita arrotondamento ore
            </label>

            <div
              className="dashboard-inline-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <FormField label="Scatto arrotondamento">
                <Select
                  name="roundingMinutes"
                  defaultValue={String(settings?.roundingMinutes ?? 15)}
                >
                  <option value="5">5 minuti</option>
                  <option value="10">10 minuti</option>
                  <option value="15">15 minuti</option>
                </Select>
              </FormField>

              <FormField label="Modalita">
                <Select name="roundingMode" defaultValue={settings?.roundingMode ?? "NEAREST"}>
                  <option value="NEAREST">Al piu vicino</option>
                  <option value="UP">Sempre in eccesso</option>
                  <option value="DOWN">Sempre in difetto</option>
                </Select>
              </FormField>
            </div>

            <div className="dashboard-form-actions">
              <PrimaryButton type="submit">Salva arrotondamento</PrimaryButton>
            </div>
          </form>
        </Panel>
      </Stack>
    </>
  );
}
