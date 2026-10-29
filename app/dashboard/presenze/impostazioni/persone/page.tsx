import { prisma } from "@/lib/prisma";
import { initials, Sheet } from "../../payroll-ui";
import { PersonPayrollRow } from "../../settings-controls";
import { GroupNote, ownerSettings, SettingsShell } from "../owner-page";

export const dynamic = "force-dynamic";

/** Everyone's matricola and contract hours, one row each, saved as they are typed. */
export default async function PayrollPeoplePage() {
  const { barId, page } = await ownerSettings();
  if (!barId) return page;
  const [members, bar] = await Promise.all([
    prisma.employeeBar.findMany({
      where: { barId, isActive: true },
      orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
      select: { userId: true, payrollCode: true, contractWeeklyHours: true, user: { select: { firstName: true, lastName: true, email: true } } },
    }),
    prisma.bar.findUnique({ where: { id: barId }, select: { ownerId: true } }),
  ]);
  const people = members.filter((member) => member.userId !== bar?.ownerId);
  const nameCount = new Map<string, number>();
  for (const member of people) {
    const full = `${member.user.firstName} ${member.user.lastName}`.trim().toLowerCase();
    nameCount.set(full, (nameCount.get(full) ?? 0) + 1);
  }

  return (
    <SettingsShell back="/dashboard/presenze/impostazioni" backLabel="Impostazioni" title="Matricole e contratti">
      <GroupNote>Per il file del consulente. Ogni campo si salva appena lo lasci.</GroupNote>
      <Sheet>
        <div style={{ marginTop: -1 }}>
          {people.map((member) => {
            const full = `${member.user.firstName} ${member.user.lastName}`.trim();
            return (
              <PersonPayrollRow
                key={member.userId}
                userId={member.userId}
                name={full}
                detail={(nameCount.get(full.toLowerCase()) ?? 0) > 1 ? member.user.email : null}
                initials={initials(member.user.firstName, member.user.lastName)}
                payrollCode={member.payrollCode}
                weeklyHours={member.contractWeeklyHours}
              />
            );
          })}
        </div>
      </Sheet>
    </SettingsShell>
  );
}
