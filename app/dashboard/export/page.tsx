import { ActivityType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../context";
import { BillingRequiredState, EmptyState, Panel } from "../ui";
import { ExportClient } from "./export-client";

export default async function DashboardExportPage() {
  const { session, role, activeBarId, activeBarActivityType, billingStatus, features } =
    await getDashboardContext();

  if (!activeBarId) {
    return (
      <Panel title="Export PDF">
        <EmptyState message="Seleziona un locale attivo per generare i PDF mensili." />
      </Panel>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return <BillingRequiredState role={String(role)} />;
  }

  if (!features.reports) {
    return (
      <Panel title="Export PDF">
        <EmptyState message="Modulo report disattivato nelle impostazioni." />
      </Panel>
    );
  }

  const canSelectEmployees =
    role === Role.OWNER ||
    (role === Role.AMMINISTRAZIONE && activeBarActivityType === ActivityType.COMPANY);

  const employees = await prisma.employeeBar.findMany({
    where: {
      barId: activeBarId,
      isActive: true,
      ...(canSelectEmployees ? {} : { userId: session.user.id }),
    },
    orderBy: {
      hiredAt: "desc",
    },
    select: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  const now = new Date();

  return (
    <>
      <ExportClient
        employees={employees.map((employee) => ({
          id: employee.user.id,
          label: `${employee.user.firstName} ${employee.user.lastName}`,
          email: employee.user.email,
        }))}
        activityType={activeBarActivityType}
        defaultMonth={now.getMonth() + 1}
        defaultYear={now.getFullYear()}
        allowEmployeeSelection={canSelectEmployees}
        allowGeneralReport={canSelectEmployees && activeBarActivityType === ActivityType.COMPANY}
      />
    </>
  );
}
