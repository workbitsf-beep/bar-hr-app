import type { ReactNode } from "react";
import Link from "next/link";
import { ActivityType, Prisma, Role } from "@prisma/client";
import { GpsLocationField } from "@/app/components/gps-location-field";
import { WebAuthnRegistrationPanel } from "@/app/components/webauthn-registration-panel";
import { getBillingStatus } from "@/lib/billing";
import { featureDefinitions, getFeatureFlags, type FeatureSettingsInput } from "@/lib/features";
import { getGlobalGpsRadius } from "@/lib/gps-settings";
import { getLegalDocumentsWithAcceptance, legalDocumentTypeLabels } from "@/lib/legal-documents";
import { prisma } from "@/lib/prisma";
import { deleteOwnerAccountAndBarAction, updateSettingsAction } from "../actions";
import { getDashboardContext } from "../context";
import {
  EmptyState,
  FormField,
  Panel,
  PrimaryButton,
  Stack,
  StatusPill,
  TextInput,
} from "../ui";
import { PopupAction } from "../popup-action";
import { BillingSettingsPanel } from "./billing-settings-panel";
import { PasswordChangePanel } from "./password-change-panel";
import { PushSettingsClient } from "./push-settings-client";
import { StandardHoursForm, StandardHoursPreview, type StandardHourEntry } from "./standard-hours-form";

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function FeatureSummaryChips({ settings }: { settings?: FeatureSettingsInput | null }) {
  const features = getFeatureFlags(settings);
  const active = featureDefinitions.filter((feature) => features[feature.key]);

  if (active.length === 0) {
    return <EmptyState message="Nessuna funzione attiva." />;
  }

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
            fontWeight: 700,
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
                  <span style={{ fontWeight: 800, color: "#0f172a" }}>{feature.shortLabel}</span>
                  <span style={{ color: "#64748b", fontSize: 12, lineHeight: 1.35 }}>
                    {feature.description}
                  </span>
                </span>
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

function SettingsSectionCard({
  icon,
  title,
  description,
  status,
  action,
  tone = "default",
}: {
  icon: string;
  title: string;
  description: string;
  status?: string;
  action: ReactNode;
  tone?: "default" | "danger";
}) {
  if (title === "Team e ruoli" || title === "Notifiche") {
    return null;
  }

  return (
    <section
      style={{
        display: "grid",
        gap: 16,
        padding: 18,
        borderRadius: 26,
        background:
          tone === "danger"
            ? "linear-gradient(180deg, #fff 0%, #fff7f7 100%)"
            : "linear-gradient(180deg, #ffffff 0%, #fbf8ff 100%)",
        border:
          tone === "danger"
            ? "1px solid rgba(220, 38, 38, 0.16)"
            : "1px solid rgba(124, 58, 237, 0.10)",
        boxShadow: "0 14px 34px rgba(88, 28, 135, 0.06)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              borderRadius: 18,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: tone === "danger" ? "#fee2e2" : "#f3e8ff",
              color: tone === "danger" ? "#991b1b" : "#4c1d95",
              fontSize: 21,
              flex: "0 0 auto",
            }}
          >
            {icon}
          </span>
          <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
            <strong style={{ color: "#0f172a", fontSize: 18 }}>{title}</strong>
            <span style={{ color: "#64748b", lineHeight: 1.45, fontSize: 14 }}>{description}</span>
          </div>
        </div>
        {status ? <StatusPill label={status} tone={tone === "danger" ? "danger" : "neutral"} /> : null}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>{action}</div>
    </section>
  );
}

async function LegalDocumentsPanel({ userId }: { userId: string }) {
  const documents = await getLegalDocumentsWithAcceptance(userId);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {documents.length === 0 ? (
        <EmptyState message="Nessun documento legale disponibile." />
      ) : (
        documents.map((document) => {
          const currentAcceptance = document.acceptances.find(
            (acceptance) =>
              acceptance.version === document.version && acceptance.revision === document.revision
          );
          const accepted = Boolean(currentAcceptance);

          return (
            <div
              key={document.id}
              style={{
                padding: 16,
                borderRadius: 22,
                background: "#ffffff",
                border: "1px solid rgba(124, 58, 237, 0.12)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <strong style={{ color: "#0f172a" }}>{document.title}</strong>
                  <span style={{ color: "#64748b", fontSize: 13, fontWeight: 700 }}>
                    {legalDocumentTypeLabels[document.type]} · v{document.version}.{document.revision}
                  </span>
                  {currentAcceptance ? (
                    <span style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
                      Accettato il {currentAcceptance.acceptedAt.toLocaleDateString("it-IT")}
                    </span>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <StatusPill
                    label={accepted ? "Accettato" : document.isRequired ? "Da accettare" : "Disponibile"}
                    tone={accepted ? "success" : document.isRequired ? "warning" : "neutral"}
                  />
                  <PopupAction
                    title={document.title}
                    ariaLabel={`Visualizza ${document.title}`}
                    triggerContent="Visualizza"
                  >
                    <div style={{ display: "grid", gap: 12, color: "#334155", lineHeight: 1.65 }}>
                      <StatusPill label={`Versione ${document.version}.${document.revision}`} tone="neutral" />
                      {document.content ? (
                        <div style={{ whiteSpace: "pre-wrap" }}>{document.content}</div>
                      ) : (
                        <span style={{ color: "#64748b" }}>Contenuto testuale non presente.</span>
                      )}
                      {document.fileName ? (
                        <a
                          href={`/api/legal-documents/${document.id}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "#6d28d9", fontWeight: 800 }}
                        >
                          Apri PDF
                        </a>
                      ) : null}
                      <div className="dashboard-form-actions">
                        <PrimaryButton type="button" tone="sand" data-popup-close>
                          Chiudi
                        </PrimaryButton>
                      </div>
                    </div>
                  </PopupAction>
                </div>
              </div>
            </div>
          );
        })
      )}
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

function DangerDeleteForm({
  error,
  activeBarName,
}: {
  error: string;
  activeBarName: string | null;
}) {
  return (
    <form action={deleteOwnerAccountAndBarAction} style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          padding: 16,
          borderRadius: 22,
          background: "#fff7f7",
          border: "1px solid rgba(220, 38, 38, 0.18)",
          color: "#991b1b",
          lineHeight: 1.6,
        }}
      >
        Questa azione elimina il locale attivo {activeBarName ? `"${activeBarName}"` : ""} e i dati collegati.
        Se il tuo account non ha altre attività collegate, verrà eliminato anche l’account.
      </div>

      <FormField label="Conferma scrivendo ELIMINA">
        <TextInput name="confirmation" required autoComplete="off" />
      </FormField>

      <FormField label="Password account">
        <TextInput name="password" type="password" required autoComplete="current-password" />
      </FormField>

      {error === "delete-confirmation" ? (
        <p style={{ margin: 0, color: "#b91c1c", fontWeight: 800 }}>Scrivi ELIMINA per confermare.</p>
      ) : null}
      {error === "delete-password" ? (
        <p style={{ margin: 0, color: "#b91c1c", fontWeight: 800 }}>Password non corretta.</p>
      ) : null}

      <div className="dashboard-form-actions">
        <PrimaryButton type="button" tone="sand" data-popup-close>
          Annulla
        </PrimaryButton>
        <PrimaryButton type="submit" tone="red">
          Elimina account e locale
        </PrimaryButton>
      </div>
    </form>
  );
}

export default async function DashboardSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const error = normalizeParam(params.error);
  const success = normalizeParam(params.success);
  const { session, role, activeBarId, activeBarName, activeBarActivityType, billingStatus } =
    await getDashboardContext();
  const passkeyCount = await getPasskeyCount(session.user.id);

  const securityContent = (
    <div style={{ display: "grid", gap: 14 }}>
      <PasswordChangePanel />
      <Panel title="Accesso biometrico">
        <WebAuthnRegistrationPanel initialPasskeyCount={passkeyCount} />
      </Panel>
    </div>
  );

  if (role !== Role.OWNER) {
    return (
      <Stack columns="minmax(0, 760px)">
        <SettingsSectionCard
          icon="🔐"
          title="Sicurezza"
          description="Password e accesso biometrico."
          action={
            <PopupAction title="Sicurezza" ariaLabel="Apri sicurezza" triggerContent="Apri">
              {securityContent}
            </PopupAction>
          }
        />
      </Stack>
    );
  }

  if (!activeBarId) {
    return (
      <Stack columns="minmax(0, 760px)">
        <SettingsSectionCard
          icon="🔐"
          title="Sicurezza"
          description="Password e accesso biometrico."
          action={
            <PopupAction title="Sicurezza" ariaLabel="Apri sicurezza" triggerContent="Apri">
              {securityContent}
            </PopupAction>
          }
        />
        <Panel title="Impostazioni locale">
          <EmptyState message="Locale non selezionato." />
        </Panel>
      </Stack>
    );
  }

  const [settings, globalGpsRadius, resolvedBillingStatus, activeBar] = await Promise.all([
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
    prisma.bar.findUnique({
      where: { id: activeBarId },
      select: {
        name: true,
        activityType: true,
        addressLine1: true,
        city: true,
        postalCode: true,
        phone: true,
        email: true,
      },
    }),
  ]);

  const featureSettings =
    activeBarActivityType === ActivityType.COMPANY && settings?.companyShiftsEnabled === false
      ? { ...settings, shiftsEnabled: false }
      : settings;
  const standardHours = parseStandardHoursFromSettings(settings);
  const isRestaurant = activeBarActivityType === ActivityType.RESTAURANT;
  const timeTrackingActive = getFeatureFlags(featureSettings).timeTracking;
  const activeFeatureCount = featureDefinitions.filter(
    (feature) => getFeatureFlags(featureSettings)[feature.key]
  ).length;

  const localePopup = (
    <PopupAction title="Locale / Attività" ariaLabel="Apri locale e attività" triggerContent="Gestisci">
      <div style={{ display: "grid", gap: 16 }}>
        <div
          style={{
            display: "grid",
            gap: 8,
            padding: 16,
            borderRadius: 22,
            background: "#ffffff",
            border: "1px solid rgba(124, 58, 237, 0.12)",
            color: "#334155",
            lineHeight: 1.55,
          }}
        >
          <strong style={{ color: "#0f172a" }}>{activeBar?.name ?? activeBarName ?? "Attività"}</strong>
          <span>{activeBar?.activityType === ActivityType.COMPANY ? "Azienda" : "Ristorazione"}</span>
          <span>
            {[activeBar?.addressLine1, activeBar?.postalCode, activeBar?.city].filter(Boolean).join(" · ") ||
              "Indirizzo non impostato"}
          </span>
          <span>{activeBar?.email || activeBar?.phone ? [activeBar.email, activeBar.phone].filter(Boolean).join(" · ") : "Contatti non impostati"}</span>
        </div>

        <form action={updateSettingsAction} style={{ display: "grid", gap: 16 }}>
          <input type="hidden" name="settingsSection" value="features" />
          <FeatureToggleGrid settings={featureSettings} />
          <div className="dashboard-form-actions">
            <PrimaryButton type="button" tone="sand" data-popup-close>
              Annulla
            </PrimaryButton>
            <PrimaryButton type="submit">Salva funzioni</PrimaryButton>
          </div>
        </form>

        {isRestaurant && timeTrackingActive ? (
          <form action={updateSettingsAction} style={{ display: "grid", gap: 16 }}>
            <input type="hidden" name="settingsSection" value="gps" />
            <GpsLocationField
              latitudeName="gpsLatitude"
              longitudeName="gpsLongitude"
              initialLatitude={settings?.gpsLatitude}
              initialLongitude={settings?.gpsLongitude}
              submitOnLocate={false}
            />
            <input type="hidden" name="gpsRadius" value={String(globalGpsRadius)} />
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800, color: "#0f172a" }}>
              <input type="checkbox" name="roundingEnabled" defaultChecked={Boolean(settings?.roundingEnabled)} />
              Arrotondamento attivo
            </label>
            <input type="hidden" name="roundingMinutes" value="15" />
            <input type="hidden" name="roundingMode" value="NEAREST" />
            <div className="dashboard-form-actions">
              <PrimaryButton type="button" tone="sand" data-popup-close>
                Annulla
              </PrimaryButton>
              <PrimaryButton type="submit">Salva posizione</PrimaryButton>
            </div>
          </form>
        ) : null}
      </div>
    </PopupAction>
  );

  const standardHoursPopup = (
    <PopupAction title="Orari standard" ariaLabel="Apri orari standard" triggerContent="Gestisci">
      <form action={updateSettingsAction} style={{ display: "grid", gap: 16 }}>
        <input type="hidden" name="settingsSection" value="hours" />
        <StandardHoursForm initialEntries={standardHours} />
        <div className="dashboard-form-actions">
          <PrimaryButton type="button" tone="sand" data-popup-close>
            Annulla
          </PrimaryButton>
        </div>
      </form>
    </PopupAction>
  );

  return (
    <Stack columns="repeat(auto-fit, minmax(280px, 1fr))">
      {success === "bar-deleted" ? (
        <Panel title="Operazione completata">
          <StatusPill label="Locale eliminato" tone="success" />
        </Panel>
      ) : null}

      <SettingsSectionCard
        icon="🏢"
        title="Locale / Attività"
        description="Dati principali, funzioni attive e posizione GPS."
        status={`${activeFeatureCount} funzioni`}
        action={localePopup}
      />

      <SettingsSectionCard
        icon="🕒"
        title="Orari standard"
        description="Turni predefiniti personalizzati da riusare nel calendario."
        status={standardHours.length ? `${standardHours.length} orari` : "Vuoto"}
        action={standardHoursPopup}
      />

      <SettingsSectionCard
        icon="👥"
        title="Team e ruoli"
        description="Persone, permessi, ruoli e inviti."
        action={
          <Link href="/dashboard/people" style={{ textDecoration: "none" }}>
            <PrimaryButton type="button">Gestisci</PrimaryButton>
          </Link>
        }
      />

      <SettingsSectionCard
        icon="📄"
        title="Documenti legali"
        description="Privacy, termini, cookie, geolocalizzazione, DPA e contratto SaaS."
        action={
          <PopupAction title="Documenti legali" ariaLabel="Apri documenti legali" triggerContent="Apri">
            <LegalDocumentsPanel userId={session.user.id} />
          </PopupAction>
        }
      />

      <SettingsSectionCard
        icon="🔔"
        title="Notifiche"
        description="Notifiche interne e push del dispositivo."
        status="Gestibili"
        action={
          <PopupAction title="Notifiche" ariaLabel="Apri notifiche" triggerContent="Apri">
            <PushSettingsClient />
          </PopupAction>
        }
      />

      <SettingsSectionCard
        icon="💳"
        title="Abbonamento"
        description="Piano Stripe, stato pagamento, trial e rinnovo."
        status={resolvedBillingStatus.canAccess ? "Ok" : "Da verificare"}
        action={
          <PopupAction title="Abbonamento" ariaLabel="Apri abbonamento" triggerContent="Gestisci">
            <BillingSettingsPanel activeBarName={activeBarName} status={resolvedBillingStatus} />
          </PopupAction>
        }
      />

      <SettingsSectionCard
        icon="🔐"
        title="Sicurezza"
        description="Password, biometria e cancellazione account/locale."
        action={
          <PopupAction title="Sicurezza" ariaLabel="Apri sicurezza" triggerContent="Apri">
            <div style={{ display: "grid", gap: 14 }}>
              {securityContent}
              <Panel title="Eliminazione account e locale">
                <DangerDeleteForm error={error} activeBarName={activeBarName} />
              </Panel>
            </div>
          </PopupAction>
        }
        tone={error.startsWith("delete-") ? "danger" : "default"}
      />
    </Stack>
  );
}
