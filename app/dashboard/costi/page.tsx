import Link from "next/link";
import { Role } from "@prisma/client";
import { ActionForm } from "@/app/components/action-form";
import { PendingButton } from "@/app/components/pending-button";
import { aiEnabled } from "@/lib/costs/ai";
import { buildCostReport, monthLabel, shiftMonth, type CostReport } from "@/lib/costs/analysis";
import { BASE_UNIT_LABEL } from "@/lib/costs/categories";
import { inboxAvailable, OPENAPI_RECIPIENT_CODE } from "@/lib/costs/openapi-inbox";
import { costsEnabledFor } from "@/lib/costs/access";
import { buildSchedule } from "@/lib/costs/payments";
import { prisma } from "@/lib/prisma";
import { BillingRequired } from "../billing-required";
import { getDashboardContext } from "../context";
import { EmptyState, FormField, Panel, PrimaryButton, TextInput } from "../ui";
import { PopupAction } from "../popup-action";
import {
  activateInboxAction,
  addAccountantAction,
  removeAccountantAction,
  deactivateInboxAction,
  deleteUploadAction,
  priceCheckAction,
  reclassifyAction,
  saveRevenueAction,
  syncInboxAction,
} from "./actions";
import { Bar, change, Delta, Dot, euro, Line, Pill, Row, RowsCard, softButton } from "./cost-ui";
import { UploadPanel } from "./upload-panel";

export const dynamic = "force-dynamic";

function unitPrice(value: number | null, unit: string) {
  if (value === null) return "";
  return `${value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 3 })} €/${BASE_UNIT_LABEL[unit] ?? unit}`;
}

export default async function CostsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { session, role, activeBarId, billingStatus, activeBarActivityType } = await getDashboardContext();
  const company = activeBarActivityType === "COMPANY";
  if (!activeBarId) {
    return (
      <Panel title="Costi">
        <EmptyState message="Seleziona un locale." />
      </Panel>
    );
  }
  if (billingStatus && !billingStatus.canAccess) return <BillingRequired role={String(role)} />;
  if (role !== Role.OWNER || !costsEnabledFor(session.user.role)) {
    return (
      <Panel title="Costi">
        <EmptyState message="I costi del locale li vede solo il titolare." />
      </Panel>
    );
  }

  const { month: requested } = await searchParams;
  const [report, settings, uploads, bar, accountants] = await Promise.all([
    buildCostReport(activeBarId, requested && /^\d{4}-\d{2}$/.test(requested) ? requested : null),
    prisma.barSettings.findUnique({
      where: { barId: activeBarId },
      select: { invoiceInboxStatus: true, invoiceInboxFiscalId: true, invoiceInboxSince: true, invoiceInboxSyncedAt: true },
    }),
    prisma.invoiceUpload.findMany({ where: { barId: activeBarId }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.bar.findUnique({ where: { id: activeBarId }, select: { vatNumber: true, mainBar: { select: { vatNumber: true } } } }),
    prisma.accountantAccess.findMany({ where: { barId: activeBarId }, orderBy: { createdAt: "asc" }, select: { id: true, email: true, name: true } }),
  ]);
  const schedule = report ? await buildSchedule(activeBarId) : null;
  const ai = aiEnabled();

  return (
    <div className="wbcost" style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 760, margin: "0 auto", width: "100%" }}>
      <header style={{ display: "grid", gap: 2, padding: "0 4px" }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.05 }}>Costi</h1>
      </header>

      {report ? <MonthChips report={report} /> : null}

      {report ? (
        <>
          <Summary report={report} company={company} />
          {schedule ? <PaymentsLink schedule={schedule} /> : null}
          <Colleagues report={report} />
          <MonthStory report={report} />
          <ProductTrends report={report} />
          <Savings report={report} ai={ai} />
          <Categories report={report} />
          <Suppliers report={report} />
          <PriceChanges report={report} />
          <Products barId={activeBarId} report={report} ai={ai} />
          <Energy barId={activeBarId} report={report} ai={ai} />
          {report.pendingLines ? (
            <RowsCard>
              <Row first rail="amber">
                <Line left={`${report.pendingLines} righe da classificare`} right={<Link href={`/dashboard/costi/fatture?month=${report.month}&da=1`} style={{ color: "#5e4ae3" }}>Sistema ›</Link>} />
                <Line muted left="Nessuna regola le riconosce ancora: scegli tu la categoria, Workbit la ricorda per le prossime fatture." />
                {ai ? (
                  <ActionForm action={reclassifyAction} success="Righe rilette" style={{ marginTop: 6 }}>
                    <PendingButton type="submit" style={softButton} pendingLabel="Leggo…">
                      Fai leggere le righe a Workbit
                    </PendingButton>
                  </ActionForm>
                ) : null}
              </Row>
            </RowsCard>
          ) : null}
        </>
      ) : (
        <RowsCard>
          <Row first>
            <Line left="Carica le fatture dei fornitori" />
            <Line
              muted
              left="Workbit legge le fatture elettroniche, le divide per categoria e fornitore, segue i prezzi mese per mese e ti dice dove puoi risparmiare. Con le ore delle timbrature calcola anche quanto costa il personale."
            />
          </Row>
        </RowsCard>
      )}

      <section style={{ display: "grid", gap: 8 }}>
        <RowsCard title="Fatture" aside={report ? <Link href={`/dashboard/costi/fatture?month=${report.month}`} style={{ color: "#5e4ae3" }}>Tutte le fatture ›</Link> : null}>
          <Row first>
            <div data-tour="upload" style={{ display: "contents" }}><UploadPanel compact={Boolean(report)} allowAnyRecipient={String(session.user.role) === "SUPER_ADMIN"} /></div>
            <details style={{ marginTop: 4 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, color: "#5e4ae3" }}>Come si scarica lo zip dal cassetto fiscale</summary>
              <ol style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 13, color: "#4b4763", display: "grid", gap: 4 }}>
                <li>Entra in Fatture e Corrispettivi sul sito dell&apos;Agenzia delle Entrate (SPID o CIE).</li>
                <li>Consultazione → Fatture elettroniche e altri dati IVA → Fatture ricevute.</li>
                <li>Scegli il mese, seleziona tutte le fatture e scaricale: arriva uno zip.</li>
                <li>Caricalo qui così com&apos;è, anche con dentro i file .p7m firmati e i metadati.</li>
              </ol>
              <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#7c7894" }}>
                Se non hai mai consultato le fatture serve prima l&apos;adesione al servizio di consultazione, nella stessa pagina. Lo zip te lo può mandare anche il commercialista.
              </p>
            </details>
          </Row>
          {uploads.map((upload) => (
            <Row key={upload.id}>
              <Line
                left={upload.fileName}
                right={new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "Europe/Rome" }).format(upload.createdAt)}
                muted
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12.5, color: "#7c7894" }}>
                  {upload.imported} caricate{upload.duplicates ? ` · ${upload.duplicates} già presenti` : ""}
                  {upload.skipped ? ` · ${upload.skipped} escluse` : ""}
                  {upload.failed ? ` · ${upload.failed} non lette` : ""}
                </span>
                {upload.imported ? (
                  <ActionForm action={deleteUploadAction} success="Caricamento tolto">
                    <input type="hidden" name="uploadId" value={upload.id} />
                    <PendingButton type="submit" aria-label="Togli caricamento" style={{ ...softButton, minHeight: 28, padding: "3px 10px", fontSize: 12 }}>
                      Togli
                    </PendingButton>
                  </ActionForm>
                ) : null}
              </div>
            </Row>
          ))}
        </RowsCard>
      </section>

      <Accountants list={accountants} />

      {/* Only the zip for now (29 Oct 2026): automatic receiving shows once Workbit turns it on. */}
      {inboxAvailable() || (settings?.invoiceInboxStatus ?? "OFF") !== "OFF" ? (
        <Inbox
          status={settings?.invoiceInboxStatus ?? "OFF"}
          since={settings?.invoiceInboxSince ?? null}
          syncedAt={settings?.invoiceInboxSyncedAt ?? null}
          available={inboxAvailable()}
          hasVat={Boolean(bar?.vatNumber || bar?.mainBar?.vatNumber)}
        />
      ) : null}
    </div>
  );
}

function MonthChips({ report }: { report: CostReport }) {
  return (
    <nav aria-label="Mese" style={{ display: "flex", gap: 6, overflowX: "auto", padding: "0 2px 2px", scrollbarWidth: "none" }}>
      {report.availableMonths.slice(0, 13).map((month) => {
        const active = month === report.month;
        const [year, mon] = month.split("-").map(Number);
        const label = new Intl.DateTimeFormat("it-IT", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, mon - 1, 1)));
        return (
          <Link
            key={month}
            href={`/dashboard/costi?month=${month}`}
            aria-current={active ? "page" : undefined}
            style={{
              flex: "0 0 auto",
              padding: "7px 13px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 720,
              textDecoration: "none",
              background: active ? "#4c1d95" : "#ffffff",
              color: active ? "#ffffff" : "#4b4763",
              border: active ? "1px solid #4c1d95" : "1px solid #e9e6f5",
            }}
          >
            {label} {String(year).slice(2)}
          </Link>
        );
      })}
    </nav>
  );
}

function Summary({ report, company }: { report: CostReport; company: boolean }) {
  const revenue = report.revenueCents;
  const ratio = (cents: number) => (revenue ? `${((cents / revenue) * 100).toLocaleString("it-IT", { maximumFractionDigits: 0 })}% degli incassi` : null);
  const laborCents = report.labor?.cents ?? 0;

  return (
    <section style={{ display: "grid", gap: 8 }}>
      <RowsCard>
        <Row first style={{ gap: 2, padding: "16px 15px" }}>
          <span style={{ fontSize: 12.5, color: "#7c7894" }}>Fornitori, IVA esclusa · {report.invoiceCount} fatture</span>
          <span style={{ fontSize: 30, fontWeight: 850, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>
            {euro(report.suppliersCents)}
            <Delta value={change(report.suppliersCents, report.previousSuppliersCents)} />
          </span>
          {report.previousSuppliersCents !== null ? (
            <span style={{ fontSize: 12.5, color: "#7c7894" }}>
              Mese prima {euro(report.previousSuppliersCents)}
              {report.averageSuppliersCents !== null ? ` · media ${euro(report.averageSuppliersCents)}` : ""}
            </span>
          ) : null}
        </Row>
        <Row>
          <Line left={<><Dot color="#16a34a" />{company ? "Merce e materiali" : "Merce (cibo e bevande)"}</>} right={euro(report.merceCents)} />
          {ratio(report.merceCents) ? <Line muted left={ratio(report.merceCents)} /> : null}
        </Row>
        <Row>
          <Line left={<><Dot color="#94a3b8" />Altre spese</>} right={euro(report.speseCents)} />
        </Row>
        <Row>
          {report.labor ? (
            <>
              <Line
                left={<><Dot color="#0ea5e9" />Personale</>}
                right={
                  <>
                    {euro(laborCents)}
                    <Delta value={change(laborCents, report.labor.previousCents)} />
                  </>
                }
              />
              <Line
                muted
                left={`${report.labor.hours.toLocaleString("it-IT", { maximumFractionDigits: 0 })} ore timbrate × costo orario${ratio(laborCents) ? ` · ${ratio(laborCents)}` : ""}`}
              />
              {report.labor.missingRates ? (
                <Line muted left={<Link href="/dashboard/people" style={{ color: "#b45309" }}>{report.labor.missingRates} persone senza costo orario: aggiungilo in Persone ›</Link>} />
              ) : null}
            </>
          ) : (
            <Line left={<><Dot color="#0ea5e9" />Personale</>} right={<span style={{ color: "#7c7894" }}>nessuna ora timbrata</span>} />
          )}
        </Row>
        <Row>
          <ActionForm
            key={`${report.month}-${revenue ?? ""}`}
            action={saveRevenueAction}
            success="Incasso salvato"
            style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}
          >
            <input type="hidden" name="month" value={report.month} />
            <label style={{ fontSize: 14.5, display: "flex", alignItems: "center", minWidth: 0 }}>
              <Dot color="#6d5ce7" />
              Incassi del mese
            </label>
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                name="amount"
                inputMode="decimal"
                placeholder="€"
                defaultValue={revenue !== null ? String(revenue / 100).replace(".", ",") : ""}
                aria-label="Incassi del mese in euro"
                style={{ width: 110, minHeight: 36, borderRadius: 12, border: "1px solid #e9e6f5", padding: "0 10px", fontSize: 15, textAlign: "right" }}
              />
              <PendingButton type="submit" style={{ ...softButton, minHeight: 36 }} pendingLabel="…">
                Salva
              </PendingButton>
            </span>
          </ActionForm>
          {revenue && report.labor ? (
            <Line
              muted
              left={`Merce + personale: ${(((report.merceCents + laborCents) / revenue) * 100).toLocaleString("it-IT", { maximumFractionDigits: 0 })}% degli incassi`}
            />
          ) : !revenue ? (
            <Line muted left="Scrivi l'incasso per vedere quanto pesano merce e personale." />
          ) : null}
        </Row>
      </RowsCard>
    </section>
  );
}

const signedEuro = (cents: number) => `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${euro(Math.abs(cents))}`;
const quantityText = (value: number, unit: string) => `${value.toLocaleString("it-IT", { maximumFractionDigits: 1 })} ${BASE_UNIT_LABEL[unit] ?? unit}`;
const pctSigned = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`;
const pctText = (now: number | null, before: number | null) => {
  if (now === null || before === null || before <= 0) return null;
  const value = (now / before - 1) * 100;
  if (Math.abs(value) < 0.5) return "uguale";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`;
};

/** The way into the payment schedule, with what needs a look. */
function PaymentsLink({ schedule }: { schedule: Awaited<ReturnType<typeof buildSchedule>> }) {
  const count = (status: string) => schedule.items.filter((item) => item.status === status).length;
  const overdue = count("overdue");
  const confirm = count("confirm");
  const soon = schedule.weeks.reduce((sum, week) => sum + week.manualCents + week.automaticCents, 0);
  return (
    <RowsCard>
      <Row first href="/dashboard/costi/pagamenti" rail={overdue ? "amber" : undefined} style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span aria-hidden style={{ width: 26, fontSize: 19, textAlign: "center" }}>📅</span>
        <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
          <span style={{ fontSize: 15 }}>Pagamenti ai fornitori</span>
          <span style={{ fontSize: 12.5, color: overdue ? "#b3202f" : "#7c7894" }}>
            {[overdue ? `${overdue} scadute` : null, confirm ? `${confirm} da confermare` : null, `${euro(soon)} nelle prossime 4 settimane`].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span aria-hidden style={{ color: "#c4c0d6", fontSize: 18 }}>›</span>
      </Row>
    </RowsCard>
  );
}

/** Where the venue pays more than the other clients of Workbit: first, because it is what the owner acts on. */
function Colleagues({ report }: { report: CostReport }) {
  const compared = report.productTrends.filter((item) => item.peers && item.unitPrice !== null);
  const dearer = compared
    .map((item) => ({ item, gap: (item.unitPrice! / item.peers!.average - 1) * 100, yearly: Math.round((item.unitPrice! - item.peers!.average) * (item.quantity ?? 0) * 12 * 100) }))
    .filter((entry) => entry.gap > 3)
    .sort((a, b) => b.yearly - a.yearly);
  return (
    <RowsCard title="Tu e i colleghi su Workbit" aside={compared.length ? `${compared.length} prodotti a confronto` : null}>
      {dearer.length ? (
        dearer.slice(0, 5).map(({ item, gap, yearly }, index) => (
          <Row key={`${item.productKey}-${item.unit}`} first={index === 0} href={`/dashboard/costi/perche?month=${report.month}&tipo=prezzi`} rail="amber">
            <Line left={<b style={{ fontWeight: 650 }}>{item.label}</b>} right={<b style={{ color: "#b3202f" }}>+{gap.toLocaleString("it-IT", { maximumFractionDigits: 0 })}%</b>} />
            <Line
              muted
              left={`Tu ${unitPrice(item.unitPrice, item.unit)} · media ${unitPrice(item.peers!.average, item.unit)} · i migliori ${unitPrice(item.peers!.best, item.unit)}${yearly > 0 ? ` · ${euro(yearly)} l'anno` : ""}`}
            />
          </Row>
        ))
      ) : compared.length ? (
        <Row first rail="green">
          <Line left="Paghi come o meno dei colleghi su tutti i prodotti a confronto" />
          <Line muted left={`${compared.length} prodotti che comprano almeno 3 aziende su Workbit.`} />
        </Row>
      ) : (
        <Row first>
          <Line left="Il confronto con le altre aziende si accende da solo" />
          <Line muted left="Appena almeno 3 aziende su Workbit comprano lo stesso prodotto: vedi la media e i prezzi migliori, mai chi sono." />
        </Row>
      )}
    </RowsCard>
  );
}

/** Why the month moved, in one card: bought more or less, paid more or less for the same things. */
function MonthStory({ report }: { report: CostReport }) {
  const story = report.monthStory;
  if (!story) return null;
  const previousLabel = monthLabel(shiftMonth(report.month, -1)).split(" ")[0];
  const parts = [
    { label: "I prezzi sono cambiati", cents: story.priceCents, hint: "stesse quantità, prezzo diverso: tocca per vedere dove", tipo: "prezzi" },
    { label: "Hai comprato di più o di meno", cents: story.quantityCents, hint: "stesse cose, quantità diverse, ai prezzi del mese prima", tipo: "quantita" },
    { label: "Cose nuove questo mese", cents: story.newCents, hint: `non comprate a ${previousLabel}`, tipo: "nuovi" },
    { label: "Cose non ricomprate", cents: -story.goneCents, hint: `comprate solo a ${previousLabel}`, tipo: "tolti" },
  ].filter((part) => Math.abs(part.cents) >= 100);
  return (
    <RowsCard title="Com'è andato il mese" aside={`rispetto a ${previousLabel}`}>
      <Row first>
        <Line left={story.deltaCents >= 0 ? "Hai speso di più" : "Hai speso di meno"} right={<b style={{ color: story.deltaCents > 0 ? "#b3202f" : "#0f7a4f" }}>{signedEuro(story.deltaCents)}</b>} />
      </Row>
      {parts.map((part) => (
        <Row key={part.label} href={`/dashboard/costi/perche?month=${report.month}&tipo=${part.tipo}`}>
          <Line left={<span style={{ color: "#4c1d95", fontWeight: 650 }}>{part.label} ›</span>} right={<b style={{ color: part.cents > 0 ? "#b3202f" : "#0f7a4f" }}>{signedEuro(part.cents)}</b>} />
          <Line muted left={part.hint} />
        </Row>
      ))}
    </RowsCard>
  );
}

/** Product by product: how much, at what price, against last month, two months back and a year back. */
function ProductTrends({ report }: { report: CostReport }) {
  const items = report.productTrends.filter((item) => item.cents > 0 || item.previousCents > 0);
  if (!items.length) return null;
  const row = (item: CostReport["productTrends"][number], index: number) => {
    const qtyDelta = item.quantity !== null && item.previousQuantity !== null ? item.quantity - item.previousQuantity : null;
    const prices = [
      pctText(item.unitPrice, item.previousUnitPrice) ? `${pctText(item.unitPrice, item.previousUnitPrice)} sul mese prima` : null,
      pctText(item.unitPrice, item.twoMonthsUnitPrice) ? `${pctText(item.unitPrice, item.twoMonthsUnitPrice)} su due mesi fa` : null,
      pctText(item.unitPrice, item.lastYearUnitPrice) ? `${pctText(item.unitPrice, item.lastYearUnitPrice)} su un anno fa` : null,
    ].filter(Boolean);
    const up = item.unitPrice !== null && item.previousUnitPrice !== null && item.unitPrice > item.previousUnitPrice * 1.005;
    return (
      <Row key={`${item.productKey}-${item.unit}`} first={index === 0}>
        <Line left={item.label} right={<>{euro(item.cents)}<Delta value={change(item.cents, item.previousCents || null)} /></>} />
        <Line
          muted
          left={
            item.cents === 0
              ? "non ricomprato questo mese"
              : item.quantity !== null
                ? `${quantityText(item.quantity, item.unit)}${qtyDelta !== null && Math.abs(qtyDelta) >= 0.05 ? ` (${qtyDelta > 0 ? "+" : "−"}${quantityText(Math.abs(qtyDelta), item.unit)})` : item.previousQuantity === null ? " · nuovo" : " · come il mese prima"}${item.unitPrice !== null ? ` · ${unitPrice(item.unitPrice, item.unit)}` : ""}`
                : "quantità non leggibile dalla fattura"
          }
        />
        {prices.length ? <Line muted left={<span style={{ color: up ? "#b3202f" : "#0f7a4f" }}>Prezzo {prices.join(" · ")}</span>} /> : null}
        {item.peers && item.unitPrice !== null ? (
          <Line
            muted
            left={
              <span style={{ color: item.unitPrice > item.peers.average * 1.03 ? "#b3202f" : item.unitPrice < item.peers.average * 0.97 ? "#0f7a4f" : "#7c7894" }}>
                👥 Colleghi su Workbit: media {unitPrice(item.peers.average, item.unit)}, i migliori {unitPrice(item.peers.best, item.unit)}
              </span>
            }
          />
        ) : null}
        {item.market ? (
          <Line
            muted
            left={
              <span style={{ color: item.market.productPct - item.market.marketPct >= 3 ? "#b3202f" : "#7c7894" }}>
                Mercato {item.market.label.toLowerCase()}: {pctSigned(item.market.marketPct)} in {item.market.months === 1 ? "un mese" : `${item.market.months} mesi`}, il tuo prezzo {pctSigned(item.market.productPct)}
              </span>
            }
          />
        ) : null}
      </Row>
    );
  };
  return (
    <RowsCard title="Prodotto per prodotto" aside="quanto, a che prezzo, contro prima">
      {items.slice(0, 8).map(row)}
      {items.length > 8 ? (
        <Row>
          <details>
            <summary style={{ cursor: "pointer", fontSize: 13.5, color: "#5e4ae3", fontWeight: 650 }}>Tutti i prodotti ({items.length})</summary>
            <div style={{ display: "grid" }}>{items.slice(8).map((item, index) => row(item, index + 1))}</div>
          </details>
        </Row>
      ) : null}
    </RowsCard>
  );
}

function Savings({ report, ai }: { report: CostReport; ai: boolean }) {
  const total = report.savings.reduce((sum, tip) => sum + (tip.yearlyCents ?? 0), 0);
  return (
    <section style={{ display: "grid", gap: 8 }}>
      <RowsCard title="Dove puoi risparmiare" aside={total ? `fino a ${euro(total)} l'anno` : null}>
        {report.savings.length ? (
          report.savings.map((tip, index) => (
            <Row key={tip.id} first={index === 0} rail={tip.confidence === "sicuro" ? "amber" : "grey"}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <span style={{ fontSize: 14.5, minWidth: 0 }}>{tip.title}</span>
                {tip.yearlyCents ? (
                  <span style={{ flex: "0 0 auto", fontSize: 14, fontWeight: 760, color: "#0f7a4f" }}>{euro(tip.yearlyCents)}/anno</span>
                ) : null}
              </div>
              <span style={{ fontSize: 13, color: "#4b4763", lineHeight: 1.45 }}>{tip.detail}</span>
              <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
                <Pill tone={tip.confidence === "sicuro" ? "amber" : "grey"}>
                  {tip.confidence === "sicuro" ? "Dalle tue fatture" : "Prezzo trovato online · da verificare"}
                </Pill>
                {tip.link ? (
                  <a href={tip.link.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#5e4ae3" }}>
                    {tip.link.label} ↗
                  </a>
                ) : null}
              </span>
            </Row>
          ))
        ) : (
          <Row first>
            <Line
              muted
              left={
                report.availableMonths.length < 2
                  ? `Con un solo mese caricato non c'è ancora un confronto: carica anche i mesi prima per vedere i prezzi che salgono e i fornitori più cari.${ai ? " Intanto puoi cercare online i prodotti qui sotto." : ""}`
                  : `Nessun aumento o differenza di prezzo che valga più di 30 € l'anno.${ai ? " Prova a cercare online i prodotti che pesano di più." : ""}`
              }
            />
          </Row>
        )}
      </RowsCard>
    </section>
  );
}

function Categories({ report }: { report: CostReport }) {
  const max = Math.max(1, ...report.categories.map((category) => category.cents));
  return (
    <section style={{ display: "grid", gap: 8 }}>
      <RowsCard title="Per categoria" aside="rispetto alla media dei mesi prima">
        {report.categories.map((category, index) => (
          <Row key={category.key} first={index === 0} href={`/dashboard/costi/fatture?month=${report.month}&categoria=${category.key}`}>
            <Line
              left={<><Dot color={category.color} />{category.label}</>}
              right={
                <>
                  {euro(category.cents)}
                  <Delta value={change(category.cents, category.averageCents)} />
                </>
              }
            />
            <Bar share={(category.cents / max) * 100} color={category.color} />
          </Row>
        ))}
      </RowsCard>
    </section>
  );
}

function Suppliers({ report }: { report: CostReport }) {
  return (
    <section style={{ display: "grid", gap: 8 }}>
      <RowsCard title="Fornitori" aside={`${report.suppliers.length} nel mese`}>
        {report.suppliers.slice(0, 10).map((supplier, index) => (
          <Row key={supplier.key} first={index === 0} href={`/dashboard/costi/fatture?month=${report.month}&fornitore=${encodeURIComponent(supplier.key)}`}>
            <Line
              left={supplier.name}
              right={
                <>
                  {euro(supplier.cents)}
                  <Delta value={change(supplier.cents, supplier.previousCents || null)} />
                </>
              }
            />
            <Line muted left={`${supplier.invoices} ${supplier.invoices === 1 ? "fattura" : "fatture"}`} />
          </Row>
        ))}
      </RowsCard>
    </section>
  );
}

function PriceChanges({ report }: { report: CostReport }) {
  if (!report.priceChanges.length) return null;
  return (
    <section style={{ display: "grid", gap: 8 }}>
      <RowsCard title="Prezzi che cambiano" aside="prezzo per unità, ultimi 6 mesi">
        {report.priceChanges.map((item, index) => (
          <Row key={`${item.productKey}-${item.supplier}`} first={index === 0} rail={item.changePct > 0 ? "amber" : "green"}>
            <Line
              left={item.label}
              right={<span style={{ color: item.changePct > 0 ? "#b3202f" : "#0f7a4f", fontWeight: 700 }}>{`${item.changePct > 0 ? "+" : ""}${item.changePct.toFixed(0)}%`}</span>}
            />
            <Line muted left={`${item.supplier} · ${unitPrice(item.previousUnitPrice, item.unit)} → ${unitPrice(item.unitPrice, item.unit)}`} />
          </Row>
        ))}
      </RowsCard>
    </section>
  );
}

async function Products({ barId, report, ai }: { barId: string; report: CostReport; ai: boolean }) {
  if (!report.topProducts.length) return null;
  const checks = await prisma.priceCheck.findMany({
    where: { barId, productKey: { in: report.topProducts.map((product) => product.productKey) } },
    orderBy: { checkedAt: "desc" },
    take: 60,
  });
  return (
    <section style={{ display: "grid", gap: 8 }}>
      <RowsCard title="Prodotti" aside="la merce che pesa di più">
        {report.topProducts.map((product, index) => {
          const check = checks.find((item) => item.productKey === product.productKey);
          const offers = (Array.isArray(check?.offers) ? check.offers : []) as Array<{ title?: string; seller?: string; url?: string; unitPrice?: number; sameProduct?: boolean; conditions?: string }>;
          return (
            <Row key={`${product.productKey}-${product.unit}`} first={index === 0}>
              <Line left={product.label} right={euro(product.cents)} />
              <Line
                muted
                left={product.unitPrice ? `${unitPrice(product.unitPrice, product.unit)}${product.quantity ? ` · ${product.quantity.toLocaleString("it-IT", { maximumFractionDigits: 1 })} ${BASE_UNIT_LABEL[product.unit] ?? product.unit} nel mese` : ""}` : "quantità non leggibile dalla fattura"}
              />
              {check ? (
                <details>
                  <summary style={{ cursor: "pointer", fontSize: 12.5, color: "#5e4ae3" }}>
                    Online: {check.bestUnitPrice ? `da ${unitPrice(check.bestUnitPrice, check.baseUnit ?? product.unit)}` : "nessuna offerta uguale"} ·{" "}
                    {new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(check.checkedAt)}
                  </summary>
                  <div style={{ display: "grid", gap: 6, marginTop: 6, fontSize: 12.5, color: "#4b4763" }}>
                    {check.summary ? <span>{check.summary}</span> : null}
                    {offers.map((offer) => (
                      <a key={offer.url} href={offer.url} target="_blank" rel="noopener noreferrer" style={{ color: "#17161f", textDecoration: "none", display: "grid", gap: 1 }}>
                        <span>
                          {offer.seller}: {offer.unitPrice ? unitPrice(offer.unitPrice, check.baseUnit ?? product.unit) : ""}
                          {offer.sameProduct === false ? " (simile)" : ""} ↗
                        </span>
                        <span style={{ color: "#7c7894" }}>{[offer.title, offer.conditions].filter(Boolean).join(" · ")}</span>
                      </a>
                    ))}
                  </div>
                </details>
              ) : null}
              {ai ? (
                <ActionForm action={priceCheckAction} success="Ricerca fatta" style={{ marginTop: 4 }}>
                  <input type="hidden" name="productKey" value={product.productKey} />
                  <input type="hidden" name="month" value={report.month} />
                  <PendingButton type="submit" style={{ ...softButton, minHeight: 30, fontSize: 12.5 }} pendingLabel="Cerco online… (fino a un minuto)">
                    {check ? "Cerca di nuovo online" : "Cerca il prezzo online"}
                  </PendingButton>
                </ActionForm>
              ) : null}
            </Row>
          );
        })}
      </RowsCard>
    </section>
  );
}

async function Energy({ barId, report, ai }: { barId: string; report: CostReport; ai: boolean }) {
  if (!report.energy) return null;
  const energy = report.energy;
  const check = await prisma.priceCheck.findFirst({ where: { barId, productKey: "energia-elettrica" }, orderBy: { checkedAt: "desc" } });
  return (
    <section style={{ display: "grid", gap: 8 }}>
      <RowsCard title="Luce" aside="stima dalle bollette del mese">
        <Row first>
          <Line left={<><Dot color="#f59e0b" />Costo per kWh, tutto compreso</>} right={unitPrice(energy.unitCost, "kwh")} />
          <Line
            muted
            left={`${Math.round(energy.kwh).toLocaleString("it-IT")} kWh · ${euro(Math.round(energy.cents))}${energy.previousUnitCost ? ` · mesi prima ${unitPrice(energy.previousUnitCost, "kwh")}` : ""}`}
          />
        </Row>
        {energy.componentUnitCost ? (
          <Row>
            <Line left="Solo la parte energia (quella che cambia tra fornitori)" right={unitPrice(energy.componentUnitCost, "kwh")} />
            {check ? (
              <Line muted left={`Online: ${check.bestUnitPrice ? `da ${unitPrice(check.bestUnitPrice, "kwh")}` : "niente di confrontabile"}${check.summary ? ` · ${check.summary}` : ""}`} />
            ) : null}
            {ai ? (
              <ActionForm action={priceCheckAction} success="Ricerca fatta" style={{ marginTop: 4 }}>
                <input type="hidden" name="productKey" value="energia-elettrica" />
                <input type="hidden" name="month" value={report.month} />
                <PendingButton type="submit" style={{ ...softButton, minHeight: 30, fontSize: 12.5 }} pendingLabel="Cerco offerte…">
                  Cerca offerte luce per partita IVA
                </PendingButton>
              </ActionForm>
            ) : null}
          </Row>
        ) : null}
      </RowsCard>
    </section>
  );
}

/** Who downloads the supplier invoices: one email per accountant, who sees all their client venues together. */
function Accountants({ list }: { list: { id: string; email: string; name: string | null }[] }) {
  return (
    <RowsCard
      title="Commercialista"
      aside={
        <PopupAction title="Aggiungi il commercialista" ariaLabel="Aggiungi il commercialista">
          <ActionForm action={addAccountantAction} success="Accesso dato: gli abbiamo scritto" style={{ display: "grid", gap: 14 }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#4b4763" }}>
              Entra con la sua email e un codice, senza password, e scarica le fatture dei fornitori mese per mese. Se segue altri locali su Workbit, li vede tutti nella stessa pagina. Non vede nient&apos;altro del locale.
            </p>
            <FormField label="Email">
              <TextInput name="email" type="email" required placeholder="studio@esempio.it" />
            </FormField>
            <FormField label="Nome">
              <TextInput name="name" placeholder="Facoltativo: Studio Rossi" />
            </FormField>
            <div className="dashboard-form-actions">
              <PrimaryButton type="submit">Dai accesso</PrimaryButton>
            </div>
          </ActionForm>
        </PopupAction>
      }
    >
      {list.length === 0 ? (
        <Row first>
          <Line muted left="Dai al commercialista l'accesso alle fatture: le scarica da solo, in uno zip al mese." />
        </Row>
      ) : (
        list.map((access, index) => (
          <Row key={access.id} first={index === 0} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
              <span style={{ fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis" }}>{access.name || access.email}</span>
              {access.name ? <span style={{ fontSize: 12.5, color: "#7c7894", overflow: "hidden", textOverflow: "ellipsis" }}>{access.email}</span> : null}
            </span>
            <ActionForm action={removeAccountantAction} success="Accesso tolto">
              <input type="hidden" name="accessId" value={access.id} />
              <PendingButton type="submit" style={{ ...softButton, background: "#ffffff", color: "#7c7894", borderColor: "#e9e6f5" }} pendingLabel="…">
                Togli
              </PendingButton>
            </ActionForm>
          </Row>
        ))
      )}
      <Row>
        <Line muted left="Lui entra da app.workbit.it/commercialista. A inizio mese gli scriviamo che le fatture sono pronte." />
      </Row>
    </RowsCard>
  );
}

function Inbox({
  status,
  since,
  syncedAt,
  available,
  hasVat,
}: {
  status: string;
  since: Date | null;
  syncedAt: Date | null;
  available: boolean;
  hasVat: boolean;
}) {
  const date = (value: Date | null) => (value ? new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(value) : "");
  return (
    <section style={{ display: "grid", gap: 8 }}>
      <RowsCard title="Ricezione automatica" aside={status === "ACTIVE" ? <Pill tone="green">Attiva</Pill> : status === "WAITING" ? <Pill tone="amber">Da completare</Pill> : null}>
        {status === "OFF" ? (
          <Row first>
            <Line left="Le fatture arrivano da sole, senza caricare lo zip" />
            <span style={{ fontSize: 13, color: "#4b4763", lineHeight: 1.45 }}>
              Dai al Sistema di Interscambio il codice destinatario di Openapi, il servizio che Workbit usa per le fatture elettroniche: ogni fattura dei fornitori arriva qui appena emessa. Restano comunque nel cassetto fiscale, dove il commercialista continua a vederle.
            </span>
            {!available ? (
              <Line muted left="In arrivo: la stiamo attivando su Workbit." />
            ) : !hasVat ? (
              <Line muted left={<Link href="/dashboard/settings" style={{ color: "#b45309" }}>Serve la partita IVA del locale: aggiungila in Impostazioni ›</Link>} />
            ) : (
              <ActionForm action={activateInboxAction} success="Ricezione preparata: ora imposta il codice" style={{ marginTop: 4 }}>
                <PendingButton type="submit" style={softButton} pendingLabel="Attivo…">
                  Attiva la ricezione
                </PendingButton>
              </ActionForm>
            )}
          </Row>
        ) : (
          <>
            <Row first rail={status === "WAITING" ? "amber" : "green"}>
              <Line left={status === "WAITING" ? "Ultimo passo: il codice all'Agenzia delle Entrate" : "Le fatture arrivano da sole"} right={status === "ACTIVE" ? date(syncedAt) : undefined} />
              {status === "WAITING" ? (
                <ol style={{ margin: "4px 0 0", paddingLeft: 20, fontSize: 13, color: "#4b4763", display: "grid", gap: 4 }}>
                  <li>Avvisa il commercialista: se riceve le fatture con un suo codice, da ora le scarica qui sopra con il suo accesso, o dal cassetto fiscale.</li>
                  <li>In Fatture e Corrispettivi apri Registrazione dell&apos;indirizzo telematico.</li>
                  <li>
                    Scegli Codice destinatario e scrivi <strong style={{ letterSpacing: "0.08em" }}>{OPENAPI_RECIPIENT_CODE}</strong>, poi conferma.
                  </li>
                  <li>Dalla prima fattura emessa dopo, la trovi qui. Attivata il {date(since)}.</li>
                </ol>
              ) : null}
              <span style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                <ActionForm action={syncInboxAction} success="Controllato">
                  <PendingButton type="submit" style={softButton} pendingLabel="Controllo…">
                    Controlla ora
                  </PendingButton>
                </ActionForm>
                <ActionForm action={deactivateInboxAction} success="Ricezione disattivata">
                  <PendingButton type="submit" style={{ ...softButton, background: "#ffffff", color: "#7c7894", borderColor: "#e9e6f5" }} pendingLabel="…">
                    Disattiva
                  </PendingButton>
                </ActionForm>
              </span>
              <Line muted left="Per smettere, prima rimetti all'Agenzia il codice di prima (o togli la registrazione), poi disattiva qui." />
            </Row>
          </>
        )}
      </RowsCard>
    </section>
  );
}
