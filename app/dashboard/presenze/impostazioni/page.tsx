import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Role } from "@prisma/client";
import { LAYOUT_LABELS, templateOf } from "@/lib/payroll/template";
import { prisma } from "@/lib/prisma";
import { BillingRequired } from "../../billing-required";
import { getDashboardContext } from "../../context";
import { EmptyState, Panel } from "../../ui";
import { Avatar, Card, initials, ROLE_LABELS } from "../payroll-ui";
import { BreakFields, OvertimeSwitch, PersonPayrollRow, SourceSwitch } from "../settings-controls";

export const dynamic = "force-dynamic";

const muted: CSSProperties = { fontSize: 13, color: "#6f6a88" };

function Step({ badge, done, title, hint, children, aside }: { badge: string; done: boolean; title: string; hint: string; children?: ReactNode; aside?: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: 16, alignItems: aside ? "center" : "flex-start" }}>
      {badge ? (
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            flex: "0 0 auto",
            background: done ? "#e2f6ed" : "#eeecfb",
            color: done ? "#0f7a4f" : "#4c1d95",
          }}
        >
          {done ? "✓" : badge}
        </span>
      ) : null}
      <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gap: 2 }}>
          <span style={{ fontSize: 15.5, fontWeight: 650 }}>{title}</span>
          <span style={muted}>{hint}</span>
        </div>
        {children}
      </div>
      {aside}
    </div>
  );
}

const primary: CSSProperties = {
  minHeight: 44,
  borderRadius: 999,
  background: "linear-gradient(135deg,#3b1d8f,#5e4ae3 55%,#8b5cf6)",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
};

/** Presenze settings in three steps: where the hours come from, who gets them, everyone's matricola. */
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
      select: { payrollSource: true, payrollBreakMinutes: true, payrollBreakAfterHours: true, payrollOvertime: true, timeTrackingEnabled: true },
    }),
    prisma.payrollRecipient.findMany({ where: { barId: activeBarId }, orderBy: { createdAt: "asc" } }),
    prisma.employeeBar.findMany({
      where: { barId: activeBarId, isActive: true },
      orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
      select: { userId: true, payrollCode: true, contractWeeklyHours: true, user: { select: { firstName: true, lastName: true, email: true } } },
    }),
    prisma.bar.findUnique({ where: { id: activeBarId }, select: { ownerId: true, activityType: true } }),
  ]);
  const clocks = settings?.timeTrackingEnabled ?? true;
  const stored = settings?.payrollSource ?? "AUTO";
  const source: "CLOCK" | "SHIFTS" = stored === "CLOCK" || stored === "SHIFTS" ? stored : clocks ? "CLOCK" : "SHIFTS";
  const overtime = settings?.payrollOvertime ?? bar?.activityType === "COMPANY";
  const people = members.filter((member) => member.userId !== bar?.ownerId);
  const complete = people.filter((member) => member.payrollCode && member.contractWeeklyHours).length;
  const nameCount = new Map<string, number>();
  for (const member of people) {
    const full = `${member.user.firstName} ${member.user.lastName}`.trim().toLowerCase();
    nameCount.set(full, (nameCount.get(full) ?? 0) + 1);
  }
  const steps = [true, recipients.length > 0, people.length > 0 && complete === people.length];
  const doneSteps = steps.filter(Boolean).length;

  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 760, margin: "0 auto", width: "100%" }}>
      <header style={{ display: "grid", gap: 6, padding: "0 4px" }}>
        <Link href="/dashboard/presenze" style={{ fontSize: 13.5, fontWeight: 700, color: "#5e4ae3", textDecoration: "none" }}>
          ‹ Presenze
        </Link>
        <h1 style={{ margin: 0, fontSize: 25, fontWeight: 750, letterSpacing: "-0.03em" }}>Impostazioni</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, height: 6, borderRadius: 3, background: "#e9e6f5", position: "relative", overflow: "hidden" }}>
            <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(doneSteps / 3) * 100}%`, background: "linear-gradient(90deg,#5e4ae3,#8b5cf6)" }} />
          </span>
          <span style={{ fontSize: 12.5, color: "#6f6a88" }}>Pronto per il consulente: {doneSteps} di 3</span>
        </div>
      </header>

      <Card>
        <Step
          badge="1"
          done
          title="Da dove prendere le ore"
          hint={
            source === "SHIFTS"
              ? "Dai turni pubblicati: se aggiungi, sposti o cancelli un turno, le ore cambiano da sole."
              : "Dalle timbrature, arrotondate con le regole del locale."
          }
        >
          <SourceSwitch value={source} />
          {source === "SHIFTS" ? <BreakFields minutes={settings?.payrollBreakMinutes ?? null} after={settings?.payrollBreakAfterHours ?? null} /> : null}
        </Step>
      </Card>

      <Card>
        <Step
          badge=""
          done
          title="Conta gli straordinari"
          hint={
            overtime
              ? "Acceso: le ore oltre il contratto della settimana diventano straordinari, nel mese e nel file del consulente."
              : "Spento: un turno che si allunga resta ore normali, come in quasi tutti i bar e ristoranti."
          }
          aside={<OvertimeSwitch value={overtime} />}
        />
      </Card>

      <Card>
        <Step badge="2" done={recipients.length > 0} title="A chi mandarle" hint="Il consulente del lavoro, il commercialista o tutti e due. Il file lo imposti come lo vuole lui.">
          {recipients.length ? (
            <div style={{ display: "grid", border: "1px solid #f1eff8", borderRadius: 14, overflow: "hidden" }}>
              {recipients.map((recipient, index) => {
                const template = templateOf(recipient.template);
                const words = recipient.name.split(/\s+/).filter(Boolean);
                return (
                  <Link
                    key={recipient.id}
                    href={`/dashboard/presenze/destinatario/${recipient.id}`}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderTop: index ? "1px solid #f1eff8" : undefined, color: "#1f1b3a", textDecoration: "none" }}
                  >
                    <Avatar text={initials(words[0] ?? "", words[1] ?? "")} tone="blue" size={32} />
                    <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
                      <span style={{ fontSize: 15 }}>{recipient.name}</span>
                      <span style={{ fontSize: 12.5, color: "#6f6a88" }}>
                        {ROLE_LABELS[recipient.role] ?? ""} · {LAYOUT_LABELS[template.layout].title.toLowerCase()}, {template.fileType === "csv" ? "CSV" : "Excel"}
                      </span>
                    </span>
                    <span style={{ color: "#b7b2cc" }}>›</span>
                  </Link>
                );
              })}
            </div>
          ) : null}
          <Link
            href="/dashboard/presenze/destinatario/nuovo"
            style={recipients.length ? { ...primary, background: "#f6f3ff", color: "#4c1d95", border: "1px solid #ddd6fe" } : primary}
          >
            {recipients.length ? "Aggiungi un altro" : "Aggiungi il consulente"}
          </Link>
        </Step>
      </Card>

      <Card>
        <div style={{ paddingBottom: 6 }}>
          <Step badge="3" done={steps[2]} title="Le persone" hint={`Matricola e ore di contratto, per il file del consulente: ${complete} di ${people.length} complete.`} />
        </div>
        {people.map((member) => {
          const full = `${member.user.firstName} ${member.user.lastName}`.trim();
          const twin = (nameCount.get(full.toLowerCase()) ?? 0) > 1;
          return (
            <PersonPayrollRow
              key={member.userId}
              userId={member.userId}
              name={full}
              detail={twin ? member.user.email : null}
              initials={initials(member.user.firstName, member.user.lastName)}
              payrollCode={member.payrollCode}
              weeklyHours={member.contractWeeklyHours}
            />
          );
        })}
      </Card>

      <span style={{ textAlign: "center", fontSize: 12, color: "#6f6a88", padding: "0 20px" }}>Ogni campo si salva da solo appena lo cambi.</span>
    </div>
  );
}
