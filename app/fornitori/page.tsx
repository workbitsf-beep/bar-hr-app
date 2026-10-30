import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSupplierEmail } from "@/lib/supplier/auth";
import { MixCard, mixPage, mixRow, PageHead } from "../dashboard/mix-ui";
import { signOutAction } from "./actions";
import { SupplierLogin } from "./login-form";
import { SupplierPanel } from "./supplier-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Portale fornitori · Workbit", description: "Pubblica il tuo listino prezzi su Workbit." };

const TERMS_URL = "/condizioni-fornitori";
const price = (value: number, unit: string) => `${value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 3 })} €/${unit === "pz" ? "pezzo" : unit === "l" ? "litro" : unit}`;

/**
 * Where a supplier publishes its price list: sign in with the email and a
 * code, the company's details and the terms, then the file. What Workbit
 * read is listed back, to be checked.
 */
export default async function SupplierPortalPage() {
  const email = await getSupplierEmail();
  const shell = (children: React.ReactNode) => (
    <main style={{ minHeight: "100dvh", background: "#f1eefb", padding: "32px 16px 48px" }}>
      <div style={{ ...mixPage, maxWidth: 600 }}>{children}</div>
    </main>
  );

  if (!email) {
    return shell(
      <>
        <PageHead title="Portale fornitori" />
        <MixCard>
          <p style={{ margin: "0 0 12px", fontSize: 14.5, lineHeight: 1.55, color: "#4c4670" }}>
            Pubblica il tuo listino su Workbit: lo mostriamo alle attività della tua zona che comprano i tuoi prodotti e oggi li pagano di più. Entri con la tua email e un codice,
            senza password. La prima volta crei così il tuo accesso.
          </p>
          <SupplierLogin />
        </MixCard>
        <p style={{ margin: 0, fontSize: 12.5, color: "#8a85a3", textAlign: "center" }}>
          Prima di pubblicare accetti le <a href={TERMS_URL}>condizioni per i fornitori</a>.
        </p>
      </>,
    );
  }

  const supplier = await prisma.supplier.findUniqueOrThrow({
    where: { email },
    select: { id: true, companyName: true, vatNumber: true, zone: true, categories: true, phone: true, termsAcceptedAt: true },
  });
  const rows = await prisma.supplierListPrice.findMany({
    where: { supplierId: supplier.id },
    orderBy: { productLabel: "asc" },
    select: { id: true, productLabel: true, description: true, unitPrice: true, baseUnit: true, validFrom: true },
    take: 500,
  });

  return shell(
    <>
      <PageHead
        title="Il tuo listino"
        actions={
          <form action={signOutAction}>
            <button type="submit" style={{ minHeight: 36, padding: "0 14px", borderRadius: 999, border: "1px solid #ddd6fe", background: "#ffffff", color: "#4c1d95", fontWeight: 700, cursor: "pointer" }}>
              Esci
            </button>
          </form>
        }
      />
      <p style={{ margin: "-4px 4px 0", fontSize: 13.5, color: "#667085" }}>{email}</p>
      <SupplierPanel
        supplier={{ ...supplier, termsAccepted: Boolean(supplier.termsAcceptedAt) }}
        termsUrl={TERMS_URL}
        hasList={rows.length > 0}
      />
      {rows.length ? (
        <MixCard title="Cosa abbiamo letto" aside={`${rows.length} prodotti`}>
          <div className="wb-mix-rows">
            {rows.map((row) => (
              <div key={row.id} style={{ ...mixRow, gap: 12, padding: "10px 0" }}>
                <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
                  <span style={{ fontSize: 15 }}>{row.productLabel}</span>
                  {row.description ? <span style={{ fontSize: 12.5, color: "#7c7894", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.description}</span> : null}
                </span>
                <b style={{ fontSize: 14.5, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{price(row.unitPrice, row.baseUnit)}</b>
              </div>
            ))}
          </div>
        </MixCard>
      ) : null}
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "#8a85a3", textAlign: "center" }}>
        Se un prezzo è letto male, ricarica il file in Excel o scrivici a supporto@workbit.it. I prezzi sono indicativi: le condizioni le concordi tu con il cliente.
      </p>
    </>,
  );
}
