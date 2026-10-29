import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Sheet } from "../payroll-ui";
import { OvertimeSwitch } from "../settings-controls";
import { GroupLabel, GroupNote, ownerSettings, settingsRow, SettingsShell } from "./owner-page";

export const dynamic = "force-dynamic";

const value = { marginLeft: "auto", color: "#8a85a3", fontSize: 15 } as const;
const chev = <span style={{ color: "#c4c0d6", fontSize: 18 }}>›</span>;

/** Presenze settings as a list: each row says where things stand and opens its own page. */
export default async function PayrollSettingsPage() {
  const { barId, page } = await ownerSettings();
  if (!barId) return page;

  const [settings, recipients, members, bar] = await Promise.all([
    prisma.barSettings.findUnique({ where: { barId }, select: { payrollSource: true, payrollOvertime: true, timeTrackingEnabled: true, payrollBreakMinutes: true } }),
    prisma.payrollRecipient.findMany({ where: { barId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, sendDay: true } }),
    prisma.employeeBar.findMany({ where: { barId, isActive: true }, select: { userId: true, payrollCode: true, contractWeeklyHours: true } }),
    prisma.bar.findUnique({ where: { id: barId }, select: { ownerId: true, activityType: true } }),
  ]);
  const clocks = settings?.timeTrackingEnabled ?? true;
  const stored = settings?.payrollSource ?? "AUTO";
  const source = stored === "CLOCK" || stored === "SHIFTS" ? stored : clocks ? "CLOCK" : "SHIFTS";
  const overtime = settings?.payrollOvertime ?? bar?.activityType === "COMPANY";
  const people = members.filter((member) => member.userId !== bar?.ownerId);
  const complete = people.filter((member) => member.payrollCode && member.contractWeeklyHours).length;

  return (
    <SettingsShell back="/dashboard/presenze" backLabel="Presenze" title="Impostazioni">
      <GroupLabel>Le ore</GroupLabel>
      <Sheet>
        <Link href="/dashboard/presenze/impostazioni/ore" style={{ ...settingsRow, borderTop: 0 }}>
          <span>Da dove</span>
          <span style={value}>
            {source === "SHIFTS" ? "Turni del calendario" : "Timbrature"}
            {source === "SHIFTS" && settings?.payrollBreakMinutes ? ` · pausa ${settings.payrollBreakMinutes} min` : ""}
          </span>
          {chev}
        </Link>
        <div style={settingsRow}>
          <span style={{ flex: 1 }}>Conta gli straordinari</span>
          <OvertimeSwitch value={overtime} />
        </div>
      </Sheet>
      <GroupNote>{overtime ? "Le ore oltre il contratto della settimana sono straordinari." : "Un turno che si allunga resta ore normali."}</GroupNote>

      <GroupLabel>Il consulente</GroupLabel>
      <Sheet>
        {recipients.map((recipient, index) => (
          <Link key={recipient.id} href={`/dashboard/presenze/destinatario/${recipient.id}`} style={{ ...settingsRow, borderTop: index ? settingsRow.borderTop : 0 }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{recipient.name}</span>
            <span style={value}>{recipient.sendDay ? `il ${recipient.sendDay} del mese` : ""}</span>
            {chev}
          </Link>
        ))}
        <Link href="/dashboard/presenze/destinatario/nuovo" style={{ ...settingsRow, borderTop: recipients.length ? settingsRow.borderTop : 0 }}>
          <span style={{ color: "#5e4ae3", fontWeight: 600 }}>{recipients.length ? "Aggiungi un altro" : "Aggiungi il consulente"}</span>
          <span style={{ marginLeft: "auto" }}>{chev}</span>
        </Link>
      </Sheet>

      <GroupLabel>Per il file</GroupLabel>
      <Sheet>
        <Link href="/dashboard/presenze/impostazioni/persone" style={{ ...settingsRow, borderTop: 0 }}>
          <span>Matricole e contratti</span>
          <span style={{ ...value, color: complete < people.length ? "#b45309" : "#8a85a3" }}>
            {complete} di {people.length}
          </span>
          {chev}
        </Link>
      </Sheet>
    </SettingsShell>
  );
}
