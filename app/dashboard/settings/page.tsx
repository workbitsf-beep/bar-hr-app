import { Prisma, Role } from "@prisma/client";
import { GpsLocationField } from "@/app/components/gps-location-field";
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
  Select,
  Stack,
} from "../ui";
import { BillingSettingsPanel } from "./billing-settings-panel";

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
  const { session, role, activeBarId, activeBarName, billingStatus } = await getDashboardContext();
  const passkeyCount = await getPasskeyCount(session.user.id);
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
        {securityPanel}

        <BillingSettingsPanel activeBarName={activeBarName} status={resolvedBillingStatus} />

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
