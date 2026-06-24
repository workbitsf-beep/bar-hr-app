import { ActivityType, Prisma, Role } from "@prisma/client";
import { GpsLocationField } from "@/app/components/gps-location-field";
import { WebAuthnRegistrationPanel } from "@/app/components/webauthn-registration-panel";
import { getBillingStatus } from "@/lib/billing";
import { featureDefinitions, getFeatureFlags, type FeatureSettingsInput } from "@/lib/features";
import { getGlobalGpsRadius } from "@/lib/gps-settings";
import { getLegalDocumentsWithAcceptance, legalDocumentTypeLabels } from "@/lib/legal-documents";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../context";
import { updateSettingsAction } from "../actions";
import { EmptyState, Panel, PrimaryButton, Stack, StatusPill } from "../ui";
import { PopupAction } from "../popup-action";
import { BillingSettingsPanel } from "./billing-settings-panel";
import { PasswordChangePanel } from "./password-change-panel";
import { StandardHoursForm, StandardHoursPreview, type StandardHourEntry } from "./standard-hours-form";

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

function parseStandardHoursFromSettings(settings?: {
  standardShiftPresets?: unknown;
  morningStartTime?: string | null;
  morningEndTime?: string | null;
  afternoonStartTime?: string | null;
  afternoonEndTime?: string | null;
  eveningStartTime?: string | null;
  eveningEndTime?: string | null;
} | null): StandardHourEntry[] {
  if (Array.isArray(settings?.standardShiftPresets)) {
    const entries = settings.standardShiftPresets.flatMap((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }

      const data = entry as Record<string, unknown>;
      const startTime = typeof data.startTime === "string" ? data.startTime : "";
      const endTime = typeof data.endTime === "string" ? data.endTime : "";

      if (!startTime || !endTime) {
        return [];
      }

      return [
        {
          id: typeof data.id === "string" && data.id ? data.id : `preset-${index}`,
          title: typeof data.title === "string" ? data.title : "",
          startTime,
          endTime,
        },
      ];
    });

    if (entries.length > 0) {
      return entries;
    }
  }

  return [
    { id: "legacy-1", title: "", startTime: settings?.morningStartTime ?? "", endTime: settings?.morningEndTime ?? "" },
    { id: "legacy-2", title: "", startTime: settings?.afternoonStartTime ?? "", endTime: settings?.afternoonEndTime ?? "" },
    { id: "legacy-3", title: "", startTime: settings?.eveningStartTime ?? "", endTime: settings?.eveningEndTime ?? "" },
  ].filter((entry) => entry.startTime || entry.endTime);
}

async function LegalDocumentsPanel({ userId }: { userId: string }) {
  const documents = await getLegalDocumentsWithAcceptance(userId);

  return (
    <Panel title="Documenti legali">
      {documents.length === 0 ? (
        <EmptyState message="Nessun documento legale disponibile." />
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {documents.map((document) => {
            const currentAcceptance = document.acceptances.find(
              (acceptance) => acceptance.version === document.version
            );
            const accepted = Boolean(currentAcceptance);

            return (
              <details
                key={document.id}
                style={{
                  padding: 16,
                  borderRadius: 22,
                  background: "#ffffff",
                  border: "1px solid rgba(124, 58, 237, 0.12)",
                }}
              >
                <summary style={{ cursor: "pointer", listStyle: "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong style={{ color: "#0f172a" }}>{document.title}</strong>
                      <span style={{ color: "#64748b", fontSize: 13, fontWeight: 700 }}>
                        {legalDocumentTypeLabels[document.type]} · v{document.version}
                      </span>
                    </div>
                    <StatusPill
                      label={accepted ? "Accettato" : document.isRequired ? "Da accettare" : "Disponibile"}
                      tone={accepted ? "success" : document.isRequired ? "warning" : "neutral"}
                    />
                  </div>
                </summary>
                <div style={{ display: "grid", gap: 10, marginTop: 14, color: "#334155", lineHeight: 1.65 }}>
                  {currentAcceptance ? (
                    <span style={{ color: "#64748b", fontSize: 13, fontWeight: 700 }}>
                      Accettato il {currentAcceptance.acceptedAt.toLocaleDateString("it-IT")}
                    </span>
                  ) : null}
                  {document.content ? (
                    <div style={{ whiteSpace: "pre-wrap" }}>{document.content}</div>
                  ) : (
                    <span style={{ color: "#64748b" }}>Contenuto testuale non presente.</span>
                  )}
                  {document.fileUrl ? (
                    <a href={document.fileUrl} target="_blank" rel="noreferrer" style={{ color: "#6d28d9", fontWeight: 800 }}>
                      Visualizza documento
                    </a>
                  ) : null}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </Panel>
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
        standardShiftPresets: true,
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
  const standardHours = parseStandardHoursFromSettings(settings);

  const featurePopup = (
    <PopupAction title="Funzioni attive" ariaLabel="Modifica funzioni attive" closeOnSubmit>
      <form action={updateSettingsAction} style={{ display: "grid", gap: 16 }}>
        <input type="hidden" name="settingsSection" value="features" />
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
        <input type="hidden" name="settingsSection" value="hours" />
        <StandardHoursForm initialEntries={standardHours} />
      </form>
    </PopupAction>
  );

  return (
    <Stack columns="minmax(0, 760px)">
      {passwordPanel}
      {securityPanel}
      <BillingSettingsPanel activeBarName={activeBarName} status={resolvedBillingStatus} />
      <LegalDocumentsPanel userId={session.user.id} />

      {activeBarActivityType === ActivityType.RESTAURANT ? (
        <>
          <Panel title="Funzioni attive" action={featurePopup}>
            <FeatureSummaryChips settings={featureSettings} />
            <EmptyState message="Tocca il + per scegliere cosa attivare o disattivare." />
          </Panel>

          <Panel title="GPS e arrotondamento">
            <form action={updateSettingsAction} style={{ display: "grid", gap: 16 }}>
              <input type="hidden" name="settingsSection" value="gps" />
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
            <StandardHoursPreview entries={standardHours} />
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
