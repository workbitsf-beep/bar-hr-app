import Link from "next/link";
import { Role } from "@prisma/client";
import { ActionForm } from "@/app/components/action-form";
import { PendingButton } from "@/app/components/pending-button";
import { LAYOUT_LABELS, templateOf } from "@/lib/payroll/template";
import { prisma } from "@/lib/prisma";
import { BillingRequired } from "../../billing-required";
import { getDashboardContext } from "../../context";
import { Line, Row, RowsCard, SectionLabel, softButton } from "../../costi/cost-ui";
import { EmptyState, Panel } from "../../ui";
import { savePayrollPeopleAction, saveSourceAction } from "../actions";
import { fieldLabel, inputStyle, ROLE_LABELS } from "../payroll-ui";

export const dynamic = "force-dynamic";

/** Where the hours come from, who the month goes to, and everyone's matricola and contract. */
export default async function PayrollSettingsPage() {
  const { role, activeBarId, billingStatus } = await getDashboardContext();
  if (!activeBarId) {
    return (
      <Panel title="Impostazioni presenze">
        <EmptyState message="Seleziona un locale." />
      </Panel>
    );
  }
  if (billingStatus && !billingStatus.canAccess) return <BillingRequired role={String(role)} />;
  if (role !== Role.OWNER) {
    return (
      <Panel title="Impostazioni presenze">
        <EmptyState message="Queste impostazioni sono del titolare." />
      </Panel>
    );
  }

  const [settings, recipients, members, bar] = await Promise.all([
    prisma.barSettings.findUnique({
      where: { barId: activeBarId },
      select: { payrollSource: true, payrollBreakMinutes: true, payrollBreakAfterHours: true, timeTrackingEnabled: true },
    }),
    prisma.payrollRecipient.findMany({ where: { barId: activeBarId }, orderBy: { createdAt: "asc" } }),
    prisma.employeeBar.findMany({
      where: { barId: activeBarId, isActive: true },
      orderBy: { user: { lastName: "asc" } },
      select: { userId: true, payrollCode: true, contractWeeklyHours: true, user: { select: { firstName: true, lastName: true } } },
    }),
    prisma.bar.findUnique({ where: { id: activeBarId }, select: { ownerId: true } }),
  ]);
  const source = settings?.payrollSource ?? "AUTO";
  const clocks = settings?.timeTrackingEnabled ?? true;

  return (
    <div style={{ display: "grid", gap: 18, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 760, margin: "0 auto", width: "100%" }}>
      <header style={{ display: "grid", gap: 4, padding: "0 4px" }}>
        <Link href="/dashboard/consulente" style={{ fontSize: 13, fontWeight: 700, color: "#6d5ce7", textDecoration: "none" }}>
          ‹ Presenze per il consulente
        </Link>
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: "-0.03em" }}>Impostazioni</h1>
      </header>

      <section style={{ display: "grid", gap: 8 }}>
        <SectionLabel>A chi le mandi</SectionLabel>
        <RowsCard>
          {recipients.map((recipient, index) => {
            const template = templateOf(recipient.template);
            return (
              <Link key={recipient.id} href={`/dashboard/consulente/destinatario/${recipient.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                <Row first={index === 0}>
                  <Line left={recipient.name} right={<span style={{ color: "#6d5ce7" }}>Modifica ›</span>} />
                  <Line
                    muted
                    left={`${ROLE_LABELS[recipient.role] ?? ""} · ${recipient.email} · ${LAYOUT_LABELS[template.layout].title.toLowerCase()}, ${template.fileType === "csv" ? "CSV" : "Excel"}${recipient.sendDay ? ` · promemoria il ${recipient.sendDay}` : ""}`}
                  />
                </Row>
              </Link>
            );
          })}
          <Row first={!recipients.length}>
            <div>
              <Link href="/dashboard/consulente/destinatario/nuovo" style={{ ...softButton, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                {recipients.length ? "Aggiungi un altro" : "Aggiungi il consulente o il commercialista"}
              </Link>
            </div>
          </Row>
        </RowsCard>
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        <SectionLabel>Da dove prendere le ore</SectionLabel>
        <RowsCard>
          <Row first>
            <ActionForm action={saveSourceAction} success="Salvato" style={{ display: "grid", gap: 10 }}>
              {[
                {
                  value: "AUTO",
                  title: "In automatico",
                  hint: clocks ? "Ora dalle timbrature, perché il locale timbra." : "Ora dai turni, perché il locale non timbra.",
                },
                { value: "CLOCK", title: "Dalle timbrature", hint: "Le ore timbrate, arrotondate con le regole del locale." },
                {
                  value: "SHIFTS",
                  title: "Dai turni del calendario",
                  hint: "Le ore dei turni pubblicati. Se aggiungi, sposti o cancelli un turno, il file cambia da solo: non serve timbrare.",
                },
              ].map((option) => (
                <label key={option.value} style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: 10, alignItems: "start", cursor: "pointer" }}>
                  <input type="radio" name="source" value={option.value} defaultChecked={source === option.value} style={{ marginTop: 3 }} />
                  <span style={{ display: "grid", gap: 2 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 700 }}>{option.title}</span>
                    <span style={{ fontSize: 12.5, color: "#7c7894" }}>{option.hint}</span>
                  </span>
                </label>
              ))}
              <span style={{ fontSize: 12.5, color: "#7c7894", paddingTop: 4 }}>Dai turni: la pausa da togliere, se il contratto non la paga.</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                <label style={fieldLabel}>
                  Pausa (minuti)
                  <input name="breakMinutes" inputMode="numeric" defaultValue={settings?.payrollBreakMinutes ?? ""} placeholder="0" style={inputStyle} />
                </label>
                <label style={fieldLabel}>
                  Per turni di almeno (ore)
                  <input name="breakAfterHours" inputMode="decimal" defaultValue={settings?.payrollBreakAfterHours ?? ""} placeholder="6" style={inputStyle} />
                </label>
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
                .filter((member) => member.userId !== bar?.ownerId)
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
    </div>
  );
}
