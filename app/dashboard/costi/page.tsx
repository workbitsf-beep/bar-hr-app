import Link from "next/link";
import { Role } from "@prisma/client";
import { ActionForm } from "@/app/components/action-form";
import { PendingButton } from "@/app/components/pending-button";
import { aiEnabled } from "@/lib/costs/ai";
import { buildCostReport, type CostReport } from "@/lib/costs/analysis";
import { BASE_UNIT_LABEL } from "@/lib/costs/categories";
import { inboxAvailable, OPENAPI_RECIPIENT_CODE } from "@/lib/costs/openapi-inbox";
import { costsEnabledFor } from "@/lib/costs/access";
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
  const { session, role, activeBarId, billingStatus } = await getDashboardContext();
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
  const ai = aiEnabled();

  return (
    <div className="wbcost" style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 760, margin: "0 auto", width: "100%" }}>
      <header style={{ display: "grid", gap: 2, padding: "0 4px" }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.05 }}>Costi</h1>
      </header>

      {report ? <MonthChips report={report} /> : null}

      {report ? (
        <>
          <Summary report={report} />
          <Savings report={report} ai={ai} />
          <Categories report={report} />
          <Suppliers report={report} />
          <PriceChanges report={report} />
          <Products barId={activeBarId} report={report} ai={ai} />
          <Energy barId={activeBarId} report={report} ai={ai} />
          {report.pendingLines ? (
            <RowsCard>
              <Row first rail="amber">
                <Line left={`${report.pendingLines} righe da classificare`} right={<Link href={`/dashboard/costi/fatture?month=${report.month}&da=1`} style={{ color: "#6d5ce7" }}>Sistema ›</Link>} />
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
        <RowsCard title="Fatture" aside={report ? <Link href={`/dashboard/costi/fatture?month=${report.month}`} style={{ color: "#6d5ce7" }}>Tutte le fatture ›</Link> : null}>
          <Row first>
            <UploadPanel compact={Boolean(report)} allowAnyRecipient={String(session.user.role) === "SUPER_ADMIN"} />
            <details style={{ marginTop: 4 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, color: "#6d5ce7" }}>Come si scarica lo zip dal cassetto fiscale</summary>
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

function Summary({ report }: { report: CostReport }) {
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
          <Line left={<><Dot color="#16a34a" />Merce (cibo e bevande)</>} right={euro(report.merceCents)} />
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
                  <a href={tip.link.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#6d5ce7" }}>
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
                  <summary style={{ cursor: "pointer", fontSize: 12.5, color: "#6d5ce7" }}>
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
