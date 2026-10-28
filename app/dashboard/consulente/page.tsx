import Link from "next/link";
import { Role } from "@prisma/client";
import { ActionForm } from "@/app/components/action-form";
import { PendingButton } from "@/app/components/pending-button";
import { buildPayrollMonth, PAYROLL_CODE_LABELS, payrollCodesOf, type PayrollCodeKey } from "@/lib/payroll/consultant-export";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/staff-permissions";
import { memberScopeWhere } from "@/lib/staff-scope";
import { BillingRequired } from "../billing-required";
import { getDashboardContext } from "../context";
import { Line, Row, RowsCard, SectionLabel, softButton } from "../costi/cost-ui";
import { EmptyState, Panel } from "../ui";
import { savePayrollPeopleAction, saveConsultantAction } from "./actions";
import { ExportButtons } from "./export-buttons";

export const dynamic = "force-dynamic";

const inputStyle = {
  minHeight: 38,
  borderRadius: 12,
  border: "1px solid #e9e6f5",
  padding: "0 10px",
  fontSize: 15,
  width: "100%",
  minWidth: 0,
  background: "#ffffff",
} as const;

function hours(value: number) {
  return value ? value.toLocaleString("it-IT", { maximumFractionDigits: 2 }) : "–";
}

/** The month's attendance, ready for the labour consultant's payroll software. */
export default async function ConsultantPage({ searchParams }: { searchParams: Promise<{ mese?: string }> }) {
  const { role, staff, activeBarId, billingStatus, features } = await getDashboardContext();
  if (!activeBarId) {
    return (
      <Panel title="Presenze per il consulente">
        <EmptyState message="Seleziona un locale." />
      </Panel>
    );
  }
  if (billingStatus && !billingStatus.canAccess) return <BillingRequired role={String(role)} />;
  const isOwner = role === Role.OWNER;
  if (!isOwner && !can(staff, "reports")) {
    return (
      <Panel title="Presenze per il consulente">
        <EmptyState message="Le presenze per il consulente le prepara il titolare." />
      </Panel>
    );
  }
  if (!features.reports) {
    return (
      <Panel title="Presenze per il consulente">
        <EmptyState message="Modulo report disattivato nelle impostazioni." />
      </Panel>
    );
  }

  // Payroll is closed at the start of the next month: that month comes first.
  const { mese } = await searchParams;
  const now = new Date();
  const fallback = new Date(now.getFullYear(), now.getMonth() - (now.getDate() <= 20 ? 1 : 0), 1);
  const [year, month] = mese && /^\d{4}-\d{2}$/.test(mese) ? mese.split("-").map(Number) : [fallback.getFullYear(), fallback.getMonth() + 1];

  const [data, settings, members] = await Promise.all([
    buildPayrollMonth({ barId: activeBarId, month, year, memberWhere: memberScopeWhere(staff) }),
    prisma.barSettings.findUnique({ where: { barId: activeBarId }, select: { consultantEmail: true, consultantName: true, payrollCodes: true } }),
    isOwner
      ? prisma.employeeBar.findMany({
          where: { barId: activeBarId, isActive: true },
          orderBy: { user: { lastName: "asc" } },
          select: { userId: true, payrollCode: true, contractWeeklyHours: true, user: { select: { firstName: true, lastName: true } }, bar: { select: { ownerId: true } } },
        })
      : Promise.resolve([]),
  ]);
  const codes = payrollCodesOf(settings?.payrollCodes);
  const months = Array.from({ length: 12 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - index, 1));
  const monthName = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
  const warnings = data.people.filter((person) => person.warnings.length).length;

  return (
    <div style={{ display: "grid", gap: 18, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 760, margin: "0 auto", width: "100%" }}>
      <header style={{ display: "grid", gap: 2, padding: "0 4px" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#7e22ce" }}>Presenze per il consulente</span>
        <h1 style={{ margin: 0, fontSize: 30, letterSpacing: "-0.03em", textTransform: "capitalize" }}>{monthName}</h1>
      </header>

      <nav aria-label="Mese" style={{ display: "flex", gap: 6, overflowX: "auto", padding: "0 2px 2px", scrollbarWidth: "none" }}>
        {months.map((date) => {
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          const active = date.getFullYear() === year && date.getMonth() + 1 === month;
          return (
            <Link
              key={key}
              href={`/dashboard/consulente?mese=${key}`}
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
              {new Intl.DateTimeFormat("it-IT", { month: "short" }).format(date)} {String(date.getFullYear()).slice(2)}
            </Link>
          );
        })}
      </nav>

      <RowsCard>
        <Row first style={{ gap: 10 }}>
          <Line
            left={`${data.people.length} ${data.people.length === 1 ? "persona" : "persone"} nel mese`}
            right={warnings ? <span style={{ color: "#b45309" }}>{warnings} da controllare</span> : <span style={{ color: "#0f7a4f" }}>tutto in ordine</span>}
          />
          <Line
            muted
            left="Un file Excel con riepilogo, foglio presenze e tracciato, più un CSV con le stesse righe da importare nel programma paghe."
          />
          <ExportButtons month={month} year={year} consultantEmail={settings?.consultantEmail ?? null} />
        </Row>
      </RowsCard>

      <section style={{ display: "grid", gap: 8 }}>
        <SectionLabel aside={`ore · ferie e malattia in giorni`}>Anteprima</SectionLabel>
        <RowsCard>
          {data.people.length ? (
            data.people.map((person, index) => (
              <Row key={person.userId} first={index === 0} rail={person.warnings.length ? "amber" : undefined}>
                <Line left={`${person.lastName} ${person.firstName}`} right={person.payrollCode ?? ""} muted={false} />
                <Line
                  muted
                  left={[
                    `${codes.ordinary} ${hours(person.totals.ordinary.hours)}`,
                    person.totals.overtime.hours ? `${codes.overtime} ${hours(person.totals.overtime.hours)}` : null,
                    person.totals.holiday.days ? `${codes.holiday} ${person.totals.holiday.days} gg` : null,
                    person.totals.leave.hours || person.totals.leave.days
                      ? `${codes.leave} ${person.totals.leave.hours ? `${hours(person.totals.leave.hours)} h` : `${person.totals.leave.days} gg`}`
                      : null,
                    person.totals.sickness.days ? `${codes.sickness} ${person.totals.sickness.days} gg` : null,
                    person.totals.publicHoliday.days ? `${codes.publicHoliday} ${person.totals.publicHoliday.days} gg` : null,
                    person.totals.closure.days ? `${codes.closure} ${person.totals.closure.days} gg` : null,
                    person.totals.training.hours || person.totals.training.days ? `${codes.training}` : null,
                    `${person.workedDays} giorni lavorati`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
                {person.warnings.map((warning) => (
                  <span key={warning} style={{ fontSize: 12.5, color: "#b45309" }}>
                    {warning}
                  </span>
                ))}
              </Row>
            ))
          ) : (
            <Row first>
              <Line muted left="Nessuna persona in questo mese." />
            </Row>
          )}
        </RowsCard>
      </section>

      {isOwner ? (
        <>
          <section style={{ display: "grid", gap: 8 }}>
            <SectionLabel>Consulente del lavoro e codici</SectionLabel>
            <RowsCard>
              <Row first>
                <ActionForm action={saveConsultantAction} success="Dati del consulente salvati" style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
                    <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#7c7894" }}>
                      Nome o studio
                      <input name="consultantName" defaultValue={settings?.consultantName ?? ""} placeholder="Studio Rossi" style={inputStyle} />
                    </label>
                    <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#7c7894" }}>
                      Email
                      <input name="consultantEmail" type="email" defaultValue={settings?.consultantEmail ?? ""} placeholder="paghe@studiorossi.it" style={inputStyle} />
                    </label>
                  </div>
                  <span style={{ fontSize: 12.5, color: "#7c7894" }}>
                    Le causali come le chiama il programma paghe del consulente: chiediglielo una volta e scrivile qui.
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                    {(Object.keys(PAYROLL_CODE_LABELS) as PayrollCodeKey[]).map((key) => (
                      <label key={key} style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#7c7894" }}>
                        {PAYROLL_CODE_LABELS[key]}
                        <input name={`code_${key}`} defaultValue={codes[key]} maxLength={12} style={{ ...inputStyle, textTransform: "uppercase" }} />
                      </label>
                    ))}
                  </div>
                  <div>
                    <PendingButton type="submit" style={softButton} pendingLabel="Salvo…">
                      Salva
                    </PendingButton>
                  </div>
                </ActionForm>
              </Row>
            </RowsCard>
          </section>

          <section style={{ display: "grid", gap: 8 }}>
            <SectionLabel aside="per separare ordinarie e straordinari">Matricole e ore di contratto</SectionLabel>
            <RowsCard>
              <Row first>
                <ActionForm action={savePayrollPeopleAction} success="Salvato" style={{ display: "grid", gap: 10 }}>
                  {members
                    .filter((member) => member.userId !== member.bar.ownerId)
                    .map((member) => (
                      <div key={member.userId} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr) 76px", gap: 8, alignItems: "center" }}>
                        <input type="hidden" name="userId" value={member.userId} />
                        <span style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {member.user.lastName} {member.user.firstName}
                        </span>
                        <input
                          name={`payrollCode_${member.userId}`}
                          defaultValue={member.payrollCode ?? ""}
                          placeholder="Matricola o CF"
                          aria-label={`Matricola di ${member.user.firstName}`}
                          style={{ ...inputStyle, textTransform: "uppercase" }}
                        />
                        <input
                          name={`weeklyHours_${member.userId}`}
                          defaultValue={member.contractWeeklyHours ?? ""}
                          inputMode="decimal"
                          placeholder="h/sett"
                          aria-label={`Ore settimanali di ${member.user.firstName}`}
                          style={{ ...inputStyle, textAlign: "right" }}
                        />
                      </div>
                    ))}
                  <span style={{ fontSize: 12.5, color: "#7c7894" }}>
                    Con le ore settimanali (40, 24…) le ore oltre il contratto della settimana diventano straordinari, e ferie e malattia hanno anche le ore del giorno.
                  </span>
                  <div>
                    <PendingButton type="submit" style={softButton} pendingLabel="Salvo…">
                      Salva
                    </PendingButton>
                  </div>
                </ActionForm>
              </Row>
            </RowsCard>
          </section>
        </>
      ) : null}
    </div>
  );
}
