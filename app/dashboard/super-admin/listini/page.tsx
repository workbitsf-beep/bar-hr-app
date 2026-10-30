import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../../context";
import { ConsoleButton } from "../console-form";
import { Empty, Forbidden, Row, Section } from "../console-ui";
import { deletePriceListAction } from "./actions";
import { PriceListUploader } from "./uploader";

export const dynamic = "force-dynamic";

const date = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * Suppliers' price lists: uploaded as they come (PDF, Excel), read by Claude,
 * compared with what every client pays for the same product.
 */
export default async function PriceListsPage() {
  const { role } = await getDashboardContext();
  if (String(role) !== "SUPER_ADMIN") return <Forbidden />;

  const lists = await prisma.supplierListPrice.groupBy({
    by: ["supplierName", "zone", "validFrom"],
    where: { barId: null },
    _count: { _all: true },
    orderBy: { supplierName: "asc" },
  });

  return (
    <div className="wbc-page">
      <div className="wbc-page-head">
        <h1 className="wbc-title">Listini fornitori</h1>
        <p className="wbc-desc">
          Carica il listino come arriva dal fornitore: Workbit lo legge da solo, porta ogni prodotto sotto lo stesso nome delle fatture e lo mostra ai clienti che lo pagano di
          più. Un nuovo listino dello stesso fornitore sostituisce il precedente.
        </p>
      </div>

      <Section title="Nuovo listino">
        <PriceListUploader />
      </Section>

      <Section title="Listini caricati" flush>
        {lists.length ? (
          lists.map((list) => (
            <Row
              key={`${list.supplierName}-${list.zone}-${list.validFrom.toISOString()}`}
              title={list.supplierName}
              meta={`${list._count._all} prodotti · ${list.zone ?? "zona non indicata"} · dal ${date.format(list.validFrom)}`}
              status={<ConsoleButton action={deletePriceListAction} fields={{ supplierName: list.supplierName }} label="Togli" confirm={`Togliere il listino di ${list.supplierName}?`} />}
            />
          ))
        ) : (
          <Empty>Nessun listino ancora.</Empty>
        )}
      </Section>
    </div>
  );
}
