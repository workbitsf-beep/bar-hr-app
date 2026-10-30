import Link from "next/link";
import type { CSSProperties } from "react";
import { Role } from "@prisma/client";
import { ActionForm } from "@/app/components/action-form";
import { PendingButton } from "@/app/components/pending-button";
import { buildPayrollMonth, type PayrollPerson } from "@/lib/payroll/consultant-export";
import { defaultPayrollMonth, monthKeyOf, parseMonthKey } from "@/lib/payroll/access";
import { DAY_KINDS, monthName, PAYROLL_CODE_LABELS, PAYROLL_KINDS, type PayrollCodeKey } from "@/lib/payroll/template";
import { can } from "@/lib/staff-permissions";
import { memberScopeWhere } from "@/lib/staff-scope";
import { BillingRequired } from "../../billing-required";
import { getDashboardContext } from "../../context";
import { EmptyState, Panel } from "../../ui";
import { Avatar, mixCard, PageHead, Pill } from "../../mix-ui";
import { resetMonthTotalsAction, saveMonthTotalsAction } from "../actions";
import { hoursValue, initials, MonthMenu, Quiet } from "../payroll-ui";

export const dynamic = "force-dynamic";

const input: CSSProperties = {
  width: 76,
  minHeight: 38,
  borderRadius: 10,
  border: "1px solid #e4e0f3",
  padding: "0 8px",
  fontSize: 15,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  background: "#ffffff",
  color: "#1f1b3a",
};
const line: CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #f2f0f8" };
const soft: CSSProperties = {
  minHeight: 40,
  padding: "0 16px",
  borderRadius: 999,
  border: "1px solid #ddd6fe",
  background: "#f6f3ff",
  color: "#4c1d95",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

function changed(person: PayrollPerson, kind: PayrollCodeKey) {
  return person.totals[kind].hours !== person.computedTotals[kind].hours || person.totals[kind].days !== person.computedTotals[kind].days;
}

/** One item of the month: its hours (and days, for whole days away), what it was if changed. */
function KindRow({ person, kind }: { person: PayrollPerson; kind: PayrollCodeKey }) {
  const now = person.totals[kind];
  const was = person.computedTotals[kind];
  const isDays = DAY_KINDS.includes(kind);
  return (
    <div style={line}>
      <input type="hidden" name={`was_hours_${kind}`} value={was.hours} />
      <input type="hidden" name={`was_days_${kind}`} value={was.days} />
      <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
        <span style={{ fontSize: 15 }}>{PAYROLL_CODE_LABELS[kind]}</span>
        {changed(person, kind) ? (
          <Quiet style={{ fontSize: 12.5 }}>
            era {isDays ? `${was.days} gg · ` : ""}
            {hoursValue(was.hours)}
          </Quiet>
        ) : null}
      </span>
      {isDays ? (
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#7c7894" }}>
          <input name={`days_${kind}`} defaultValue={now.days} inputMode="numeric" aria-label={`${PAYROLL_CODE_LABELS[kind]}, giorni`} style={{ ...input, width: 48 }} />
          gg
        </label>
      ) : null}
      <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#7c7894" }}>
        <input name={`hours_${kind}`} defaultValue={hoursValue(now.hours)} inputMode="decimal" aria-label={`${PAYROLL_CODE_LABELS[kind]}, ore`} style={input} />
        ore
      </label>
    </div>
  );
}

/**
 * The month's file, person by person, before it goes to the consultant: the
 * totals can be changed here and the file follows. The clock-ins and the
 * shifts stay as they are; the day-by-day correction is on the person's page.
 */
export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ mese?: string }> }) {
  const { role, staff, activeBarId, billingStatus } = await getDashboardContext();
  if (!activeBarId) {
    return (
      <Panel title="Rivedi il file">
        <EmptyState message="Seleziona un locale." />
      </Panel>
    );
  }
  if (billingStatus && !billingStatus.canAccess) return <BillingRequired role={String(role)} />;
  if (role !== Role.OWNER && !can(staff, "reports")) {
    return (
      <Panel title="Rivedi il file">
        <EmptyState message="Il file per il consulente lo prepara il titolare." />
      </Panel>
    );
  }

  const { mese } = await searchParams;
  const { year, month } = parseMonthKey(mese) ?? defaultPayrollMonth();
  const key = monthKeyOf(year, month);
  const data = await buildPayrollMonth({ barId: activeBarId, month, year, memberWhere: memberScopeWhere(staff) });
  const edited = data.people.filter((person) => person.adjusted).length;

  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 640, margin: "0 auto", width: "100%", padding: "4px 4px 8px", color: "#1f1b3a" }}>
      <Link href={`/dashboard/presenze?mese=${key}`} style={{ fontSize: 15, fontWeight: 600, color: "#5e4ae3", textDecoration: "none", justifySelf: "start" }}>
        ‹ Presenze
      </Link>
      <PageHead title="Rivedi il file" />
      <MonthMenu base="/dashboard/presenze/rivedi" year={year} month={month} />
      <Quiet style={{ fontSize: 14, lineHeight: 1.5, padding: "0 4px" }}>
        Cambia i totali di {monthName(month, year)} prima di mandarli: il file per il consulente si aggiorna da solo. Timbrature e turni restano come sono.
        {edited ? ` ${edited === 1 ? "1 persona modificata" : `${edited} persone modificate`}.` : ""}
      </Quiet>

      {data.people.length === 0 ? (
        <div style={mixCard}>
          <Quiet>Nessuna persona in questo mese.</Quiet>
        </div>
      ) : (
        data.people.map((person) => {
          const shown = PAYROLL_KINDS.filter((kind) => person.computedTotals[kind].hours || person.computedTotals[kind].days || person.totals[kind].hours || person.totals[kind].days);
          const others = PAYROLL_KINDS.filter((kind) => !shown.includes(kind));
          if (!shown.length) shown.push("ordinary");
          const worked = person.totals.ordinary.hours + person.totals.overtime.hours;
          return (
            <details key={person.userId} className="wb-week" style={{ ...mixCard, padding: "12px 16px" }}>
              <summary style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", listStyle: "none" }}>
                <Avatar>{initials(person.firstName, person.lastName)}</Avatar>
                <span style={{ flex: 1, minWidth: 0, fontSize: 15.5, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {person.firstName} {person.lastName}
                </span>
                {person.adjusted ? <Pill tone="violet">modificato</Pill> : null}
                <b style={{ fontSize: 15.5, fontVariantNumeric: "tabular-nums" }}>{hoursValue(worked)}</b>
                <span aria-hidden style={{ color: "#c4c0d6", fontSize: 18 }}>›</span>
              </summary>

              <ActionForm action={saveMonthTotalsAction} success="File aggiornato" style={{ display: "grid", marginTop: 8 }}>
                <input type="hidden" name="userId" value={person.userId} />
                <input type="hidden" name="month" value={key} />
                {shown.map((kind) => (
                  <KindRow key={kind} person={person} kind={kind} />
                ))}
                {others.length ? (
                  <details style={{ borderTop: "1px solid #f2f0f8", padding: "8px 0" }}>
                    <summary style={{ cursor: "pointer", fontSize: 14, color: "#5e4ae3", fontWeight: 600, listStyle: "none" }}>+ Altre voci</summary>
                    {others.map((kind) => (
                      <KindRow key={kind} person={person} kind={kind} />
                    ))}
                  </details>
                ) : null}
                <label style={{ ...line, display: "grid", gap: 4 }}>
                  <Quiet style={{ fontSize: 12.5 }}>Nota per te (facoltativa, non va nel file)</Quiet>
                  <input name="note" defaultValue={person.adjustedNote ?? ""} maxLength={200} style={{ ...input, width: "100%", textAlign: "left" }} />
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, paddingTop: 10 }}>
                  <PendingButton type="submit" pendingLabel="Salvo…" style={{ ...soft, background: "linear-gradient(135deg,#3b1d8f,#5e4ae3 55%,#8b5cf6)", color: "#ffffff", border: 0 }}>
                    Salva
                  </PendingButton>
                  <Link href={`/dashboard/presenze/persona/${person.userId}?mese=${key}`} style={{ fontSize: 14, color: "#5e4ae3", fontWeight: 600, textDecoration: "none", marginLeft: "auto" }}>
                    Giorno per giorno ›
                  </Link>
                </div>
              </ActionForm>
              {person.adjusted ? (
                <ActionForm action={resetMonthTotalsAction} success="Tornato ai valori calcolati" style={{ paddingTop: 6 }}>
                  <input type="hidden" name="userId" value={person.userId} />
                  <input type="hidden" name="month" value={key} />
                  <PendingButton type="submit" pendingLabel="…" style={{ border: 0, background: "none", padding: 0, color: "#7c7894", fontSize: 13.5, cursor: "pointer" }}>
                    Torna ai valori calcolati
                  </PendingButton>
                </ActionForm>
              ) : null}
            </details>
          );
        })
      )}
    </div>
  );
}
