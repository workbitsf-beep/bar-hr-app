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
  closeOwnAccountAction,
  deleteOwnerAccountAndBarAction,
  setLanguageAction,
  updateBarDetailsAction,
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
import { SupportPanel } from "./support-panel";
import { StandardHoursForm, type StandardHourEntry } from "./standard-hours-form";
import { ExternalLink } from "@/app/components/external-link";
import { getVenueDepartments } from "@/lib/departments";
import { DepartmentSettingsForm } from "../department-forms";

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
        style={{
          width: 9,
          height: 9,
          flex: "0 0 auto",
          borderRadius: 999,
          background: tone === "danger" ? "#b3202f" : dot,
        }}
      />
      <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
        <strong
          style={{
            fontSize: 14,
            // A rose that reads as decoration on white is the wrong warning.
            fontWeight: tone === "danger" ? 820 : 760,
            color: tone === "danger" ? "#a11626" : "#17161f",
          }}
        >
          {title}
        </strong>
        {lead ? (
          <span
            style={{
              fontSize: 11.5,
              fontWeight: tone === "danger" ? 620 : 520,
              color: tone === "danger" ? "#c2586a" : "#a3a0b8",
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
function SettingsGroup({
  label,
  tone = "default",
  children,
}: {
  label?: string;
  tone?: "default" | "danger";
  children: ReactNode;
}) {
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
          background: tone === "danger" ? "#fdf2f3" : "#ffffff",
          border: `1px solid ${tone === "danger" ? "#f0cdd2" : "#e9e6f5"}`,
          borderRadius: 18,
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The venue's details, as fields rather than as a paragraph.
 *
 * This window used to print the name, the address and the contacts and let
 * you do nothing about any of it - and they are what goes on documents and
 * in emails, so they change.
 */
function VenueDetailsPanel({
  name,
  activityLabel,
  addressLine1,
  postalCode,
  city,
  phone,
  email,
}: {
  name: string;
  activityLabel: string;
  addressLine1: string | null;
  postalCode: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
}) {
  return (
    <form action={updateBarDetailsAction} style={{ display: "grid", gap: 13 }}>
      <FormField label="Nome">
        <TextInput name="name" defaultValue={name} required />
      </FormField>

      <FormField label="Tipo">
        <span
          style={{
            display: "flex",
            alignItems: "center",
            minHeight: 46,
            padding: "0 13px",
            borderRadius: 14,
            background: "#f4f3fa",
            color: "#8b88a3",
            fontSize: 14.5,
            fontWeight: 620,
          }}
        >
          {activityLabel}
        </span>
      </FormField>

      <FormField label="Indirizzo">
        <TextInput name="addressLine1" defaultValue={addressLine1 ?? ""} placeholder="Via e numero" />
      </FormField>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 96px) minmax(0, 1fr)", gap: 10 }}>
        <FormField label="CAP">
          <TextInput name="postalCode" defaultValue={postalCode ?? ""} inputMode="numeric" />
        </FormField>
        <FormField label="Città">
          <TextInput name="city" defaultValue={city ?? ""} />
        </FormField>
      </div>

      <FormField label="Telefono">
        <TextInput name="phone" type="tel" defaultValue={phone ?? ""} placeholder="Non impostato" />
      </FormField>

      <FormField label="Email">
        <TextInput name="email" type="email" defaultValue={email ?? ""} placeholder="Non impostata" />
      </FormField>

      <div className="dashboard-form-actions">
        <PrimaryButton type="button" tone="sand" data-popup-close>
          Annulla
        </PrimaryButton>
        <PrimaryButton type="submit">Salva</PrimaryButton>
      </div>
    </form>
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

/**
 * The venue's legal documents, one row each.
 *
 * Every row used to carry a "Visualizza" button that opened a second window
 * on top of the one already open. The row is the way in now, and the one
 * still waiting for a signature wears the amber rail the calendar uses for
 * something that needs attention.
 */
/**
 * What an employee is shown, and what is none of their business.
 *
 * The privacy notice and the geolocation notice are theirs: the app records
 * where they are when they clock in, and the law that allows that also
 * requires they be told, in terms they can go back and read. The DPA and the
 * SaaS contract are between the venue and Workbit - they belong to whoever
 * signed them, not to whoever works there.
 */
const EMPLOYEE_LEGAL_TYPES = new Set<string>([
  "PRIVACY_POLICY",
  "GEOLOCATION_NOTICE",
  "COOKIE_POLICY",
  "ACCOUNT_DELETION",
]);

async function LegalDocumentsPanel({
  userId,
  onlyOwnDocuments = false,
}: {
  userId: string;
  onlyOwnDocuments?: boolean;
}) {
  const allDocuments = await getLegalDocumentsWithAcceptance(userId);
  const documents = onlyOwnDocuments
    ? allDocuments.filter((document) => EMPLOYEE_LEGAL_TYPES.has(String(document.type)))
    : allDocuments;

  if (documents.length === 0) {
    return <EmptyState message="Nessun documento legale disponibile." />;
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      {documents.map((document) => {
        const currentAcceptance = document.acceptances.find(
          (acceptance) =>
            acceptance.version === document.version && acceptance.revision === document.revision
        );
        const accepted = Boolean(currentAcceptance);
        const pending = !accepted && document.isRequired;

        return (
          <PopupAction
            key={document.id}
            title={document.title}
            ariaLabel={`Apri ${document.title}`}
            triggerRow={
              <span
                style={{
                  display: "grid",
                  gridTemplateColumns: "3px minmax(0, 1fr)",
                  borderRadius: 13,
                  overflow: "hidden",
                  border: `1px solid ${pending ? "#f5dcb3" : "#f0eef9"}`,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{ background: pending ? "#f0a742" : accepted ? "#6ed3a8" : "#c9c4e8" }}
                />
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 11px",
                    minWidth: 0,
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
                    <strong style={{ fontSize: 13.5, fontWeight: 770, color: "#17161f" }}>
                      {document.title}
                    </strong>
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
                      v{document.version}.{document.revision}
                      {currentAcceptance
                        ? ` · accettato il ${currentAcceptance.acceptedAt.toLocaleDateString("it-IT", {
                            day: "numeric",
                            month: "short",
                          })}`
                        : ` · ${legalDocumentTypeLabels[document.type]}`}
                    </span>
                  </span>
                  <span
                    style={{
                      flex: "0 0 auto",
                      fontSize: 9.5,
                      fontWeight: 830,
                      letterSpacing: "0.09em",
                      textTransform: "uppercase",
                      color: pending ? "#a15c07" : "#8b88a3",
                    }}
                  >
                    {accepted ? "Firmato" : pending ? "Da firmare" : "Disponibile"}
                  </span>
                  <span aria-hidden="true" style={{ flex: "0 0 auto", color: "#c8c5d8", fontSize: 14 }}>
                    ›
                  </span>
                </span>
              </span>
            }
          >
            <div style={{ display: "grid", gap: 12, color: "#334155", lineHeight: 1.65 }}>
              <StatusPill
                label={`Versione ${document.version}.${document.revision}`}
                tone="neutral"
              />
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
            </div>
          </PopupAction>
        );
      })}
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
  memberCount,
}: {
  error: string;
  activeBarName: string | null;
  memberCount: number;
}) {
  return (
    <form action={deleteOwnerAccountAndBarAction} style={{ display: "grid", gap: 14 }}>
      {/* It used to say "e i dati collegati", which is true and tells you
          nothing. This says what goes and who it belongs to. */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "13px 14px",
          borderRadius: 16,
          background: "#fdf2f3",
          border: "1px solid #f0cdd2",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            flex: "0 0 auto",
            width: 19,
            height: 19,
            borderRadius: 999,
            background: "#b3202f",
            color: "#ffffff",
            display: "grid",
            placeItems: "center",
            fontSize: 12,
            fontWeight: 850,
          }}
        >
          !
        </span>
        <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
          <strong style={{ fontSize: 13.5, fontWeight: 830, color: "#a11626" }}>
            {activeBarName ? `Sparisce ${activeBarName}` : "Sparisce il locale"}
            {memberCount > 0
              ? ` e tutto quello di ${memberCount} ${memberCount === 1 ? "persona" : "persone"}`
              : ""}
          </strong>
          <span style={{ fontSize: 12.5, fontWeight: 560, color: "#a8535f", lineHeight: 1.5 }}>
            Turni, timbrature, richieste, note e documenti. Se non hai altri locali sparisce anche
            il tuo account. <strong style={{ fontWeight: 830 }}>Non si torna indietro.</strong>
          </span>
        </span>
      </div>

      {/* The clock-ins are the employer's to keep for five years, by law, and
          deleting the venue deletes them. The reports are the way to keep
          them, so they come before the button, not after. */}
      <div
        style={{
          display: "grid",
          gap: 8,
          padding: "12px 14px",
          borderRadius: 16,
          background: "#f6f3ff",
          border: "1px solid #ddd6fe",
          fontSize: 13,
          color: "#4c1d95",
          lineHeight: 1.55,
        }}
      >
        <span>
          Per legge le timbrature vanno conservate 5 anni. Prima di eliminare, scarica i report
          dei mesi che ti servono: dopo non si recuperano.
        </span>
        <a href="/dashboard/export" style={{ color: "#4c1d95", fontWeight: 700 }}>
          Vai ai report ›
        </a>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600 }}>
          <input type="checkbox" name="reportsDownloaded" required />
          Ho scaricato i report che mi servono
        </label>
      </div>

      <FormField label="Scrivi ELIMINA per confermare">
        <TextInput name="confirmation" required autoComplete="off" placeholder="ELIMINA" />
      </FormField>

      <FormField label="La tua password">
        <TextInput name="password" type="password" required autoComplete="current-password" />
      </FormField>

      {error === "delete-reports" ? (
        <p style={{ margin: 0, color: "#b91c1c", fontWeight: 800 }}>
          Conferma di aver scaricato i report che ti servono.
        </p>
      ) : null}
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
          Elimina definitivamente
        </PrimaryButton>
      </div>
    </form>
  );
}

// Closing one's own account, for everyone who is not the owner. The stores
// require it inside the app; what it can and cannot erase is said plainly,
// because the hours worked stay with the employer by law.
function CloseAccountForm({ error }: { error: string }) {
  return (
    <form action={closeOwnAccountAction} style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          display: "grid",
          gap: 4,
          padding: "12px 14px",
          borderRadius: 16,
          background: "#fff1f2",
          border: "1px solid #fecdd3",
        }}
      >
        <strong style={{ fontSize: 13.5, fontWeight: 830, color: "#a11626" }}>
          Il tuo account viene chiuso
        </strong>
        <span style={{ fontSize: 12.5, fontWeight: 560, color: "#a8535f", lineHeight: 1.5 }}>
          Esci da tutti i locali e dai turni futuri, e non potrai più accedere. Email, password,
          sblocco col telefono e notifiche vengono cancellati. Le timbrature e le richieste già
          fatte restano al datore di lavoro, che per legge deve conservarle.{" "}
          <strong style={{ fontWeight: 830 }}>Non si torna indietro.</strong>
        </span>
      </div>

      <FormField label="Scrivi ELIMINA per confermare">
        <TextInput name="confirmation" required autoComplete="off" placeholder="ELIMINA" />
      </FormField>

      <FormField label="La tua password">
        <TextInput name="password" type="password" required autoComplete="current-password" />
      </FormField>

      {error === "close-confirmation" ? (
        <p style={{ margin: 0, color: "#b91c1c", fontWeight: 800 }}>Scrivi ELIMINA per confermare.</p>
      ) : null}
      {error === "close-password" ? (
        <p style={{ margin: 0, color: "#b91c1c", fontWeight: 800 }}>Password non corretta.</p>
      ) : null}
      {error === "close-owner" ? (
        <p style={{ margin: 0, color: "#b91c1c", fontWeight: 800 }}>
          Sei titolare di un locale: elimina prima il locale dalle sue impostazioni.
        </p>
      ) : null}

      <div className="dashboard-form-actions">
        <PrimaryButton type="button" tone="sand" data-popup-close>
          Annulla
        </PrimaryButton>
        <PrimaryButton type="submit" tone="red">
          Chiudi il mio account
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
  const [passkeyCount, departments] = await Promise.all([
    getPasskeyCount(session.user.id),
    getVenueDepartments(activeBarId, session.user.id),
  ]);
  // Pro only: how many people work in each department, for the settings row.
  const departmentCounts: Record<string, number> = {};
  if (departments.enabled && activeBarId) {
    const grouped = await prisma.employeeBar.groupBy({
      by: ["department"],
      where: { barId: activeBarId, isActive: true, department: { not: null } },
      _count: { _all: true },
    });
    for (const entry of grouped) if (entry.department) departmentCounts[entry.department] = entry._count._all;
  }
  const languageLabel =
    sessionLanguage === "en" ? "English" : sessionLanguage === "es" ? "Español" : "Italiano";

  // One window, not two panels stacked inside one: both of these answer the
  // same question, which is how you get in.
  const securityContent = (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 830,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#a3a0b8",
          }}
        >
          Sblocco col telefono
        </span>
        <WebAuthnRegistrationPanel initialPasskeyCount={passkeyCount} />
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 830,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#a3a0b8",
          }}
        >
          Password
        </span>
        <PasswordChangePanel />
      </div>
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
            lead={role === Role.OWNER ? "Privacy, termini, DPA" : "Privacy e geolocalizzazione"}
          />
        }
      >
        <LegalDocumentsPanel userId={session.user.id} onlyOwnDocuments={role !== Role.OWNER} />
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
        <SettingsGroup tone="danger">
          <PopupAction
            title="Chiudi account"
            // Not starting with "Elimina": see the owner's danger row below.
            ariaLabel="Apri la chiusura del tuo account"
            initialOpen={error.startsWith("close-")}
            triggerRow={
              <SettingsRow
                dot="#e0868f"
                title="Elimina il mio account"
                lead="Non si torna indietro"
                tone="danger"
              />
            }
          >
            <CloseAccountForm error={error} />
          </PopupAction>
        </SettingsGroup>
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
  // How many people the deletion would take with it, so the warning can say so.
  const memberCount = await prisma.employeeBar.count({ where: { barId: activeBarId } });
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
          <VenueDetailsPanel
            name={activeBar?.name ?? activeBarName ?? ""}
            activityLabel={localeProps.activityLabel}
            addressLine1={activeBar?.addressLine1 ?? null}
            postalCode={activeBar?.postalCode ?? null}
            city={activeBar?.city ?? null}
            phone={activeBar?.phone ?? null}
            email={activeBar?.email ?? null}
          />
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

        {departments.enabled && role === Role.OWNER ? (
          <PopupAction
            title="Reparti"
            ariaLabel="Apri i reparti"
            triggerRow={
              <SettingsRow
                dot="#d6338a"
                title="Reparti"
                lead={departments.mode === "SEPARATE" ? "Un calendario per reparto" : "Calendario unico"}
                status={String(departments.list.length)}
              />
            }
          >
            <DepartmentSettingsForm
              mode={departments.mode}
              customName={departments.customName}
              departments={departments.list}
              counts={departmentCounts}
            />
          </PopupAction>
        ) : null}

        {isRestaurant && timeTrackingOn ? (
          <PopupAction
            title="Dove si timbra"
            ariaLabel="Apri la posizione di timbratura"
            triggerRow={
              <SettingsRow
                dot="#10b981"
                title="Dove si timbra"
                lead="Posizione e raggio"
                status={hasGpsPoint ? "Impostata" : "Da impostare"}
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
      <SettingsGroup tone="danger">
        <PopupAction
          title="Elimina tutto"
          // Not starting with "Elimina": a global rule paints every button
          // whose label does in a red gradient with white text, which turned
          // this row into dark red on red.
          ariaLabel="Apri la cancellazione del locale"
          triggerRow={
            <SettingsRow
              dot="#e0868f"
              title="Elimina locale e account"
              lead="Non si torna indietro"
              tone="danger"
            />
          }
        >
          <DangerDeleteForm error={error} activeBarName={activeBarName} memberCount={memberCount} />
        </PopupAction>
      </SettingsGroup>
    </Stack>
  );
}
