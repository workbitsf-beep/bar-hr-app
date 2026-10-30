import { prisma } from "@/lib/prisma";
import { plainCounts } from "@/lib/security/backfill";
import { encryptionEnabled } from "@/lib/security/crypto";
import { getDashboardContext } from "../../context";
import { ConsoleButton } from "../console-form";
import { Empty, Figure, FigureBand, Forbidden, Note, Row, Section, Status } from "../console-ui";
import { clientNoticeText } from "@/lib/security/notices";
import { encryptExistingAction, notifyClientAction, resolveErrorAction, reviewAlertAction } from "./actions";

export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
const FIELD_LABELS: Record<string, string> = {
  "SupplierInvoice.xmlGz": "XML delle fatture dei fornitori",
  "SupplierPayment.iban": "IBAN dei fornitori",
  "Request.certificateCode": "Codici dei certificati di malattia",
  "EmployeeBar.payrollCode": "Matricole e codici fiscali",
  "Document.content": "Documenti del personale",
  "CourseCertificate.content": "Attestati dei corsi",
};

/**
 * Workbit's security at a glance: alerts to look at (and, when real, to pass
 * on to the client), server errors, sign-ins from new devices, who of Workbit
 * looked at which venue, and how much of the sensitive data is encrypted.
 */
export default async function SecurityPage() {
  const { role } = await getDashboardContext();
  if (String(role) !== "SUPER_ADMIN") return <Forbidden />;

  const day = new Date(Date.now() - 24 * 60 * 60_000);
  const [alerts, errors, newDevices, consoleViews, failedDay, okDay, counts] = await Promise.all([
    prisma.securityEvent.findMany({ where: { severity: "alert" }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.errorEvent.findMany({ where: { resolvedAt: null }, orderBy: { lastAt: "desc" }, take: 30 }),
    prisma.securityEvent.findMany({ where: { type: "login_ok", severity: "warn" }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.securityEvent.findMany({ where: { type: "console_view" }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.securityEvent.count({ where: { type: { in: ["login_failed", "code_failed"] }, createdAt: { gte: day } } }),
    prisma.securityEvent.count({ where: { type: "login_ok", createdAt: { gte: day } } }),
    plainCounts().catch(() => ({}) as Record<string, number>),
  ]);
  const open = alerts.filter((alert) => !alert.reviewedAt);
  const plainTotal = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const bars = await prisma.bar.findMany({ where: { id: { in: consoleViews.map((view) => view.barId).filter((id): id is string => Boolean(id)) } }, select: { id: true, name: true } });
  const barName = new Map(bars.map((bar) => [bar.id, bar.name]));

  return (
    <div className="wbc-page">
      <div className="wbc-page-head">
        <h1 className="wbc-title">Sicurezza</h1>
        <p className="wbc-desc">
          Avvisi, errori e accessi. Gli avvisi arrivano solo a voi super admin: un cliente riceve un messaggio solo quando premete «Avvisa il cliente», dopo aver controllato che non
          sia un falso allarme.
        </p>
      </div>

      <FigureBand>
        <Figure label="Avvisi da vedere" value={String(open.length)} tone={open.length ? "warning" : "positive"} />
        <Figure label="Errori aperti" value={String(errors.length)} tone={errors.length ? "warning" : "positive"} />
        <Figure label="Accessi riusciti (24 ore)" value={String(okDay)} />
        <Figure label="Accessi sbagliati (24 ore)" value={String(failedDay)} tone={failedDay > 20 ? "warning" : "neutral"} />
      </FigureBand>

      <Section title="Avvisi">
        {alerts.length ? (
          <div style={{ display: "grid", gap: 12 }}>
            {alerts.map((alert) => (
              <article key={alert.id} style={{ border: "1px solid #ece9f6", borderRadius: 16, padding: "14px 16px", display: "grid", gap: 6, opacity: alert.reviewedAt ? 0.6 : 1 }}>
                <b style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Status tone={alert.reviewedAt ? "neutral" : "warning"} label={alert.reviewedAt ? "visto" : "da vedere"} />
                  {when.format(alert.createdAt)} · {alert.detail}
                </b>
                {alert.ip || alert.userAgent ? (
                  <span style={{ fontSize: 13, color: "#6b6880" }}>
                    {alert.ip ?? ""} {alert.userAgent ? `· ${alert.userAgent.slice(0, 120)}` : ""}
                  </span>
                ) : null}
                {alert.clientNotifiedAt ? <span style={{ fontSize: 13, color: "#1f9d63" }}>Cliente avvisato il {when.format(alert.clientNotifiedAt)}</span> : null}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {!alert.reviewedAt ? <ConsoleButton action={reviewAlertAction} fields={{ id: alert.id }} label="Visto, è tutto a posto" className="wbc-btn wbc-btn-sm" /> : null}
                  {alert.email && !alert.clientNotifiedAt ? (
                    <ConsoleButton
                      action={notifyClientAction}
                      fields={{ id: alert.id }}
                      label={`Avvisa il cliente (${alert.email})`}
                      confirm={`Mandare a ${alert.email} questa email?\n\n${clientNoticeText(alert.alertKey ?? "").body}`}
                      className="wbc-btn wbc-btn-sm"
                    />
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty>Nessun avviso. Quando succede qualcosa di strano arriva una notifica e un&apos;email a voi super admin.</Empty>
        )}
      </Section>

      <Section title="Errori del server">
        {errors.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {errors.map((error) => (
              <article key={error.id} style={{ border: "1px solid #ece9f6", borderRadius: 16, padding: "12px 16px", display: "grid", gap: 4, fontSize: 14 }}>
                <b>{error.message.slice(0, 200)}</b>
                <span style={{ color: "#6b6880" }}>
                  {error.path ?? "pagina non nota"} · {error.count} {error.count === 1 ? "volta" : "volte"} · ultima {when.format(error.lastAt)}
                  {error.digest ? ` · codice ${error.digest}` : ""}
                </span>
                <div>
                  <ConsoleButton action={resolveErrorAction} fields={{ id: error.id }} label="Risolto" className="wbc-btn wbc-btn-sm" />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty>Nessun errore aperto.</Empty>
        )}
      </Section>

      <Section title="Cifratura dei dati sensibili">
        {encryptionEnabled() ? (
          <Note tone="positive">La chiave è attiva: i dati nuovi si salvano cifrati.</Note>
        ) : (
          <Note tone="warning">Manca la chiave DATA_ENCRYPTION_KEY su Railway: per ora i dati si salvano come prima.</Note>
        )}
        <div style={{ display: "grid", marginTop: 10 }}>
          {Object.entries(FIELD_LABELS).map(([key, label]) => (
            <Row
              key={key}
              title={label}
              status={<Status tone={(counts[key] ?? 0) === 0 ? "positive" : "warning"} label={(counts[key] ?? 0) === 0 ? "tutto cifrato" : `${counts[key]} in chiaro`} />}
            />
          ))}
        </div>
        {encryptionEnabled() && plainTotal > 0 ? (
          <div style={{ marginTop: 12 }}>
            <ConsoleButton
              action={encryptExistingAction}
              fields={{}}
              label={`Cifra i dati esistenti (${plainTotal})`}
              confirm="Cifrare adesso i dati salvati prima della chiave? Si può fare più volte, e l'app continua a funzionare."
              className="wbc-btn wbc-btn-primary"
            />
          </div>
        ) : null}
      </Section>

      <Section title="Accessi da dispositivi nuovi" flush>
        {newDevices.length ? (
          newDevices.map((event) => (
            <Row key={event.id} title={event.email ?? "?"} meta={`${when.format(event.createdAt)} · ${event.ip ?? ""} · ${(event.userAgent ?? "").slice(0, 80)}`} />
          ))
        ) : (
          <Empty>Nessun accesso da dispositivi nuovi.</Empty>
        )}
      </Section>

      <Section title="Chi di Workbit ha aperto quale locale" flush>
        {consoleViews.length ? (
          consoleViews.map((view) => (
            <Row key={view.id} title={`${view.email ?? "?"} → ${barName.get(view.barId ?? "") ?? "locale"}`} meta={when.format(view.createdAt)} />
          ))
        ) : (
          <Empty>Nessuna apertura registrata.</Empty>
        )}
      </Section>
    </div>
  );
}
