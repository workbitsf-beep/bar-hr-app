import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Role } from "@prisma/client";
import { costsEnabledFor } from "@/lib/costs/access";
import { buildCostReport, monthLabel, shiftMonth, type ProductTrend } from "@/lib/costs/analysis";
import { BASE_UNIT_LABEL } from "@/lib/costs/categories";
import { BillingRequired } from "../../billing-required";
import { getDashboardContext } from "../../context";
import { EmptyState, Panel } from "../../ui";
import { PageHead } from "../../mix-ui";
import { euro, Line, Row, RowsCard } from "../cost-ui";

export const dynamic = "force-dynamic";

type Kind = "prezzi" | "quantita" | "nuovi" | "tolti";

const TITLES: Record<Kind, string> = {
  prezzi: "Dove i prezzi sono saliti",
  quantita: "Dove hai comprato di più",
  nuovi: "Cose nuove del mese",
  tolti: "Cose non ricomprate",
};

const price = (value: number | null, unit: string) =>
  value === null ? "–" : `${value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 3 })} €/${BASE_UNIT_LABEL[unit] ?? unit}`;
const pct = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`;
const signed = (cents: number) => `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${euro(Math.abs(cents))}`;
const qty = (value: number, unit: string) => `${value.toLocaleString("it-IT", { maximumFractionDigits: 1 })} ${BASE_UNIT_LABEL[unit] ?? unit}`;

function Compare({ icon, title, children, tone }: { icon: string; title: string; children: ReactNode; tone?: "bad" | "good" }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0" }}>
      <span aria-hidden style={{ width: 22, fontSize: 16, textAlign: "center", flex: "0 0 auto" }}>{icon}</span>
      <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 12.5, color: "#7c7894" }}>{title}</span>
        <span style={{ fontSize: 14, color: tone === "bad" ? "#b3202f" : tone === "good" ? "#0f7a4f" : "#17161f" }}>{children}</span>
      </span>
    </div>
  );
}

/** One product: what it cost, from whom, and every comparison there is. */
function ProductCard({ item, kind, tip }: { item: ProductTrend; kind: Kind; tip: string | null }) {
  const effect = kind === "prezzi" ? item.priceCents : kind === "quantita" ? item.quantityCents : kind === "nuovi" ? item.cents : -item.previousCents;
  const vsPeers = item.peers && item.unitPrice !== null ? (item.unitPrice / item.peers.average - 1) * 100 : null;
  return (
    <RowsCard title={item.label} aside={<b style={{ color: effect > 0 ? "#b3202f" : "#0f7a4f" }}>{signed(effect)}</b>}>
      <Row first>
        <Line
          left={
            item.unitPrice !== null
              ? `${price(item.unitPrice, item.unit)}${item.previousUnitPrice !== null ? ` (era ${price(item.previousUnitPrice, item.unit)})` : ""}`
              : "prezzo per unità non leggibile"
          }
          right={item.quantity ? qty(item.quantity, item.unit) : undefined}
        />
        {item.previousQuantity && item.quantity ? <Line muted left={`Il mese prima ${qty(item.previousQuantity, item.unit)} per ${euro(item.previousCents)}`} /> : null}
      </Row>

      {item.suppliers.length ? (
        <Row>
          {item.suppliers.map((supplier) => (
            <Line
              key={supplier.name}
              muted
              left={`🏭 ${supplier.name}`}
              right={`${price(supplier.unitPrice, item.unit)}${supplier.previousUnitPrice !== null && supplier.unitPrice !== null ? ` · ${pct((supplier.unitPrice / supplier.previousUnitPrice - 1) * 100)}` : ""}`}
            />
          ))}
        </Row>
      ) : null}

      <Row>
        {item.peers ? (
          <Compare icon="👥" title={`Colleghi su Workbit (${item.peers.venues} aziende)`} tone={vsPeers !== null && vsPeers > 3 ? "bad" : vsPeers !== null && vsPeers < -3 ? "good" : undefined}>
            Media {price(item.peers.average, item.unit)} · i migliori {price(item.peers.best, item.unit)}
            {vsPeers !== null ? ` · tu ${pct(vsPeers)} rispetto alla media` : ""}
          </Compare>
        ) : (
          <Compare icon="👥" title="Colleghi su Workbit">
            Ancora poche aziende comprano questo prodotto: il confronto compare da 3 in su.
          </Compare>
        )}
        {item.market ? (
          <Compare icon="📈" title={`Mercato · ${item.market.source}`} tone={item.market.productPct - item.market.marketPct >= 3 ? "bad" : undefined}>
            {item.market.label}: {pct(item.market.marketPct)} in {item.market.months === 1 ? "un mese" : `${item.market.months} mesi`}, il tuo prezzo {pct(item.market.productPct)}
          </Compare>
        ) : null}
        {item.bestOwnSupplier && item.unitPrice !== null && item.bestOwnSupplier.unitPrice < item.unitPrice * 0.98 ? (
          <Compare icon="🔁" title="Tra i tuoi fornitori" tone="good">
            Da {item.bestOwnSupplier.name} lo hai pagato {price(item.bestOwnSupplier.unitPrice, item.unit)} negli ultimi 6 mesi
          </Compare>
        ) : null}
        {item.listPrices.length ? (
          <Compare icon="📋" title="Listini dei fornitori" tone="good">
            {item.listPrices.map((list) => `${list.supplierName}${list.zone ? ` (${list.zone})` : ""} ${price(list.unitPrice, item.unit)}`).join(" · ")}
          </Compare>
        ) : null}
        {item.twoMonthsUnitPrice !== null || item.lastYearUnitPrice !== null ? (
          <Compare icon="🗓️" title="I tuoi mesi prima">
            {[item.twoMonthsUnitPrice !== null ? `due mesi fa ${price(item.twoMonthsUnitPrice, item.unit)}` : null, item.lastYearUnitPrice !== null ? `un anno fa ${price(item.lastYearUnitPrice, item.unit)}` : null]
              .filter(Boolean)
              .join(" · ")}
          </Compare>
        ) : null}
        {tip ? (
          <div style={{ marginTop: 6, padding: "10px 12px", borderRadius: 14, background: "#fff7ed", color: "#9a3412", fontSize: 13.5, lineHeight: 1.45 }}>💡 {tip}</div>
        ) : null}
      </Row>
    </RowsCard>
  );
}

/**
 * Behind each line of "Com'è andato il mese": the products that made it,
 * from which supplier, and every comparison there is for each.
 */
export default async function WhyPage({ searchParams }: { searchParams: Promise<{ month?: string; tipo?: string }> }) {
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

  const { month: requested, tipo } = await searchParams;
  const kind: Kind = tipo === "quantita" || tipo === "nuovi" || tipo === "tolti" ? tipo : "prezzi";
  const report = await buildCostReport(activeBarId, requested && /^\d{4}-\d{2}$/.test(requested) ? requested : null);
  if (!report) redirect("/dashboard/costi");

  const items = report!.productTrends
    .filter((item) =>
      kind === "prezzi" ? item.priceCents > 0 : kind === "quantita" ? item.quantityCents > 0 : kind === "nuovi" ? item.cents > 0 && item.previousCents === 0 : item.cents === 0 && item.previousCents > 0,
    )
    .sort((a, b) =>
      kind === "prezzi" ? b.priceCents - a.priceCents : kind === "quantita" ? b.quantityCents - a.quantityCents : kind === "nuovi" ? b.cents - a.cents : b.previousCents - a.previousCents,
    );
  const total = items.reduce((sum, item) => sum + (kind === "prezzi" ? item.priceCents : kind === "quantita" ? item.quantityCents : kind === "nuovi" ? item.cents : -item.previousCents), 0);
  const tipFor = (productKey: string) => report!.savings.find((tip) => tip.productKey === productKey)?.detail ?? null;
  const previousName = monthLabel(shiftMonth(report!.month, -1)).split(" ")[0];
  const tabs: Kind[] = ["prezzi", "quantita", "nuovi", "tolti"];

  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 760, margin: "0 auto", width: "100%", padding: "4px 4px 8px" }}>
      <Link href={`/dashboard/costi?month=${report!.month}`} style={{ fontSize: 15, fontWeight: 600, color: "#5e4ae3", textDecoration: "none", justifySelf: "start" }}>
        ‹ Costi
      </Link>
      <PageHead title={TITLES[kind]} />
      <nav style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {tabs.map((tab) => (
          <Link
            key={tab}
            href={`/dashboard/costi/perche?month=${report!.month}&tipo=${tab}`}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 13.5,
              fontWeight: 650,
              textDecoration: "none",
              border: "1px solid #ddd6fe",
              background: tab === kind ? "#4c1d95" : "#ffffff",
              color: tab === kind ? "#ffffff" : "#4c1d95",
            }}
          >
            {{ prezzi: "Prezzi", quantita: "Quantità", nuovi: "Nuovi", tolti: "Non ricomprati" }[tab]}
          </Link>
        ))}
      </nav>
      <p style={{ margin: 0, fontSize: 14, color: "#4b4763", lineHeight: 1.5, padding: "0 4px" }}>
        {monthLabel(report!.month)} contro {previousName}: <b>{signed(total)}</b>
        {kind === "prezzi" ? " perché le stesse cose costano di più." : kind === "quantita" ? " perché hai comprato di più, ai prezzi del mese prima." : "."} Sotto ogni prodotto: il fornitore, i colleghi su Workbit, il mercato e i listini.
      </p>
      {items.length ? (
        items.slice(0, 30).map((item) => <ProductCard key={`${item.productKey}-${item.unit}`} item={item} kind={kind} tip={tipFor(item.productKey)} />)
      ) : (
        <RowsCard>
          <Row first>
            <Line muted left="Niente da segnalare in questo mese." />
          </Row>
        </RowsCard>
      )}
    </div>
  );
}
