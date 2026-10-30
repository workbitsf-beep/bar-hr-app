import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Role } from "@prisma/client";
import { ActionForm } from "@/app/components/action-form";
import { PendingButton } from "@/app/components/pending-button";
import { rowKey } from "@/lib/payroll/adjust";
import { buildPayrollMonth, type PayrollPerson } from "@/lib/payroll/consultant-export";
import { defaultPayrollMonth, monthKeyOf, parseMonthKey } from "@/lib/payroll/access";
import {
  cellText,
  DAY_KINDS,
  monthName,
  PAYROLL_CODE_LABELS,
  PAYROLL_KINDS,
  payrollFileBaseName,
  renderPayrollTable,
  templateOf,
  type PayrollCodeKey,
  type RowRef,
} from "@/lib/payroll/template";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/staff-permissions";
import { memberScopeWhere } from "@/lib/staff-scope";
import { BillingRequired } from "../../billing-required";
import { getDashboardContext } from "../../context";
import { EmptyState, Panel } from "../../ui";
import { mixCard, PageHead } from "../../mix-ui";
import { PopupAction } from "../../popup-action";
import { resetMonthTotalsAction, saveFileRowAction, saveMonthTotalsAction, toggleFileRowAction } from "../actions";
import { hoursValue, MonthMenu, Quiet } from "../payroll-ui";

export const dynamic = "force-dynamic";

const input: CSSProperties = {
  width: 90,
  minHeight: 44,
  borderRadius: 12,
  border: "1px solid #e4e0f3",
  padding: "0 10px",
  fontSize: 16,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  background: "#ffffff",
  color: "#1f1b3a",
};
const line: CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #f2f0f8" };
const saveButton: CSSProperties = {
  minHeight: 48,
  borderRadius: 999,
  border: 0,
  background: "linear-gradient(135deg,#3b1d8f,#5e4ae3 55%,#8b5cf6)",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
};
const cell: CSSProperties = { padding: "8px 8px", borderBottom: "1px solid #f4f3f9", whiteSpace: "nowrap" };

function Hidden({ person, monthKey, refItem }: { person: PayrollPerson; monthKey: string; refItem?: RowRef }) {
  return (
    <>
      <input type="hidden" name="userId" value={person.userId} />
      <input type="hidden" name="month" value={monthKey} />
      {refItem?.date ? <input type="hidden" name="date" value={refItem.date} /> : null}
      {refItem?.kind ? <input type="hidden" name="kind" value={refItem.kind} /> : null}
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ ...line, borderTop: 0, justifyContent: "space-between" }}>
      <span style={{ fontSize: 15 }}>{label}</span>
      {children}
    </label>
  );
}

/** What the pencil opens: the row's hours (and days), or the person's month item by item. */
function EditForm({ person, refItem, monthKey }: { person: PayrollPerson; refItem: RowRef; monthKey: string }) {
  const name = `${person.firstName} ${person.lastName}`.trim();

  if (refItem.kind) {
    const kind = refItem.kind;
    const rows = person.reviewEntries.filter((entry) => entry.kind === kind && (!refItem.date || entry.date === refItem.date));
    const hours = rows.reduce((sum, entry) => sum + entry.hours, 0);
    const days = rows.reduce((sum, entry) => sum + entry.days, 0);
    const isDays = DAY_KINDS.includes(kind);
    return (
      <ActionForm action={saveFileRowAction} success="Riga cambiata" style={{ display: "grid", gap: 8 }}>
        <Hidden person={person} monthKey={monthKey} refItem={refItem} />
        <Quiet style={{ fontSize: 14 }}>
          {name} · {PAYROLL_CODE_LABELS[kind]}
          {refItem.date ? ` · ${new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${refItem.date}T00:00:00Z`))}` : " · totale del mese"}
        </Quiet>
        <Field label="Ore">
          <input name="hours" defaultValue={hoursValue(hours)} inputMode="decimal" style={input} />
        </Field>
        {isDays ? (
          <Field label="Giorni">
            <input name="days" defaultValue={days} inputMode="numeric" style={{ ...input, width: 64 }} />
          </Field>
        ) : null}
        <PendingButton type="submit" pendingLabel="Salvo…" style={saveButton}>
          Salva
        </PendingButton>
      </ActionForm>
    );
  }

  // A row per person: every item of the month.
  const kinds = PAYROLL_KINDS.filter((kind) => person.computedTotals[kind].hours || person.computedTotals[kind].days || person.totals[kind].hours || person.totals[kind].days);
  if (!kinds.length) kinds.push("ordinary");
  return (
    <ActionForm action={saveMonthTotalsAction} success="Riga cambiata" style={{ display: "grid", gap: 4 }}>
      <Hidden person={person} monthKey={monthKey} />
      <Quiet style={{ fontSize: 14 }}>{name} · totali del mese</Quiet>
      {kinds.map((kind) => (
        <div key={kind} style={line}>
          <input type="hidden" name={`was_hours_${kind}`} value={person.computedTotals[kind].hours} />
          <input type="hidden" name={`was_days_${kind}`} value={person.computedTotals[kind].days} />
          <span style={{ flex: 1, fontSize: 15 }}>{PAYROLL_CODE_LABELS[kind]}</span>
          {DAY_KINDS.includes(kind) ? <input name={`days_${kind}`} defaultValue={person.totals[kind].days} inputMode="numeric" aria-label="giorni" style={{ ...input, width: 56 }} /> : null}
          <input name={`hours_${kind}`} defaultValue={hoursValue(person.totals[kind].hours)} inputMode="decimal" aria-label="ore" style={input} />
        </div>
      ))}
      <input type="hidden" name="note" value={person.adjustedNote ?? ""} />
      <PendingButton type="submit" pendingLabel="Salvo…" style={{ ...saveButton, marginTop: 8 }}>
        Salva
      </PendingButton>
      <Link href={`/dashboard/presenze/persona/${person.userId}?mese=${monthKey}`} style={{ fontSize: 14, color: "#5e4ae3", fontWeight: 600, textDecoration: "none", textAlign: "center", paddingTop: 6 }}>
        Giorno per giorno ›
      </Link>
    </ActionForm>
  );
}

/**
 * The consultant's file as it will be sent - same columns, same rows - and
 * changeable: the green tick keeps a row in the file or leaves it out, the
 * pencil changes its hours. The clock-ins and the shifts stay as they are.
 */
export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ mese?: string; r?: string }> }) {
  const { role, staff, activeBarId, billingStatus } = await getDashboardContext();
  if (!activeBarId) {
    return (
      <Panel title="Il file del mese">
        <EmptyState message="Seleziona un locale." />
      </Panel>
    );
  }
  if (billingStatus && !billingStatus.canAccess) return <BillingRequired role={String(role)} />;
  if (role !== Role.OWNER && !can(staff, "reports")) {
    return (
      <Panel title="Il file del mese">
        <EmptyState message="Il file per il consulente lo prepara il titolare." />
      </Panel>
    );
  }

  const { mese, r } = await searchParams;
  const { year, month } = parseMonthKey(mese) ?? defaultPayrollMonth();
  const key = monthKeyOf(year, month);
  const [data, recipients] = await Promise.all([
    buildPayrollMonth({ barId: activeBarId, month, year, memberWhere: memberScopeWhere(staff) }),
    prisma.payrollRecipient.findMany({ where: { barId: activeBarId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, template: true } }),
  ]);
  const recipient = recipients.find((item) => item.id === r) ?? recipients[0] ?? null;
  const template = templateOf(recipient?.template ?? null);

  // Every row, the ones left out included, so they can be ticked back in.
  const table = renderPayrollTable({ ...data, people: data.people.map((person) => ({ ...person, entries: person.reviewEntries })) }, template);
  const people = new Map(data.people.map((person) => [person.userId, person]));
  const isOff = (refItem: RowRef) => {
    const person = people.get(refItem.userId);
    if (!person) return false;
    if (person.excluded) return true;
    if (refItem.date && refItem.kind) return person.offRows.includes(rowKey(refItem.date, refItem.kind));
    if (refItem.kind) return Boolean(person.adjusted?.kindsOff.includes(refItem.kind as PayrollCodeKey));
    return false;
  };
  const inFile = table.refs.filter((refItem) => !isOff(refItem)).length;
  const changedPeople = data.people.filter((person) => person.adjusted);

  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 900, margin: "0 auto", width: "100%", padding: "4px 4px 8px", color: "#1f1b3a" }}>
      <Link href={`/dashboard/presenze?mese=${key}`} style={{ fontSize: 15, fontWeight: 600, color: "#5e4ae3", textDecoration: "none", justifySelf: "start" }}>
        ‹ Presenze
      </Link>
      <PageHead title="Il file del mese" />
      <MonthMenu base={`/dashboard/presenze/rivedi${recipient && recipients.length > 1 ? `?r=${recipient.id}` : ""}`} year={year} month={month} />

      {recipients.length > 1 ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {recipients.map((item) => (
            <Link
              key={item.id}
              href={`/dashboard/presenze/rivedi?mese=${key}&r=${item.id}`}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                fontSize: 13.5,
                fontWeight: 650,
                textDecoration: "none",
                border: "1px solid #ddd6fe",
                background: item.id === recipient?.id ? "#4c1d95" : "#ffffff",
                color: item.id === recipient?.id ? "#ffffff" : "#4c1d95",
              }}
            >
              {item.name}
            </Link>
          ))}
        </div>
      ) : null}

      <Quiet style={{ fontSize: 14, lineHeight: 1.5, padding: "0 4px" }}>
        Così lo riceve {recipient ? recipient.name : "il consulente"}, {monthName(month, year)}. Le righe con la spunta verde vanno nel file; toccala per toglierla. Con ✏️ cambi le ore. Timbrature e turni restano come sono.
      </Quiet>

      <div style={{ ...mixCard, padding: "6px 0" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13.5, fontVariantNumeric: "tabular-nums" }}>
            {table.header ? (
              <thead>
                <tr>
                  <th style={{ ...cell, position: "sticky", left: 0, background: "#ffffff", zIndex: 1 }} />
                  {table.header.map((title, index) => (
                    <th key={index} style={{ ...cell, textAlign: "left", color: "#8a85a3", fontWeight: 500 }}>
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {table.rows.map((cells, index) => {
                const refItem = table.refs[index];
                const person = people.get(refItem.userId)!;
                const off = isOff(refItem);
                return (
                  <tr key={index} style={{ opacity: off ? 0.45 : 1 }}>
                    <td style={{ ...cell, position: "sticky", left: 0, background: "#ffffff", zIndex: 1, padding: "6px 8px 6px 12px" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <ActionForm action={toggleFileRowAction} success={off ? "Riga di nuovo nel file" : "Riga tolta dal file"}>
                          <Hidden person={person} monthKey={key} refItem={refItem} />
                          <PendingButton
                            type="submit"
                            aria-label={off ? "Rimetti nel file" : "Togli dal file"}
                            pendingLabel="…"
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 999,
                              border: "1px solid #bbf7d0",
                              background: off ? "#ffffff" : "#10b981",
                              color: off ? "#bbf7d0" : "#ffffff",
                              fontSize: 15,
                              fontWeight: 900,
                              cursor: "pointer",
                            }}
                          >
                            ✓
                          </PendingButton>
                        </ActionForm>
                        {!off ? (
                          <PopupAction title="Cambia la riga" ariaLabel="Cambia la riga" triggerContent={<span aria-hidden style={{ fontSize: 14 }}>✏️</span>}>
                            <EditForm person={person} refItem={refItem} monthKey={key} />
                          </PopupAction>
                        ) : null}
                      </span>
                    </td>
                    {cells.map((value, cellIndex) => (
                      <td key={cellIndex} style={{ ...cell, textAlign: typeof value === "number" ? "right" : "left", textDecoration: off ? "line-through" : undefined }}>
                        {cellText(value, template)}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {!table.rows.length ? (
                <tr>
                  <td style={{ ...cell, color: "#8a85a3" }} colSpan={2}>
                    Nessuna riga: questo mese non ci sono ancora ore.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 12.5, color: "#8a85a3", padding: "8px 12px 2px" }}>
          {payrollFileBaseName(data, template)}.{template.fileType} · {inFile} {inFile === 1 ? "riga" : "righe"} nel file
          {table.rows.length - inFile ? ` · ${table.rows.length - inFile} tolte` : ""}
        </div>
        {table.legend ? <div style={{ fontSize: 12, color: "#8a85a3", padding: "2px 12px 4px" }}>{table.legend}</div> : null}
      </div>

      {changedPeople.length ? (
        <div style={{ ...mixCard, display: "grid" }}>
          <span style={{ fontSize: 14.5, fontWeight: 750, marginBottom: 4 }}>Cambiate da te</span>
          {changedPeople.map((person, index) => (
            <div key={person.userId} style={{ ...line, borderTop: index ? line.borderTop : 0 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15 }}>
                {person.firstName} {person.lastName}
                {person.excluded ? <Quiet style={{ fontSize: 13 }}> · fuori dal file</Quiet> : null}
              </span>
              <ActionForm action={resetMonthTotalsAction} success="Tornato come dalle timbrature">
                <Hidden person={person} monthKey={key} />
                <PendingButton type="submit" pendingLabel="…" style={{ border: 0, background: "none", color: "#5e4ae3", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  Annulla le modifiche
                </PendingButton>
              </ActionForm>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
