import Link from "next/link";
import type { ReactNode } from "react";
import { Role } from "@prisma/client";
import { ActionForm } from "@/app/components/action-form";
import { PendingButton } from "@/app/components/pending-button";
import { costsEnabledFor } from "@/lib/costs/access";
import { buildSchedule, METHOD_LABELS, type ScheduleItem } from "@/lib/costs/payments";
import { BillingRequired } from "../../billing-required";
import { getDashboardContext } from "../../context";
import { EmptyState, Panel } from "../../ui";
import { PageHead } from "../../mix-ui";
import { markPaymentAction, toggleSupplierRuleAction } from "../actions";
import { CopyButton } from "../copy-button";
import { euro, Line, Row, RowsCard, softButton } from "../cost-ui";

export const dynamic = "force-dynamic";

const day = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const shortDay = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });
const money = (cents: number) => `${(cents / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const small = { ...softButton, minHeight: 32, padding: "4px 12px", fontSize: 12.5 };
const quiet = { ...small, background: "#ffffff", color: "#7c7894", borderColor: "#e9e6f5" };

function Mark({ ids, state, children, style }: { ids: string[]; state: "PAID" | "NOT_PAID" | "RESET"; children: ReactNode; style?: object }) {
  const success = state === "PAID" ? "Segnata pagata" : state === "NOT_PAID" ? "Segnata da pagare" : "Rimessa da confermare";
  return (
    <ActionForm action={markPaymentAction} success={ids.length > 1 ? `${ids.length} segnate pagate` : success}>
      {ids.map((id) => (
        <input key={id} type="hidden" name="paymentId" value={id} />
      ))}
      <input type="hidden" name="state" value={state} />
      <PendingButton type="submit" pendingLabel="…" style={{ ...small, ...style }}>
        {children}
      </PendingButton>
    </ActionForm>
  );
}

function causale(item: ScheduleItem) {
  return `Saldo fattura n. ${item.invoiceNumber} del ${shortDay.format(item.invoiceDate)} ${item.invoiceDate.getUTCFullYear()}`;
}

function PaymentRow({ item, first, children }: { item: ScheduleItem; first: boolean; children?: ReactNode }) {
  return (
    <Row first={first}>
      <Line left={<b style={{ fontWeight: 650 }}>{item.supplierName}</b>} right={<b>{money(item.amountCents)}</b>} />
      <Line muted left={`${day.format(item.dueDate)} · ${item.method ? METHOD_LABELS[item.method] ?? item.method : "modalità non indicata"} · fattura ${item.invoiceNumber}`} />
      {children ? <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>{children}</span> : null}
    </Row>
  );
}

function AlwaysPaid({ item, on }: { item: ScheduleItem; on: boolean }) {
  return (
    <ActionForm action={toggleSupplierRuleAction} success={on ? "Regola tolta" : `${item.supplierName}: sempre pagate`}>
      <input type="hidden" name="supplierKey" value={item.supplierKey} />
      <input type="hidden" name="supplierName" value={item.supplierName} />
      <PendingButton type="submit" pendingLabel="…" style={{ ...quiet, border: 0, padding: "4px 2px" }}>
        {on ? "Non è più sempre pagato" : "Lo pago sempre subito"}
      </PendingButton>
    </ActionForm>
  );
}

/**
 * Supplier payments: what is late, what needs a yes or no, what is due and
 * what the bank takes by itself, then the next four weeks of outgoings.
 */
export default async function PaymentsPage() {
  const { session, role, activeBarId, billingStatus } = await getDashboardContext();
  if (!activeBarId) {
    return (
      <Panel title="Pagamenti">
        <EmptyState message="Seleziona un locale." />
      </Panel>
    );
  }
  if (billingStatus && !billingStatus.canAccess) return <BillingRequired role={String(role)} />;
  if (role !== Role.OWNER || !costsEnabledFor(session.user.role)) {
    return (
      <Panel title="Pagamenti">
        <EmptyState message="I pagamenti ai fornitori li vede solo il titolare." />
      </Panel>
    );
  }

  const { items, weeks, rules, withoutTerms } = await buildSchedule(activeBarId);
  const ruleKeys = new Set(rules.map((rule) => rule.supplierKey));
  const overdue = items.filter((item) => item.status === "overdue");
  const confirm = items.filter((item) => item.status === "confirm").reverse();
  const due = items.filter((item) => item.status === "due");
  const automatic = items.filter((item) => item.status === "automatic");
  const paid = items.filter((item) => item.status === "paid" && item.paidAt).sort((a, b) => (b.paidAt?.getTime() ?? 0) - (a.paidAt?.getTime() ?? 0));
  const total = (list: ScheduleItem[]) => list.reduce((sum, item) => sum + item.amountCents, 0);
  const nextMonth = weeks.reduce((sum, week) => sum + week.manualCents + week.automaticCents, 0);

  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 760, margin: "0 auto", width: "100%", padding: "4px 4px 8px" }}>
      <Link href="/dashboard/costi" style={{ fontSize: 15, fontWeight: 600, color: "#5e4ae3", textDecoration: "none", justifySelf: "start" }}>
        ‹ Costi
      </Link>
      <PageHead title="Pagamenti" />

      <RowsCard>
        <Row first style={{ gap: 2, padding: "16px 15px" }}>
          <span style={{ fontSize: 12.5, color: "#7c7894" }}>Escono nelle prossime 4 settimane</span>
          <span style={{ fontSize: 30, fontWeight: 850, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{euro(nextMonth)}</span>
          <span style={{ fontSize: 12.5, color: "#7c7894" }}>
            {overdue.length ? `${overdue.length} scadute da pagare · ` : ""}
            {confirm.length ? `${confirm.length} da confermare · ` : ""}
            {due.length} bonifici da fare · {automatic.length} addebiti automatici
          </span>
        </Row>
        {weeks.map((week, index) => (
          <Row key={week.start.toISOString()}>
            <Line
              left={index === 0 ? "Questa settimana" : index === 1 ? "La prossima" : `Dal ${shortDay.format(week.start)}`}
              right={euro(week.manualCents + week.automaticCents)}
            />
            {week.manualCents || week.automaticCents ? (
              <Line muted left={[week.manualCents ? `${euro(week.manualCents)} da pagare tu` : null, week.automaticCents ? `${euro(week.automaticCents)} addebitati dalla banca` : null].filter(Boolean).join(" · ")} />
            ) : null}
          </Row>
        ))}
      </RowsCard>

      {overdue.length ? (
        <RowsCard title={<span style={{ color: "#b3202f" }}>Scadute, non ancora pagate</span>} aside={money(total(overdue))}>
          {overdue.map((item, index) => (
            <PaymentRow key={item.id} item={item} first={index === 0}>
              <Mark ids={[item.id]} state="PAID">Pagata</Mark>
              {item.iban ? <CopyButton value={item.iban} label="IBAN" style={quiet} /> : null}
              <CopyButton value={causale(item)} label="Causale" style={quiet} />
            </PaymentRow>
          ))}
        </RowsCard>
      ) : null}

      {confirm.length ? (
        <RowsCard
          title="Le hai pagate?"
          aside={
            confirm.length > 1 ? (
              <Mark ids={confirm.map((item) => item.id)} state="PAID" style={{ minHeight: 28 }}>
                Pagate tutte
              </Mark>
            ) : (
              money(total(confirm))
            )
          }
        >
          {confirm.map((item, index) => (
            <PaymentRow key={item.id} item={item} first={index === 0}>
              <Mark ids={[item.id]} state="PAID">Sì, pagata</Mark>
              <Mark ids={[item.id]} state="NOT_PAID" style={quiet}>
                Non ancora
              </Mark>
              <AlwaysPaid item={item} on={ruleKeys.has(item.supplierKey)} />
            </PaymentRow>
          ))}
          <Row>
            <Line muted left="Bonifici con la scadenza passata: finché non rispondi restano qui, non li contiamo come scaduti." />
          </Row>
        </RowsCard>
      ) : null}

      <RowsCard title="Da pagare" aside={due.length ? money(total(due)) : "nessun bonifico"}>
        {due.length ? (
          due.map((item, index) => (
            <PaymentRow key={item.id} item={item} first={index === 0}>
              <Mark ids={[item.id]} state="PAID">Pagata</Mark>
              {item.iban ? <CopyButton value={item.iban} label="IBAN" style={quiet} /> : null}
              <CopyButton value={causale(item)} label="Causale" style={quiet} />
            </PaymentRow>
          ))
        ) : (
          <Row first>
            <Line muted left="Nessun bonifico in scadenza nei prossimi 60 giorni." />
          </Row>
        )}
      </RowsCard>

      {automatic.length ? (
        <RowsCard title="Escono da sole" aside={`${money(total(automatic))} · RiBa e addebiti`}>
          {automatic.map((item, index) => (
            <PaymentRow key={item.id} item={item} first={index === 0} />
          ))}
          <Row>
            <Line muted left="La banca le paga il giorno della scadenza: tieni il conto coperto. Dopo quel giorno le contiamo pagate." />
          </Row>
        </RowsCard>
      ) : null}

      {paid.length ? (
        <RowsCard title="Segnate pagate da te" aside="ultime">
          {paid.slice(0, 10).map((item, index) => (
            <PaymentRow key={item.id} item={item} first={index === 0}>
              <Mark ids={[item.id]} state="RESET" style={quiet}>
                Annulla
              </Mark>
            </PaymentRow>
          ))}
        </RowsCard>
      ) : null}

      {rules.length ? (
        <RowsCard title="Fornitori pagati sempre subito" aside={`${rules.length}`}>
          {rules.map((rule, index) => (
            <Row key={rule.supplierKey} first={index === 0} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 14.5 }}>{rule.supplierName}</span>
              <ActionForm action={toggleSupplierRuleAction} success="Regola tolta">
                <input type="hidden" name="supplierKey" value={rule.supplierKey} />
                <input type="hidden" name="supplierName" value={rule.supplierName} />
                <PendingButton type="submit" pendingLabel="…" style={quiet}>
                  Togli
                </PendingButton>
              </ActionForm>
            </Row>
          ))}
        </RowsCard>
      ) : null}

      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "#8a85a3", padding: "0 6px" }}>
        Scadenze, importi e IBAN sono quelli scritti nelle fatture. Carta e contanti sono già pagati; RiBa e addebiti diretti li paga la banca.
        {withoutTerms ? ` ${withoutTerms} fatture degli ultimi tre mesi non dicono quando pagarle e non sono qui.` : ""}
      </p>
    </div>
  );
}
