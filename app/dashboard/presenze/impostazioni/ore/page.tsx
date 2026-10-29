import { prisma } from "@/lib/prisma";
import { Sheet } from "../../payroll-ui";
import { BreakFields, SourceSwitch } from "../../settings-controls";
import { GroupNote, ownerSettings, SettingsShell } from "../owner-page";

export const dynamic = "force-dynamic";

/** Where the month's hours come from: the clock-ins, or the shifts with their break. */
export default async function PayrollSourcePage() {
  const { barId, page } = await ownerSettings();
  if (!barId) return page;
  const settings = await prisma.barSettings.findUnique({
    where: { barId },
    select: { payrollSource: true, timeTrackingEnabled: true, payrollBreakMinutes: true, payrollBreakAfterHours: true },
  });
  const clocks = settings?.timeTrackingEnabled ?? true;
  const stored = settings?.payrollSource ?? "AUTO";
  const source: "CLOCK" | "SHIFTS" = stored === "CLOCK" || stored === "SHIFTS" ? stored : clocks ? "CLOCK" : "SHIFTS";

  return (
    <SettingsShell back="/dashboard/presenze/impostazioni" backLabel="Impostazioni" title="Da dove prendere le ore">
      <SourceSwitch value={source} />
      <GroupNote>
        {source === "SHIFTS"
          ? "Le ore dei turni pubblicati: se aggiungi, sposti o cancelli un turno, il mese cambia da solo. Non serve timbrare."
          : "Le ore timbrate, arrotondate con le regole del locale."}
      </GroupNote>
      {source === "SHIFTS" ? (
        <Sheet style={{ padding: 18, display: "grid", gap: 10 }}>
          <span style={{ fontSize: 16 }}>Pausa da togliere</span>
          <BreakFields minutes={settings?.payrollBreakMinutes ?? null} after={settings?.payrollBreakAfterHours ?? null} />
          <span style={{ fontSize: 13, color: "#8a85a3" }}>Solo se il contratto non paga la pausa.</span>
        </Sheet>
      ) : null}
    </SettingsShell>
  );
}
