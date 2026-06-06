import { ActivityType, Prisma, Role } from "@prisma/client";
import { GpsLocationField } from "@/app/components/gps-location-field";
import { TimeInput } from "@/app/components/time-input";
import { WebAuthnRegistrationPanel } from "@/app/components/webauthn-registration-panel";
import { getBillingStatus } from "@/lib/billing";
import { featureDefinitions, getFeatureFlags, type FeatureSettingsInput } from "@/lib/features";
import { getGlobalGpsRadius } from "@/lib/gps-settings";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../context";
import { updateSettingsAction } from "../actions";
import { EmptyState, FormField, Panel, PrimaryButton, Stack } from "../ui";
import { PopupAction } from "../popup-action";
import { BillingSettingsPanel } from "./billing-settings-panel";
import { PasswordChangePanel } from "./password-change-panel";

function FeatureSummaryChips({ settings }: { settings?: FeatureSettingsInput | null }) {
  const features = getFeatureFlags(settings);
  const active = featureDefinitions.filter((feature) => features[feature.key]);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {active.map((feature) => (
        <span
          key={feature.key}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 999,
            background: "rgba(237, 233, 254, 0.78)",
            border: "1px solid rgba(124, 58, 237, 0.14)",
            color: "#4c1d95",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <span aria-hidden="true">{feature.emoji}</span>
          {feature.shortLabel}
        </span>
      ))}
    </div>
  );
}

function FeatureToggleGrid({ settings }: { settings?: FeatureSettingsInput | null }) {
  const features = getFeatureFlags(settings);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <strong style={{ color: "#0f172a", fontSize: 18 }}>Funzioni attive</strong>
      <div
        className="dashboard-inline-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
        }}
      >
        {featureDefinitions.map((feature) => {
          const enabled = features[feature.key];

          return (
            <label
              key={feature.key}
              style={{
                display: "grid",
                gap: 10,
                padding: 12,
                borderRadius: 18,
                border: enabled
                  ? "1px solid rgba(124, 58, 237, 0.28)"
                  : "1px solid rgba(148, 163, 184, 0.22)",
                background: enabled
                  ? "linear-gradient(135deg, rgba(237,233,254,0.84), rgba(255,255,255,0.96))"
                  : "#f8fafc",
              }}
            >
              <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(124, 58, 237, 0.12)",
                    color: "#6d28d9",
                    fontSize: 15,
                    flexShrink: 0,
                  }}
                >
                  {feature.emoji}
                </span>
                <input type="checkbox" name={feature.field} defaultChecked={enabled} />
                <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, color: "#0f172a" }}>{feature.shortLabel}</span>
                  <span style={{ color: "#64748b", fontSize: 12, lineHeight: 1.35 }}>
                    {feature.description}
                  </span>
                </span>
              </span>

              <span
                aria-hidden="true"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(124, 58, 237, 0.12)",
                  color: "#6d28d9",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                +
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function StandardHoursPreview({
  morningStartTime,
  morningEndTime,
  afternoonStartTime,
  afternoonEndTime,
  eveningStartTime,
  eveningEndTime,
}: {
  morningStartTime?: string | null;
  morningEndTime?: string | null;
  afternoonStartTime?: string | null;
  afternoonEndTime?: string | null;
  eveningStartTime?: string | null;
  eveningEndTime?: string | null;
}) {
  const rows = [
    ["Mattina", morningStartTime, morningEndTime],
    ["Pomeriggio", afternoonStartTime, afternoonEndTime],
    ["Sera", eveningStartTime, eveningEndTime],
  ] as const;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map(([label, start, end]) => (
        <div
          key={label}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 16,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            color: "#334155",
            fontSize: 14,
          }}
        >
          <strong>{label}</strong>
          <span>{start && end ? `${start} - ${end}` : "Non impostato"}</span>
        </div>
      ))}
    </div>
  );
}

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
  const { session, role, activeBarId, activeBarName, activeBarActivityType, billingStatus } =
    await getDashboardContext();
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
      where: { barId: activeBarId },
      select: {
        gpsLatitude: true,
        gpsLongitude: true,
        gpsRadius: true,
        roundingEnabled: true,
        roundingMinutes: true,
        roundingMode: true,
        morningStartTime: true,
        morningEndTime: true,
        afternoonStartTime: true,
        afternoonEndTime: true,
        eveningStartTime: true,
        eveningEndTime: true,
        companyShiftsEnabled: true,
        timeTrackingEnabled: true,
        shiftsEnabled: true,
        requestsEnabled: true,
        availabilityEnabled: true,
        overtimeEnabled: true,
        tasksEnabled: true,
        noticeBoardEnabled: true,
        coursesEnabled: true,
        documentsEnabled: true,
        reportsEnabled: true,
      },
    }),
    getGlobalGpsRadius(),
    billingStatus ? Promise.resolve(billingStatus) : getBillingStatus(activeBarId),
  ]);

  const featureSettings =
    activeBarActivityType === ActivityType.COMPANY && settings?.companyShiftsEnabled === false
      ? { ...settings, shiftsEnabled: false }
      : settings;

  const featurePopup = (
    <PopupAction title="Funzioni attive" ariaLabel="Modifica funzioni attive" closeOnSubmit>
      <form action={updateSettingsAction} style={{ display: "grid", gap: 16 }}>
        <FeatureToggleGrid settings={featureSettings} />
        <div className="dashboard-form-actions">
          <PrimaryButton type="submit">Salva funzioni</PrimaryButton>
        </div>
      </form>
    </PopupAction>
  );

  const standardHoursPopup = (
    <PopupAction title="Orari standard" ariaLabel="Modifica orari standard">
      <form action={updateSettingsAction} style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <div
            className="dashboard-inline-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <FormField label="Mattina - inizio">
              <TimeInput name="morningStartTime" value={settings?.morningStartTime ?? ""} />
            </FormField>
            <FormField label="Mattina - fine">
              <TimeInput name="morningEndTime" value={settings?.morningEndTime ?? ""} />
            </FormField>
            <FormField label="Pomeriggio - inizio">
              <TimeInput name="afternoonStartTime" value={settings?.afternoonStartTime ?? ""} />
            </FormField>
            <FormField label="Pomeriggio - fine">
              <TimeInput name="afternoonEndTime" value={settings?.afternoonEndTime ?? ""} />
            </FormField>
            <FormField label="Sera - inizio">
              <TimeInput name="eveningStartTime" value={settings?.eveningStartTime ?? ""} />
            </FormField>
            <FormField label="Sera - fine">
              <TimeInput name="eveningEndTime" value={settings?.eveningEndTime ?? ""} />
            </FormField>
          </div>
        </div>

        <div className="dashboard-form-actions">
          <PrimaryButton type="submit">Salva orari</PrimaryButton>
        </div>
      </form>
    </PopupAction>
  );

  return (
    <Stack columns="minmax(0, 760px)">
      {passwordPanel}
      {securityPanel}
      <BillingSettingsPanel activeBarName={activeBarName} status={resolvedBillingStatus} />

      {activeBarActivityType === ActivityType.RESTAURANT ? (
        <>
          <Panel title="Funzioni attive" action={featurePopup}>
            <FeatureSummaryChips settings={featureSettings} />
            <EmptyState message="Tocca il + per scegliere cosa attivare o disattivare." />
          </Panel>

          <Panel title="GPS e arrotondamento">
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

              <div className="dashboard-form-actions">
                <PrimaryButton type="submit">Salva posizione</PrimaryButton>
              </div>
            </form>
          </Panel>

          <Panel title="Orari standard" action={standardHoursPopup}>
            <StandardHoursPreview
              morningStartTime={settings?.morningStartTime}
              morningEndTime={settings?.morningEndTime}
              afternoonStartTime={settings?.afternoonStartTime}
              afternoonEndTime={settings?.afternoonEndTime}
              eveningStartTime={settings?.eveningStartTime}
              eveningEndTime={settings?.eveningEndTime}
            />
            <EmptyState message="Apri il popup con il + per aggiornarli in pochi tocchi." />
          </Panel>
        </>
      ) : (
        <Panel title="Funzioni azienda" action={featurePopup}>
          <FeatureSummaryChips settings={featureSettings} />
          <EmptyState message="Tocca il + per scegliere i moduli attivi." />
        </Panel>
      )}
    </Stack>
  );
}
