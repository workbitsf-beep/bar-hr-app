import Link from "next/link";
import { Role, type Prisma } from "@prisma/client";
import { docTypeLabel } from "@/lib/costs/fattura";
import { categoryOf } from "@/lib/costs/categories";
import { monthLabel, shiftMonth } from "@/lib/costs/analysis";
import { costsEnabledFor } from "@/lib/costs/access";
import { prisma } from "@/lib/prisma";
import { BillingRequired } from "../../billing-required";
import { getDashboardContext } from "../../context";
import { EmptyState, Panel } from "../../ui";
import { CategorySelect } from "../category-select";
import { Dot, euro, Line, Row, RowsCard } from "../cost-ui";

export const dynamic = "force-dynamic";

const day = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });

/** The month's supplier invoices, or the lines of one category, each line's category editable. */
export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; categoria?: string; fornitore?: string; da?: string }>;
}) {
  const { session, role, activeBarId, billingStatus } = await getDashboardContext();
  if (!activeBarId) {
    return (
      <Panel title="Fatture">
        <EmptyState message="Seleziona un locale." />
      </Panel>
    );
  }
  if (billingStatus && !billingStatus.canAccess) return <BillingRequired role={String(role)} />;
  if (role !== Role.OWNER || !costsEnabledFor(session.user.role)) {
    return (
      <Panel title="Fatture">
        <EmptyState message="Le fatture dei fornitori le vede solo il titolare." />
      </Panel>
    );
  }

  const params = await searchParams;
  const month = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : new Date().toISOString().slice(0, 7);
  const [year, mon] = month.split("-").map(Number);
  const range = { gte: new Date(Date.UTC(year, mon - 1, 1)), lt: new Date(Date.UTC(year, mon, 1)) };
  const category = params.categoria ?? (params.da ? "da_classificare" : null);
  const supplierKey = params.fornitore ?? null;

  const invoiceWhere: Prisma.SupplierInvoiceWhereInput = {
    barId: activeBarId,
    issueDate: range,
    ...(supplierKey
      ? { OR: [{ supplierVat: supplierKey }, { supplierTaxCode: supplierKey }, { supplierName: { equals: supplierKey, mode: "insensitive" } }] }
      : {}),
  };

  const backHref = `/dashboard/costi?month=${month}`;
  const title = category ? categoryOf(category).label : supplierKey ? "Fatture del fornitore" : "Fatture del mese";

  if (category) {
    const lines = await prisma.supplierInvoiceLine.findMany({
      where: { barId: activeBarId, category, invoice: invoiceWhere },
      orderBy: [{ totalCents: "desc" }],
      take: 400,
      select: {
        id: true,
        description: true,
        quantity: true,
        unit: true,
        totalCents: true,
        category: true,
        invoice: { select: { supplierName: true, number: true, issueDate: true } },
      },
    });
    return (
      <Shell title={title} month={month} backHref={backHref} extra={params}>
        <RowsCard title="Righe" aside={`${lines.length} righe · ${euro(lines.reduce((sum, line) => sum + line.totalCents, 0))}`}>
          {lines.length ? (
            lines.map((line, index) => (
              <Row key={line.id} first={index === 0} rail={line.category === "da_classificare" ? "amber" : undefined}>
                <Line left={line.description} right={euro(line.totalCents, 2)} />
                <Line
                  muted
                  left={`${line.invoice.supplierName} · n. ${line.invoice.number} del ${day.format(line.invoice.issueDate)}${line.quantity ? ` · ${line.quantity.toLocaleString("it-IT")} ${line.unit ?? ""}` : ""}`}
                />
                <CategorySelect lineId={line.id} category={line.category} supplierName={line.invoice.supplierName} />
              </Row>
            ))
          ) : (
            <Row first>
              <Line muted left="Nessuna riga in questa categoria nel mese." />
            </Row>
          )}
        </RowsCard>
      </Shell>
    );
  }

  const invoices = await prisma.supplierInvoice.findMany({
    where: invoiceWhere,
    orderBy: [{ issueDate: "desc" }, { supplierName: "asc" }],
    take: 300,
    select: {
      id: true,
      supplierName: true,
      number: true,
      docType: true,
      issueDate: true,
      totalCents: true,
      taxableCents: true,
      source: true,
      lines: {
        orderBy: { lineNo: "asc" },
        select: { id: true, description: true, quantity: true, unit: true, unitPrice: true, totalCents: true, category: true },
      },
    },
  });

  return (
    <Shell title={title} month={month} backHref={backHref} extra={params}>
      <RowsCard title="Fatture" aside={`${invoices.length} · ${euro(invoices.reduce((sum, invoice) => sum + invoice.taxableCents, 0))} imponibile`}>
        {invoices.length ? (
          invoices.map((invoice, index) => (
            <details key={invoice.id} style={{ borderTop: index === 0 ? undefined : "1px solid #f1eff8" }}>
              <summary style={{ listStyle: "none", cursor: "pointer", padding: "13px 15px", display: "grid", gap: 3 }}>
                <Line left={invoice.supplierName} right={euro(invoice.taxableCents, 2)} />
                <Line
                  muted
                  left={`${docTypeLabel(invoice.docType)} n. ${invoice.number} · ${day.format(invoice.issueDate)} · ${invoice.lines.length} righe${invoice.source === "openapi" ? " · arrivata da sola" : ""}`}
                  right={`${euro(invoice.totalCents, 2)} con IVA`}
                />
              </summary>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", background: "#fbfaff" }}>
                {invoice.lines.map((line) => {
                  const lineCategory = categoryOf(line.category);
                  return (
                    <div
                      key={line.id}
                      style={{
                        padding: "10px 15px 10px 22px",
                        borderTop: "1px solid #f1eff8",
                        display: "grid",
                        gap: 4,
                        boxShadow: line.category === "da_classificare" ? "inset 3px 0 0 #f59e0b" : undefined,
                      }}
                    >
                      <Line
                        left={
                          <>
                            <Dot color={lineCategory.color} />
                            {line.description}
                          </>
                        }
                        right={euro(line.totalCents, 2)}
                      />
                      {line.quantity ? (
                        <Line
                          muted
                          left={`${line.quantity.toLocaleString("it-IT")} ${line.unit ?? ""}${line.unitPrice !== null ? ` × ${line.unitPrice.toLocaleString("it-IT", { maximumFractionDigits: 4 })} €` : ""}`}
                        />
                      ) : null}
                      <CategorySelect lineId={line.id} category={line.category} supplierName={invoice.supplierName} />
                    </div>
                  );
                })}
              </div>
            </details>
          ))
        ) : (
          <Row first>
            <Line muted left="Nessuna fattura in questo mese." />
          </Row>
        )}
      </RowsCard>
    </Shell>
  );
}

function Shell({
  title,
  month,
  backHref,
  extra,
  children,
}: {
  title: string;
  month: string;
  backHref: string;
  extra: Record<string, string | undefined>;
  children: React.ReactNode;
}) {
  const query = (target: string) => {
    const next = new URLSearchParams();
    next.set("month", target);
    for (const key of ["categoria", "fornitore", "da"]) if (extra[key]) next.set(key, extra[key]!);
    return `/dashboard/costi/fatture?${next.toString()}`;
  };
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 760, margin: "0 auto", width: "100%" }}>
      <header style={{ display: "grid", gap: 4, padding: "0 4px" }}>
        <Link href={backHref} style={{ fontSize: 13, fontWeight: 700, color: "#6d5ce7", textDecoration: "none" }}>
          ‹ Costi
        </Link>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.035em" }}>{title}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: "#4b4763" }}>
          <Link href={query(shiftMonth(month, -1))} aria-label="Mese prima" style={{ color: "#6d5ce7", textDecoration: "none", fontSize: 18 }}>
            ‹
          </Link>
          <span style={{ textTransform: "capitalize" }}>{monthLabel(month)}</span>
          <Link href={query(shiftMonth(month, 1))} aria-label="Mese dopo" style={{ color: "#6d5ce7", textDecoration: "none", fontSize: 18 }}>
            ›
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
