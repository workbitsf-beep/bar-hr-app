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
  Panel,
  PrimaryButton,
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
              Abilita arrotondamento al quarto d'ora
            </label>

            <input type="hidden" name="roundingMinutes" value="15" />
            <input type="hidden" name="roundingMode" value="NEAREST" />

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
              Regola unica: 00-07 va a 00, 08-17 va a 15, 18-37 va a 30,
              38-52 va a 45, 53-59 va all'ora successiva.
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
