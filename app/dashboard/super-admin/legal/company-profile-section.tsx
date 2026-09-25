import {
  COMPANY_PROFILE_LABELS,
  getMissingProfileFields,
  type CompanyProfile,
} from "@/lib/company-profile";
import { LEGAL_TEMPLATES } from "@/lib/legal-templates";
import { legalDocumentTypeLabels } from "@/lib/legal-documents";
import { generateLegalDocumentAction, saveCompanyProfileAction } from "./actions";

type Field = { key: keyof CompanyProfile; wide?: boolean; hint?: string };

const GROUPS: Array<{ legend: string; fields: Field[] }> = [
  {
    legend: "Società",
    fields: [
      { key: "legalName", wide: true },
      { key: "registeredOffice", wide: true },
      { key: "vatNumber" },
      { key: "taxCode", hint: "solo se diverso" },
      { key: "reaAndCapital", wide: true, hint: "facoltativo" },
      { key: "legalRepresentative" },
      { key: "certifiedEmail" },
    ],
  },
  {
    legend: "Contatti e servizio",
    fields: [
      { key: "serviceName" },
      { key: "website" },
      { key: "privacyEmail" },
      { key: "supportEmail" },
      { key: "dpoContact", hint: "solo se nominato" },
      { key: "courtCity", hint: "città" },
      { key: "hostingRegion", wide: true, hint: "da leggere sulla console Railway" },
    ],
  },
  {
    legend: "Contratto",
    fields: [
      { key: "trialDays" },
      { key: "noticeDays" },
      { key: "exportDays" },
      { key: "breachHours" },
      { key: "deletionPath", wide: true },
      { key: "deletionDays" },
    ],
  },
  {
    legend: "Conservazione",
    fields: [
      { key: "retentionTimelogs", wide: true },
      { key: "retentionPosition", wide: true },
      { key: "retentionRequests", wide: true },
      { key: "retentionCertificate", wide: true },
      { key: "retentionNotes", wide: true },
      { key: "retentionDocuments", wide: true },
      { key: "retentionAccessLogs", wide: true },
      { key: "retentionTaxData", wide: true },
    ],
  },
  {
    legend: "Versione",
    fields: [{ key: "documentVersion" }, { key: "effectiveFrom", hint: "es. 1 ottobre 2026" }],
  },
];

/**
 * The company details, entered once, and a button per document.
 *
 * The documents are generated switched off: publishing stays a decision, not a
 * side effect of pressing generate.
 */
export function CompanyProfileSection({
  profile,
  existingTitles,
}: {
  profile: CompanyProfile;
  existingTitles: string[];
}) {
  const missing = getMissingProfileFields(profile);

  return (
    <>
      <form action={saveCompanyProfileAction} className="wbc-form" style={{ display: "grid", gap: 18 }}>
        {missing.length > 0 ? (
          <p className="wbc-note wbc-note-warning" style={{ margin: 0 }}>
            Mancano {missing.length} dati: nei documenti generati compaiono come{" "}
            <code>[{COMPANY_PROFILE_LABELS[missing[0]]}]</code>, così non passano inosservati.
          </p>
        ) : (
          <p className="wbc-note wbc-note-positive" style={{ margin: 0 }}>
            Tutti i dati necessari sono compilati.
          </p>
        )}

        {GROUPS.map((group) => (
          <fieldset key={group.legend} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 10 }}>
            <strong style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.6 }}>
              {group.legend}
            </strong>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                gap: 10,
              }}
            >
              {group.fields.map((field) => (
                <label
                  key={field.key}
                  style={{ display: "grid", gap: 4, gridColumn: field.wide ? "1 / -1" : undefined }}
                >
                  <span style={{ fontSize: 12.5, opacity: 0.75 }}>
                    {COMPANY_PROFILE_LABELS[field.key]}
                    {field.hint ? <em style={{ opacity: 0.6 }}> · {field.hint}</em> : null}
                  </span>
                  <input
                    name={field.key}
                    defaultValue={String(profile[field.key] ?? "")}
                    autoComplete="off"
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <label className="wbc-check">
            <input
              type="checkbox"
              name="collectsCertificateCode"
              defaultChecked={profile.collectsCertificateCode}
            />
            Il sistema raccoglie il codice del certificato medico
          </label>
          <label className="wbc-check">
            <input type="checkbox" name="invoicingActive" defaultChecked={profile.invoicingActive} />
            Fatture in Cloud è attivo
          </label>
        </div>

        <button type="submit" className="wbc-btn wbc-btn-primary">
          Salva dati societari
        </button>
      </form>

      <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
        {LEGAL_TEMPLATES.map((template) => {
          const exists = existingTitles.includes(template.title);

          return (
            <form
              key={template.title}
              action={generateLegalDocumentAction}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                flexWrap: "wrap",
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.09)",
              }}
            >
              <input type="hidden" name="templateTitle" value={template.title} />
              <div style={{ display: "grid", gap: 2, minWidth: 0, flex: "1 1 240px" }}>
                <strong style={{ fontSize: 14 }}>
                  {template.title}
                  {template.internal ? (
                    <em style={{ opacity: 0.55, fontStyle: "normal" }}> · interno</em>
                  ) : template.essential ? null : (
                    <em style={{ opacity: 0.55, fontStyle: "normal" }}> · facoltativo</em>
                  )}
                </strong>
                <span style={{ fontSize: 12.5, opacity: 0.66 }}>{template.summary}</span>
                <span style={{ fontSize: 11.5, opacity: 0.5 }}>
                  {legalDocumentTypeLabels[template.type]}
                </span>
              </div>
              <button type="submit" className="wbc-btn wbc-btn-ghost wbc-btn-sm">
                {exists ? "Rigenera" : "Crea"}
              </button>
            </form>
          );
        })}
      </div>
    </>
  );
}
