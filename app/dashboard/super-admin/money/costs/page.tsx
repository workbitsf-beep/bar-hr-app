import Link from "next/link";
import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { getRailwayBilling, usdToEuroCents } from "@/lib/railway-billing";
import {
  breakEvenVenues,
  debtEndsKey,
  debtRemainingCents,
  formatCents,
  monthKey,
  monthLabel,
  monthlyEquivalentCents,
  monthlyReport,
  monthSummary,
  paidCents,
  type LedgerEntryInput,
} from "@/lib/ledger";
import { getDashboardContext } from "../../../context";
import { ConsoleButton } from "../../console-form";
import { Empty, Figure, FigureBand, Forbidden, Note, Section } from "../../console-ui";
import { monthlyRevenue, toDateInput } from "../../console-data";
import { deleteLedgerPaymentAction, payLedgerDebtAction } from "../ledger-actions";
import { LedgerEntryForm, type LedgerFormEntry } from "../ledger-forms";

/**
 * Denaro → Costi e debiti: Workbit's own books. The month at a glance on
 * top, then each list (running costs, debts, expenses, extra income) where a
 * tap opens the entry to change it, and the running account month by month.
 * Subscription income comes from the invoices Stripe has marked paid.
 */

const BASE_CENTS = 2999;
const PRO_CENTS = 5999;

function euro(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function toFormEntry(entry: LedgerEntryInput & { note: string | null }): LedgerFormEntry {
  return {
    id: entry.id,
    kind: entry.kind,
    name: entry.name,
    note: entry.note,
    amount: euro(entry.amountCents),
    period: entry.period,
    startsOn: toDateInput(entry.startsOn),
    endsOn: entry.endsOn ? toDateInput(entry.endsOn) : "",
    installment: entry.installmentCents ? euro(entry.installmentCents) : "",
    dueOn: entry.dueOn ? toDateInput(entry.dueOn) : "",
  };
}

/** One entry on a line; a tap opens it to change it. */
function EntryRow({ title, meta, value, valueTone, children }: { title: string; meta: ReactNode; value: string; valueTone?: string; children: ReactNode }) {
  return (
    <details style={{ borderTop: "1px solid var(--k-line, #ece8f6)" }}>
      <summary style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 2px", cursor: "pointer", listStyle: "none" }}>
        <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 2 }}>
          <strong style={{ fontSize: 15, fontWeight: 650 }}>{title}</strong>
          <span className="wbc-row-meta">{meta}</span>
        </span>
        <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 15, color: valueTone }}>{value}</span>
        <span aria-hidden="true" style={{ color: "#8a84a8" }}>›</span>
      </summary>
      <div style={{ padding: "4px 2px 16px" }}>{children}</div>
    </details>
  );
}

function periodMeta(entry: LedgerEntryInput) {
  if (entry.period === "YEARLY") return `${formatCents(entry.amountCents)} l'anno · rinnova a ${new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "Europe/Rome" }).format(entry.startsOn)}`;
  if (entry.period === "ONCE") return `una volta · ${entry.startsOn.toLocaleDateString("it-IT", { timeZone: "Europe/Rome" })}`;
  return "ogni mese";
}

export default async function ConsoleCostsPage() {
  const { role } = await getDashboardContext();
  if (String(role) !== "SUPER_ADMIN") return <Forbidden />;

  const now = new Date();
  const currentKey = monthKey(now);
  const since = new Date(now.getFullYear(), now.getMonth() - 6, 1);

  const [rawEntries, invoices, subscriptions, railway] = await Promise.all([
    prisma.ledgerEntry.findMany({
      orderBy: [{ kind: "asc" }, { startsOn: "desc" }],
      include: { payments: { orderBy: { paidOn: "desc" } } },
    }),
    prisma.invoice.findMany({
      where: { paidAt: { gte: since }, paidAmount: { gt: 0 } },
      select: { paidAmount: true, paidAt: true },
    }),
    prisma.subscription.findMany({
      select: {
        planType: true,
        status: true,
        billingInterval: true,
        monthlyDiscountPercent: true,
        currentPeriodEnd: true,
        trialEndsAt: true,
      },
    }),
    getRailwayBilling(now),
  ]);

  const entries = rawEntries.map((entry) => ({ ...entry, kind: entry.kind as LedgerEntryInput["kind"], period: entry.period as LedgerEntryInput["period"] }));
  const paidInvoices = invoices.filter((invoice): invoice is { paidAmount: number; paidAt: Date } => Boolean(invoice.paidAt));
  const expectedCents = Math.round(subscriptions.reduce((sum, subscription) => sum + monthlyRevenue(subscription), 0) * 100);
  // Railway connected: its real figures replace a "Railway" cost typed by hand,
  // so the server is not counted twice.
  const isManualRailway = (entry: { kind: string; name: string }) => entry.kind === "COST" && /railway/i.test(entry.name);
  const counted = railway.ok ? entries.filter((entry) => !isManualRailway(entry)) : entries;
  const railwayMonthCents = railway.ok ? usdToEuroCents(railway.projectedUsd) : 0;
  const railwayOut = railway.ok
    ? railway.invoices.map((invoice) => ({ name: "Railway (fattura, in euro ≈)", cents: usdToEuroCents(invoice.totalUsd), at: invoice.paidOn }))
    : [];
  const summary = monthSummary(counted, expectedCents, currentKey, railwayMonthCents);
  const report = monthlyReport(counted, paidInvoices, currentKey, 6, railwayOut);
  const need = summary.out + summary.installments - (summary.income - expectedCents);
  const todayKey = toDateInput(now);

  const costs = entries.filter((entry) => entry.kind === "COST");
  const debts = entries.filter((entry) => entry.kind === "DEBT");
  const expenses = entries.filter((entry) => entry.kind === "EXPENSE");
  const income = entries.filter((entry) => entry.kind === "INCOME");

  return (
    <div className="wbc-page">
      <nav className="wbc-chips" aria-label="Denaro" style={{ marginBottom: 14 }}>
        <Link className="wbc-chip" data-on="0" href="/dashboard/super-admin/money">
          Abbonamenti
        </Link>
        <Link className="wbc-chip" data-on="1" href="/dashboard/super-admin/money/costs" aria-current="page">
          Costi e debiti
        </Link>
        <Link className="wbc-chip" data-on="0" href="/dashboard/super-admin/money/invoices">
          Fatture
        </Link>
      </nav>

      <div className="wbc-page-head">
        <h1 className="wbc-title" style={{ textTransform: "capitalize" }}>{monthLabel(currentKey)}</h1>
        <p className="wbc-desc">I conti di Workbit: quello che spendi, quello che devi e quello che resta. Tocca una voce per cambiarla.</p>
      </div>

      <FigureBand>
        <Figure
          label="Resta al mese"
          value={formatCents(summary.left, true)}
          meta={summary.installments ? "prima delle rate" : "entrate meno costi"}
          tone={summary.left >= 0 ? "positive" : "negative"}
        />
        <Figure label="Debiti" value={formatCents(summary.owed)} meta={summary.installments ? `rate ${formatCents(summary.installments)}/mese` : "nessuna rata"} />
        <Figure label="Entrate" value={formatCents(summary.income)} meta="abbonamenti previsti + extra" />
        <Figure label="Costi" value={formatCents(summary.out)} meta="al mese, annuali divisi per 12" />
      </FigureBand>

      {summary.installments || summary.left < 0 ? (
        <div style={{ marginTop: 16 }}>
          <Note tone={summary.afterInstallments >= 0 ? "positive" : "warning"}>
            {summary.installments ? `Con le rate il mese chiude a ${formatCents(summary.afterInstallments, true)}. ` : ""}
            {need > 0
              ? `Pareggi con ${breakEvenVenues(need, BASE_CENTS)} locali Base, o ${breakEvenVenues(need, PRO_CENTS)} Pro.`
              : "Sei in pari."}
          </Note>
        </div>
      ) : null}

      <Section title="Aggiungi una voce">
        <details>
          <summary className="wbc-btn wbc-btn-ghost" style={{ listStyle: "none", width: "fit-content" }}>
            + Costo, spesa, debito o entrata
          </summary>
          <div style={{ paddingTop: 14 }}>
            <LedgerEntryForm todayKey={todayKey} />
          </div>
        </details>
      </Section>

      <Section
        title={`Costi fissi · ${formatCents(
          counted.filter((entry) => entry.kind === "COST").reduce((sum, entry) => sum + monthlyEquivalentCents(entry), 0) + railwayMonthCents
        )} al mese`}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 2px" }}>
          <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 2 }}>
            <strong style={{ fontSize: 15, fontWeight: 650 }}>
              Railway{" "}
              <span className="wbc-status" style={{ fontSize: 12, marginLeft: 6 }}>
                <span className={`wbc-dot wbc-bg-${railway.ok ? "positive" : "warning"}`} aria-hidden="true" />
                <span className={`wbc-t-${railway.ok ? "positive" : "warning"}`}>{railway.ok ? "collegato" : "non collegato"}</span>
              </span>
            </strong>
            <span className="wbc-row-meta">
              {railway.ok
                ? `questo mese finora $${railway.currentUsd.toFixed(2)} · a fine mese circa $${railway.projectedUsd.toFixed(2)}`
                : railway.message}
            </span>
          </span>
          {railway.ok ? (
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>≈ {formatCents(railwayMonthCents)}</span>
          ) : null}
        </div>
        {costs.length === 0 ? <Empty>Nessun costo ancora: aggiungi server, commercialista, abbonamenti agli strumenti.</Empty> : null}
        <div>
          {costs.map((entry) => (
            <EntryRow
              key={entry.id}
              title={entry.name}
              meta={
                railway.ok && isManualRailway(entry)
                  ? "sostituita dai dati di Railway: non viene contata"
                  : `${periodMeta(entry)}${entry.endsOn ? ` · fino a ${entry.endsOn.toLocaleDateString("it-IT")}` : ""}`
              }
              value={formatCents(monthlyEquivalentCents(entry))}
              valueTone={railway.ok && isManualRailway(entry) ? "#b3afc8" : undefined}
            >
              <LedgerEntryForm entry={toFormEntry(entry)} todayKey={todayKey} />
            </EntryRow>
          ))}
          {summary.fees ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 2px", borderTop: "1px solid var(--k-line, #ece8f6)" }}>
              <span style={{ flex: 1, display: "grid", gap: 2 }}>
                <strong style={{ fontSize: 15, fontWeight: 650 }}>Commissioni Stripe</strong>
                <span className="wbc-row-meta">stima dagli abbonamenti: 1,5% + 0,25 €</span>
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{formatCents(summary.fees)}</span>
            </div>
          ) : null}
        </div>
      </Section>

      <Section title={`Debiti · restano ${formatCents(summary.owed)}`}>
        {debts.length === 0 ? <Empty>Nessun debito.</Empty> : null}
        <div>
          {debts.map((entry) => {
            const remaining = debtRemainingCents(entry);
            const share = Math.min(100, Math.round((paidCents(entry) / entry.amountCents) * 100));
            const ends = debtEndsKey(entry, currentKey);
            const dueSoon = entry.dueOn ? Math.ceil((entry.dueOn.getTime() - now.getTime()) / 86_400_000) : null;
            return (
              <div key={entry.id} style={{ display: "grid", gap: 8, padding: "12px 2px", borderTop: "1px solid var(--k-line, #ece8f6)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                  <strong style={{ fontSize: 15, fontWeight: 650 }}>{entry.name}</strong>
                  <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{remaining ? `restano ${formatCents(remaining)}` : "saldato"}</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: "#ece7ff", overflow: "hidden" }}>
                  <div style={{ width: `${share}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#9b5cff,#6d3df0)" }} />
                </div>
                <span className="wbc-row-meta">
                  {formatCents(paidCents(entry))} di {formatCents(entry.amountCents)}
                  {entry.installmentCents ? ` · ${formatCents(entry.installmentCents)} al mese` : ""}
                  {ends ? ` · finisce a ${monthLabel(ends)}` : ""}
                  {entry.dueOn && remaining ? (
                    <b style={{ color: dueSoon !== null && dueSoon <= 7 ? "#c2334d" : undefined }}>
                      {` · scade il ${entry.dueOn.toLocaleDateString("it-IT")}${dueSoon !== null && dueSoon >= 0 ? `, tra ${dueSoon} giorni` : dueSoon !== null ? ", scaduta" : ""}`}
                    </b>
                  ) : null}
                </span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {remaining ? (
                    <ConsoleButton
                      action={payLedgerDebtAction}
                      fields={{ id: entry.id }}
                      label={entry.installmentCents && entry.installmentCents < remaining ? `Segna rata pagata · ${formatCents(entry.installmentCents)}` : `Segna pagato · ${formatCents(remaining)}`}
                      pendingLabel="Segno…"
                      className="wbc-btn wbc-btn-ghost wbc-btn-sm"
                    />
                  ) : null}
                </div>
                <details>
                  <summary className="wbc-row-meta" style={{ cursor: "pointer" }}>Pagamenti e modifica</summary>
                  <div style={{ display: "grid", gap: 6, paddingTop: 10 }}>
                    {entry.payments.length === 0 ? <span className="wbc-row-meta">Ancora nessun pagamento.</span> : null}
                    {entry.payments.map((payment) => (
                      <div key={payment.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ flex: 1, fontSize: 14 }}>
                          {payment.paidOn.toLocaleDateString("it-IT")} · {formatCents(payment.amountCents)}
                        </span>
                        <ConsoleButton
                          action={deleteLedgerPaymentAction}
                          fields={{ id: payment.id }}
                          label="Annulla"
                          pendingLabel="…"
                          confirm={`Annullare il pagamento di ${formatCents(payment.amountCents)} del ${payment.paidOn.toLocaleDateString("it-IT")}?`}
                        />
                      </div>
                    ))}
                    <div style={{ paddingTop: 10 }}>
                      <LedgerEntryForm entry={toFormEntry(entry)} todayKey={todayKey} />
                    </div>
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Spese una tantum">
        {expenses.length === 0 ? <Empty>Nessuna spesa una tantum.</Empty> : null}
        <div>
          {expenses.map((entry) => (
            <EntryRow key={entry.id} title={entry.name} meta={entry.startsOn.toLocaleDateString("it-IT")} value={formatCents(entry.amountCents)}>
              <LedgerEntryForm entry={toFormEntry(entry)} todayKey={todayKey} />
            </EntryRow>
          ))}
        </div>
      </Section>

      {income.length ? (
        <Section title="Entrate extra">
          <div>
            {income.map((entry) => (
              <EntryRow key={entry.id} title={entry.name} meta={periodMeta(entry)} value={formatCents(entry.period === "ONCE" ? entry.amountCents : monthlyEquivalentCents(entry))} valueTone="#1f9d63">
                <LedgerEntryForm entry={toFormEntry(entry)} todayKey={todayKey} />
              </EntryRow>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Resoconto mese per mese">
        <p className="wbc-row-meta" style={{ margin: 0 }}>
          Soldi che si muovono davvero: abbonamenti incassati, costi annuali nel mese in cui rinnovano, rate quando le segni pagate. Il progressivo parte da sei mesi fa.
        </p>
        <div>
          {report.map((row) => (
            <details key={row.key} style={{ borderTop: "1px solid var(--k-line, #ece8f6)" }}>
              {/* Two lines a month: a phone has no room for five columns. */}
              <summary style={{ display: "grid", gap: 3, padding: "11px 2px", cursor: "pointer", listStyle: "none" }}>
                <span style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                  <span style={{ textTransform: "capitalize", fontSize: 15, fontWeight: row.key === currentKey ? 800 : 600 }}>
                    {monthLabel(row.key)}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 800, fontSize: 15, color: row.balance < 0 ? "#c2334d" : "#1f9d63" }}>
                    {formatCents(row.balance, true)}
                  </span>
                </span>
                <span className="wbc-row-meta" style={{ fontVariantNumeric: "tabular-nums" }}>
                  entrate {formatCents(row.income)} · uscite {formatCents(row.out)} · progressivo{" "}
                  <b style={{ color: row.running < 0 ? "#c2334d" : "#1f9d63" }}>{formatCents(row.running, true)}</b>
                </span>
              </summary>
              <div style={{ display: "grid", gap: 4, padding: "0 2px 12px" }}>
                {row.lines.length === 0 ? <span className="wbc-row-meta">Nessun movimento.</span> : null}
                {row.lines.map((line, index) => (
                  <span key={`${line.name}-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, color: "#4c4670" }}>
                    <span>{line.name}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums", color: line.direction === "in" ? "#1f9d63" : undefined }}>
                      {line.direction === "in" ? "+" : "−"}
                      {formatCents(line.cents)}
                    </span>
                  </span>
                ))}
              </div>
            </details>
          ))}
        </div>
      </Section>
    </div>
  );
}
