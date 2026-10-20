import Link from "next/link";
import { FiscalState, InvoiceStatus } from "@prisma/client";
import { fiscalIssuerOf, getCompanyProfile } from "@/lib/company-profile";
import { missingIssuerFields } from "@/lib/invoicing/fattura-pa";
import { formatCents } from "@/lib/ledger";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../../../context";
import { ConsoleButton, ConsoleForm } from "../../console-form";
import { Empty, Figure, FigureBand, Forbidden, Note, Row, Section, Status, type Tone } from "../../console-ui";
import { markInvoiceSentAction, refreshInvoiceStateAction, sendInvoiceToSdiAction, testInvoiceAction, prepareWaitingInvoicesAction } from "./actions";
import { sdiConfig } from "@/lib/invoicing/openapi-sdi";

/**
 * Denaro → Fatture: an electronic invoice for every payment, in the regime
 * forfettario. Each says where it stands; until a provider sends them to the
 * SDI, a ready one is downloaded, uploaded on Fatture e Corrispettivi and
 * marked as sent here.
 */

const STATE: Record<FiscalState, { label: string; tone: Tone }> = {
  NONE: { label: "In attesa", tone: "neutral" },
  MISSING_DATA: { label: "Dati mancanti", tone: "warning" },
  READY: { label: "Da inviare", tone: "warning" },
  SENT: { label: "Inviata", tone: "positive" },
  DELIVERED: { label: "Consegnata", tone: "positive" },
  REJECTED: { label: "Scartata", tone: "negative" },
};

const day = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Rome" });

export default async function ConsoleInvoicesPage() {
  const { role } = await getDashboardContext();
  if (String(role) !== "SUPER_ADMIN") return Forbidden();

  const year = Number(new Intl.DateTimeFormat("en", { timeZone: "Europe/Rome", year: "numeric" }).format(new Date()));
  const [profile, invoices, yearTotal, venues] = await Promise.all([
    getCompanyProfile(),
    prisma.invoice.findMany({
      where: { status: InvoiceStatus.PAID, totalAmount: { gt: 0 } },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      take: 150,
      select: {
        id: true,
        totalAmount: true,
        paidAt: true,
        issuedAt: true,
        fiscalState: true,
        fiscalNumber: true,
        fiscalError: true,
        fiscalXml: true,
        fiscalDocumentId: true,
        bar: { select: { name: true, billingProfile: { select: { businessName: true } } } },
      },
    }),
    prisma.invoice.aggregate({ where: { fiscalYear: year }, _sum: { totalAmount: true }, _count: true }),
    prisma.bar.findMany({ where: { mainBarId: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const issuerMissing = missingIssuerFields(fiscalIssuerOf(profile));
  // Openapi set up: invoices go to the SDI by themselves.
  const sdi = sdiConfig();
  const count = (states: FiscalState[]) => invoices.filter((invoice) => states.includes(invoice.fiscalState)).length;
  const toSend = count([FiscalState.READY, FiscalState.REJECTED]);
  const waiting = count([FiscalState.NONE, FiscalState.MISSING_DATA]);

  return (
    <div className="wbc-page">
      <nav className="wbc-chips" aria-label="Denaro" style={{ marginBottom: 14 }}>
        <Link className="wbc-chip" data-on="0" href="/dashboard/super-admin/money">
          Abbonamenti
        </Link>
        <Link className="wbc-chip" data-on="0" href="/dashboard/super-admin/money/costs">
          Costi e debiti
        </Link>
        <Link className="wbc-chip" data-on="1" href="/dashboard/super-admin/money/invoices" aria-current="page">
          Fatture
        </Link>
      </nav>
      <div className="wbc-page-head">
        <h1 className="wbc-title">Fatture</h1>
        <p className="wbc-desc">
          Una fattura elettronica per ogni pagamento, in regime forfettario: senza IVA, con il bollo da 2 € sopra
          77,47 €.
        </p>
      </div>

      {issuerMissing.length ? (
        <Note tone="warning">
          Prima della prima fattura mancano i tuoi dati: {issuerMissing.join(", ")}. Si compilano in{" "}
          <Link href="/dashboard/super-admin/legal">Legale › Dati societari</Link>; poi qui premi “Prepara quelle
          in attesa”.
        </Note>
      ) : (
        <Note tone={sdi?.sandbox ? "warning" : "positive"}>
          {sdi
            ? sdi.sandbox
              ? "Invio automatico attivo in prova (Openapi sandbox): le fatture non arrivano davvero allo SDI."
              : "Invio automatico attivo: ogni fattura pronta parte da sola verso lo SDI tramite Openapi, e lo stato si aggiorna quando lo SDI risponde."
            : "I tuoi dati da emittente sono completi. L'invio automatico allo SDI non è ancora collegato: scarica l'XML, caricalo su Fatture e Corrispettivi e segnalo come inviato."}
        </Note>
      )}

      <FigureBand>
        <Figure label="Da inviare" value={String(toSend)} meta={sdi ? "pronte o scartate" : "pronte, da caricare"} tone={toSend ? "warning" : "neutral"} />
        <Figure label="In attesa" value={String(waiting)} meta="mancano dati" tone={waiting ? "warning" : "neutral"} />
        <Figure
          label={`Fatturato ${year}`}
          value={formatCents(yearTotal._sum.totalAmount ?? 0)}
          meta={yearTotal._count === 1 ? "1 fattura" : `${yearTotal._count} fatture`}
          tone="positive"
        />
      </FigureBand>

      <Section title="Fattura di prova">
        <p className="wbc-row-meta" style={{ margin: 0 }}>
          Finta, dall&apos;inizio alla fine: dati del locale scelto, numero PROVA fuori dalla numerazione, invio allo SDI
          di prova di Openapi (non arriva a nessuno) e email a te con PDF e XML. Nessun pagamento.
        </p>
        <ConsoleForm action={testInvoiceAction} label="Fai una fattura di prova" pendingLabel="Invio…" style={{ gap: 10 }}>
          <select name="barId" defaultValue={venues.find((venue) => /caff/i.test(venue.name))?.id ?? venues[0]?.id}>
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
        </ConsoleForm>
      </Section>

      <Section
        title="Pagamenti e fatture"
        action={
          waiting ? (
            <ConsoleButton
              action={prepareWaitingInvoicesAction}
              fields={{}}
              label="Prepara quelle in attesa"
              pendingLabel="Preparo…"
              className="wbc-btn wbc-btn-primary wbc-btn-sm"
            />
          ) : null
        }
      >
        {invoices.length === 0 ? (
          <Empty>Ancora nessun pagamento.</Empty>
        ) : (
          invoices.map((invoice) => {
            const state = STATE[invoice.fiscalState];
            const when = invoice.paidAt ?? invoice.issuedAt;
            return (
              <div key={invoice.id} style={{ display: "grid", gap: 6 }}>
                <Row
                  title={
                    <>
                      {invoice.fiscalNumber ? <strong>N. {invoice.fiscalNumber}</strong> : null}
                      {invoice.fiscalNumber ? " · " : ""}
                      {invoice.bar.billingProfile?.businessName || invoice.bar.name}
                    </>
                  }
                  meta={
                    invoice.fiscalError
                      ? invoice.fiscalError
                      : when
                        ? `pagata il ${day.format(when)}`
                        : undefined
                  }
                  status={<Status tone={state.tone} label={state.label} />}
                  value={formatCents(invoice.totalAmount)}
                />
                {invoice.fiscalXml ? (
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingBottom: 8 }}>
                    <a
                      className="wbc-btn wbc-btn-ghost wbc-btn-sm"
                      href={`/dashboard/super-admin/money/invoices/${invoice.id}/xml`}
                      download
                    >
                      Scarica XML
                    </a>
                    {(invoice.fiscalState === FiscalState.READY || invoice.fiscalState === FiscalState.REJECTED) && sdi ? (
                      <ConsoleButton
                        action={sendInvoiceToSdiAction}
                        fields={{ invoiceId: invoice.id }}
                        label={invoice.fiscalState === FiscalState.REJECTED ? "Invia di nuovo" : "Invia allo SDI"}
                        pendingLabel="Invio…"
                        className="wbc-btn wbc-btn-primary wbc-btn-sm"
                      />
                    ) : null}
                    {/* Also with Openapi set up: an XML uploaded by hand to Fatture e
                        Corrispettivi (no credit, say) must stop the nightly send, or
                        the same invoice reaches the SDI twice. */}
                    {invoice.fiscalState === FiscalState.READY || invoice.fiscalState === FiscalState.REJECTED ? (
                      <ConsoleButton
                        action={markInvoiceSentAction}
                        fields={{ invoiceId: invoice.id }}
                        label={sdi ? "Inviata a mano" : "Segna inviata"}
                        className="wbc-btn wbc-btn-primary wbc-btn-sm"
                      />
                    ) : null}
                    {invoice.fiscalState === FiscalState.SENT && sdi && invoice.fiscalDocumentId ? (
                      <ConsoleButton
                        action={refreshInvoiceStateAction}
                        fields={{ invoiceId: invoice.id }}
                        label="Aggiorna stato"
                        pendingLabel="Chiedo…"
                        className="wbc-btn wbc-btn-ghost wbc-btn-sm"
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </Section>
    </div>
  );
}
