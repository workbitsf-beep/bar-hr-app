import type { ReactNode } from "react";
import { ActivityType, Prisma, Role, type AppLanguage } from "@prisma/client";
import { WebAuthnRegistrationPanel } from "@/app/components/webauthn-registration-panel";
import { getBillingStatus } from "@/lib/billing";
import { featureToggleDefinitions, getFeatureFlags } from "@/lib/features";
import { getGlobalGpsRadius } from "@/lib/gps-settings";
import {
  getLegalDocumentsWithAcceptance,
  getRequiredLegalDocumentsForUser,
  legalDocumentTypeLabels,
} from "@/lib/legal-documents";
import { prisma } from "@/lib/prisma";
import {
  deleteOwnerAccountAndBarAction,
  setLanguageAction,
  updateSettingsAction,
} from "../actions";
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
import { LocaleSettingsPopupContent } from "./locale-settings-popup-content";
import { PasswordChangePanel } from "./password-change-panel";
import { PushSettingsClient } from "./push-settings-client";
import { SupportPanel } from "./support-panel";
import { StandardHoursForm, type StandardHourEntry } from "./standard-hours-form";
import { ExternalLink } from "@/app/components/external-link";

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function SettingsPageHeading() {
  return (
    <div className="workbit-page-heading">
      <span>Personalizza</span>
      <h1>Impostazioni</h1>
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

/**
 * One setting, as a row you touch.
 *
 * It used to be a card the height of a thumb, with an emoji in a lilac square
 * and a button that said "Gestisci" - or "Apri", which meant exactly the same
 * thing. The row is the button now, the chevron says so, and the space that
 * bought is spent on something true on the right: how many features are on,
 * how wide the clock-in circle is, when the subscription renews.
 */
function SettingsRow({
  dot,
  title,
  lead,
  status,
  statusTone = "plain",
  tone = "default",
}: {
  dot: string;
  title: string;
  lead?: string;
  status?: string;
  statusTone?: "plain" | "warn";
  tone?: "default" | "danger";
}) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        minWidth: 0,
        padding: "12px 13px",
      }}
    >
      <span
        aria-hidden="true"
        style={{ width: 7, height: 7, flex: "0 0 auto", borderRadius: 999, background: dot }}
      />
      <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
        <strong
          style={{
            fontSize: 14,
            fontWeight: 760,
            color: tone === "danger" ? "#a8424f" : "#17161f",
          }}
        >
          {title}
        </strong>
        {lead ? (
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 520,
              color: "#a3a0b8",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {lead}
          </span>
        ) : null}
      </span>
      {status ? (
        <span
          style={{
            flex: "0 0 auto",
            fontSize: 12,
            fontWeight: 640,
            fontVariantNumeric: "tabular-nums",
            color: statusTone === "warn" ? "#a15c07" : "#6b6880",
          }}
        >
          {status}
        </span>
      ) : null}
      <span aria-hidden="true" style={{ flex: "0 0 auto", color: "#c8c5d8", fontSize: 15 }}>
        ›
      </span>
    </span>
  );
}

/** A handful of rows under one small-capitals heading. */
function SettingsGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {label ? (
        <span
          style={{
            paddingLeft: 4,
            fontSize: 9.5,
            fontWeight: 830,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#a3a0b8",
          }}
        >
          {label}
        </span>
      ) : null}
      <div
        className="workbit-settings-group"
        style={{
          background: "#ffffff",
          border: "1px solid #e9e6f5",
          borderRadius: 18,
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** The language, where people look for it instead of up in the header. */
function LanguagePanel({ current }: { current: AppLanguage }) {
  const options: Array<{ value: AppLanguage; label: string }> = [
    { value: "it" as AppLanguage, label: "Italiano" },
    { value: "en" as AppLanguage, label: "English" },
    { value: "es" as AppLanguage, label: "Español" },
  ];

  return (
    <form action={setLanguageAction} style={{ display: "grid", gap: 7 }}>
      {options.map((option) => (
        <button
          key={option.value}
          type="submit"
          name="language"
          value={option.value}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "11px 12px",
            borderRadius: 13,
            border: `1.5px solid ${option.value === current ? "#6d5ce7" : "#e9e6f5"}`,
            background: option.value === current ? "#f6f3ff" : "#fbfaff",
            color: option.value === current ? "#4c1d95" : "#17161f",
            fontSize: 14,
            fontWeight: 700,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 16,
              height: 16,
              flex: "0 0 auto",
              borderRadius: 999,
              border:
                option.value === current ? "5px solid #6d5ce7" : "1.5px solid #d4d0e8",
            }}
          />
          {option.label}
        </button>
      ))}
      <span style={{ fontSize: 11.5, fontWeight: 600, color: "#a3a0b8", textAlign: "center" }}>
        Cambia subito, senza salvare.
      </span>
    </form>
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
                    {legalDocumentTypeLabels[document.type]} Â· v{document.version}.{document.revision}
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
                        <ExternalLink
                          href={`/api/legal-documents/${document.id}`}
                          style={{ color: "#6d28d9", fontWeight: 800 }}
                        >
                          Apri PDF
                        </ExternalLink>
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
  const openBillingPopup = normalizeParam(params.billing) === "1" || normalizeParam(params.open) === "billing";
  const {
    session,
    role,
    activeBarId,
    activeBarName,
    activeBarActivityType,
    billingStatus,
    language: sessionLanguage,
  } = await getDashboardContext();
  const passkeyCount = await getPasskeyCount(session.user.id);
  const languageLabel =
    sessionLanguage === "en" ? "English" : sessionLanguage === "es" ? "Español" : "Italiano";

  const securityContent = (
    <div style={{ display: "grid", gap: 14 }}>
      <PasswordChangePanel />
      <Panel title="Accesso biometrico">
        <WebAuthnRegistrationPanel initialPasskeyCount={passkeyCount} />
      </Panel>
    </div>
  );

  // What someone who is not the owner can actually decide. It used to be one
  // card - "Sicurezza" - and nothing else: a whole page in the bottom bar for
  // a single button, with no way to choose a language or say which
  // notifications they wanted.
  const accountGroup = (
    <SettingsGroup label="Il tuo account">
      <PopupAction
        title="Accesso"
        ariaLabel="Apri accesso"
        triggerRow={
          <SettingsRow
            dot="#4c1d95"
            title="Accesso"
            lead="Password e sblocco col telefono"
            status={passkeyCount > 0 ? "Attivo" : "Solo password"}
          />
        }
      >
        {securityContent}
      </PopupAction>

      <PopupAction
        title="Notifiche"
        ariaLabel="Apri notifiche"
        triggerRow={
          <SettingsRow
            dot="#a855f7"
            title="Notifiche"
            lead="Cosa ti arriva sul telefono"
          />
        }
      >
        <PushSettingsClient />
      </PopupAction>

      <PopupAction
        title="Lingua"
        ariaLabel="Apri lingua"
        triggerRow={<SettingsRow dot="#64748b" title="Lingua" status={languageLabel} />}
      >
        <LanguagePanel current={sessionLanguage} />
      </PopupAction>
    </SettingsGroup>
  );

  const helpGroup = (
    <SettingsGroup label="Documenti e assistenza">
      <PopupAction
        title="Documenti legali"
        ariaLabel="Apri documenti legali"
        triggerRow={
          <SettingsRow
            dot="#94a3b8"
            title="Documenti legali"
            lead="Privacy, termini, DPA"
          />
        }
      >
        <LegalDocumentsPanel userId={session.user.id} />
      </PopupAction>

      <PopupAction
        title="Assistenza"
        ariaLabel="Apri assistenza"
        triggerRow={<SettingsRow dot="#7e22ce" title="Scrivi all&rsquo;assistenza" />}
      >
        <SupportPanel activeBarName={activeBarName} userEmail={session.user.email} />
      </PopupAction>
    </SettingsGroup>
  );

  if (role !== Role.OWNER) {
    return (
      <Stack columns="minmax(0, 760px)" className="workbit-settings-page">
        <SettingsPageHeading />
        {accountGroup}
        {helpGroup}
      </Stack>
    );
  }

  if (!activeBarId) {
    return (
      <Stack columns="minmax(0, 760px)" className="workbit-settings-page">
        <SettingsPageHeading />
        {accountGroup}
        <Panel title="Impostazioni locale">
          <EmptyState message="Locale non selezionato." />
        </Panel>
      </Stack>
    );
  }

  const legalDocumentsPending = (await getRequiredLegalDocumentsForUser(session.user.id)).length;
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
    activeBarActivityType === ActivityType.COMPANY
      ? {
          ...settings,
          shiftsEnabled: settings?.companyShiftsEnabled === false ? false : settings?.shiftsEnabled,
          timeTrackingEnabled: false,
        }
      : settings;
  const standardHours = parseStandardHoursFromSettings(settings);
  const isRestaurant = activeBarActivityType === ActivityType.RESTAURANT;
  const visibleFeatureDefinitions = featureToggleDefinitions.filter(
    (feature) => isRestaurant || feature.key !== "timeTracking"
  );
  const activeFeatureCount = visibleFeatureDefinitions.filter(
    (feature) => getFeatureFlags(featureSettings)[feature.key]
  ).length;

  // No closeOnSubmit on the venue panels: they save themselves on every
  // switch, so closing on submit shut the window in the user's face the
  // moment they turned something off. Closing is what the Chiudi button is
  // for.
  const localeProps = {
    activityName: activeBar?.name ?? activeBarName ?? "Attività",
    activityLabel:
      activeBar?.activityType === ActivityType.COMPANY ? "Azienda" : "Ristorazione",
    addressLabel:
      [activeBar?.addressLine1, activeBar?.postalCode, activeBar?.city].filter(Boolean).join(" · ") ||
      "Indirizzo non impostato",
    contactLabel:
      activeBar?.email || activeBar?.phone
        ? [activeBar.email, activeBar.phone].filter(Boolean).join(" · ")
        : "Contatti non impostati",
    settings: featureSettings,
    globalGpsRadius,
    isRestaurant,
  };

  // What the row says on the right: the date that actually matters, not "Ok".
  const billingRowStatus = resolvedBillingStatus.currentPeriodEnd
    ? `Rinnova il ${new Intl.DateTimeFormat("it-IT", {
        day: "numeric",
        month: "short",
      }).format(resolvedBillingStatus.currentPeriodEnd)}`
    : resolvedBillingStatus.trialEndsAt
      ? `Prova fino al ${new Intl.DateTimeFormat("it-IT", {
          day: "numeric",
          month: "short",
        }).format(resolvedBillingStatus.trialEndsAt)}`
      : resolvedBillingStatus.canAccess
        ? "Attivo"
        : "Da attivare";
  const hasGpsPoint = settings?.gpsLatitude !== null && settings?.gpsLongitude !== null;
  const timeTrackingOn = getFeatureFlags(featureSettings).timeTracking;
  const requiredLegalCount = legalDocumentsPending;

  return (
    <Stack columns="minmax(0, 760px)" className="workbit-settings-page">
      <SettingsPageHeading />
      {success === "bar-deleted" ? (
        <Panel title="Operazione completata">
          <StatusPill label="Locale eliminato" tone="success" />
        </Panel>
      ) : null}

      <SettingsGroup label="Il locale">
        <PopupAction
          title="Locale e attività"
          ariaLabel="Apri locale e attività"
          triggerRow={
            <SettingsRow
              dot="#6d5ce7"
              title="Locale e attività"
              lead={localeProps.addressLabel}
              status={localeProps.activityLabel}
            />
          }
        >
          <LocaleSettingsPopupContent {...localeProps} section="info" />
        </PopupAction>

        <PopupAction
          title="Cosa usi"
          ariaLabel="Apri le funzioni attive"
          triggerRow={
            <SettingsRow
              dot="#0ea5e9"
              title="Cosa usi"
              lead="Le funzioni accese"
              status={`${activeFeatureCount} di ${visibleFeatureDefinitions.length}`}
            />
          }
        >
          <LocaleSettingsPopupContent {...localeProps} section="features" />
        </PopupAction>

        <PopupAction
          title="Orari standard"
          ariaLabel="Apri orari standard"
          closeOnSubmit
          triggerRow={
            <SettingsRow
              dot="#f59e0b"
              title="Orari standard"
              lead="Le fasce del calendario"
              status={standardHours.length ? String(standardHours.length) : "Nessuna"}
            />
          }
        >
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

        {isRestaurant && timeTrackingOn ? (
          <PopupAction
            title="Dove si timbra"
            ariaLabel="Apri la posizione di timbratura"
            triggerRow={
              <SettingsRow
                dot="#10b981"
                title="Dove si timbra"
                lead="Posizione e raggio"
                status={hasGpsPoint ? `${globalGpsRadius} m` : "Da impostare"}
                statusTone={hasGpsPoint ? "plain" : "warn"}
              />
            }
          >
            <LocaleSettingsPopupContent {...localeProps} section="tracking" />
          </PopupAction>
        ) : null}
      </SettingsGroup>

      {accountGroup}

      <SettingsGroup label="Abbonamento e assistenza">
        <PopupAction
          title="Abbonamento"
          ariaLabel="Apri abbonamento"
          initialOpen={openBillingPopup}
          triggerRow={
            <SettingsRow
              dot="#0284c7"
              title="Abbonamento"
              lead="Piano e pagamento"
              status={billingRowStatus}
              statusTone={resolvedBillingStatus.canAccess ? "plain" : "warn"}
            />
          }
        >
          <BillingSettingsPanel activeBarName={activeBarName} status={resolvedBillingStatus} />
        </PopupAction>

        <PopupAction
          title="Documenti legali"
          ariaLabel="Apri documenti legali"
          triggerRow={
            <SettingsRow
              dot="#94a3b8"
              title="Documenti legali"
              lead="Privacy, termini, DPA"
              status={requiredLegalCount > 0 ? `${requiredLegalCount} da firmare` : "Firmati"}
              statusTone={requiredLegalCount > 0 ? "warn" : "plain"}
            />
          }
        >
          <LegalDocumentsPanel userId={session.user.id} />
        </PopupAction>

        <PopupAction
          title="Assistenza"
          ariaLabel="Apri assistenza"
          triggerRow={<SettingsRow dot="#7e22ce" title="Scrivi all&rsquo;assistenza" />}
        >
          <SupportPanel activeBarName={activeBarName} userEmail={session.user.email} />
        </PopupAction>
      </SettingsGroup>

      {/* The most irreversible thing in the app used to be a form at the
          bottom of a window opened from a card about passwords. */}
      <SettingsGroup>
        <PopupAction
          title="Elimina tutto"
          ariaLabel="Elimina locale e account"
          triggerRow={
            <SettingsRow
              dot="#e0868f"
              title="Elimina locale e account"
              lead="Non si torna indietro"
              tone="danger"
            />
          }
        >
          <DangerDeleteForm error={error} activeBarName={activeBarName} />
        </PopupAction>
      </SettingsGroup>
    </Stack>
  );
}
