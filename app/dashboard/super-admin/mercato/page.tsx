import Link from "next/link";
import { MARKET_INDEXES, type MarketIndex } from "@/lib/costs/market";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../../context";
import { ConsoleButton, ConsoleForm } from "../console-form";
import { Field, FieldGrid, Forbidden, Note, Section } from "../console-ui";
import { saveMarketPricesAction, searchMarketAction } from "./actions";

export const dynamic = "force-dynamic";

const SECTORS: Array<{ key: MarketIndex["sector"]; title: string }> = [
  { key: "company", title: "Aziende" },
  { key: "restaurant", title: "Ristorazione" },
  { key: "all", title: "Per tutti" },
];

function shift(month: string, delta: number) {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, mon - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

const label = (month: string) =>
  new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
const number = (value: number | undefined) => (value === undefined ? "" : value.toLocaleString("it-IT", { maximumFractionDigits: 4, useGrouping: false }));

/**
 * The market values Workbit types in once a month, from free public sources.
 * Clients see them next to what their suppliers charge.
 */
export default async function MarketPricesPage({ searchParams }: { searchParams: Promise<{ mese?: string }> }) {
  const { role } = await getDashboardContext();
  if (String(role) !== "SUPER_ADMIN") return <Forbidden />;

  const { mese } = await searchParams;
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const month = mese && /^\d{4}-(0[1-9]|1[0-2])$/.test(mese) ? mese : shift(current, -1);
  const months = [shift(month, -3), shift(month, -2), shift(month, -1), month];
  const rows = await prisma.marketPrice.findMany({
    where: { barId: null, month: { in: months } },
    select: { indexKey: true, month: true, value: true, status: true, foundUrl: true, note: true },
  });
  const confirmed = (key: string, at: string) => rows.find((row) => row.indexKey === key && row.month === at && row.status === "confirmed");
  const proposal = (key: string, at: string) => rows.find((row) => row.indexKey === key && row.month === at && row.status === "proposed");
  const value = (key: string, at: string) => confirmed(key, at)?.value;
  const filled = MARKET_INDEXES.filter((index) => value(index.key, month) !== undefined).length;
  const proposals = MARKET_INDEXES.filter((index) => !confirmed(index.key, month) && proposal(index.key, month)).length;

  return (
    <div className="wbc-page">
      <div className="wbc-page-head">
        <h1 className="wbc-title">Prezzi di mercato</h1>
        <p className="wbc-desc">
          Un valore al mese per ogni indice, dalle fonti pubbliche indicate. I clienti vedono la variazione accanto ai prezzi dei loro fornitori: conta il cambiamento,
          quindi un indice va bene quanto un prezzo, purché sia sempre la stessa voce.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Link className="wbc-btn wbc-btn-sm" href={`/dashboard/super-admin/mercato?mese=${shift(month, -1)}`}>
          ‹ {label(shift(month, -1))}
        </Link>
        <strong style={{ textTransform: "capitalize" }}>{label(month)}</strong>
        <span style={{ color: "#8b88a3" }}>
          {filled} di {MARKET_INDEXES.length} inseriti
        </span>
        <Link className="wbc-btn wbc-btn-sm" href={`/dashboard/super-admin/mercato?mese=${shift(month, 1)}`}>
          {label(shift(month, 1))} ›
        </Link>
        <ConsoleButton
          action={searchMarketAction}
          fields={{ month }}
          label="🔎 Cerca online i mancanti"
          pendingLabel="Avvio…"
          className="wbc-btn wbc-btn-sm"
        />
      </div>
      {proposals ? (
        <Note tone="warning">
          {proposals} valori trovati online e già scritti nei riquadri: controlla il link di ognuno e premi Salva per confermarli. Finché non li salvi, i clienti non li vedono.
        </Note>
      ) : null}

      <ConsoleForm action={saveMarketPricesAction} label={`Salva ${label(month)}`}>
        <input type="hidden" name="month" value={month} />
        {SECTORS.map((sector) => (
          <Section key={sector.key} title={sector.title}>
            <FieldGrid>
              {MARKET_INDEXES.filter((index) => index.sector === sector.key).map((index) => (
                <Field
                  key={index.key}
                  label={`${index.label} (${index.unit})`}
                  hint={`${index.hint} Mesi prima: ${months
                    .slice(0, 3)
                    .map((at) => number(value(index.key, at)) || "–")
                    .join(" · ")}. Fonte: ${index.source}, ${index.sourceUrl}`}
                >
                  <input
                    name={`value_${index.key}`}
                    defaultValue={number(value(index.key, month) ?? proposal(index.key, month)?.value)}
                    inputMode="decimal"
                    autoComplete="off"
                    style={!confirmed(index.key, month) && proposal(index.key, month) ? { borderColor: "#f59e0b", background: "#fffbeb" } : undefined}
                  />
                  {!confirmed(index.key, month) && proposal(index.key, month) ? (
                    <a href={proposal(index.key, month)!.foundUrl ?? "#"} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: "#b45309" }}>
                      🔎 Trovato online, da confermare: {proposal(index.key, month)!.note} ↗
                    </a>
                  ) : null}
                </Field>
              ))}
            </FieldGrid>
          </Section>
        ))}
      </ConsoleForm>
    </div>
  );
}
