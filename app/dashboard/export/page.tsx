import { BillingRequired } from "../billing-required";
import { ActivityType } from "@prisma/client";
import { can } from "@/lib/staff-permissions";
import { memberScopeWhere } from "@/lib/staff-scope";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../context";
import { ReportAside } from "../desktop-asides";
import { EmptyState, Panel } from "../ui";
import { ExportClient } from "./export-client";

export default async function DashboardExportPage() {
  const { session, role, staff, activeBarId, activeBarActivityType, billingStatus, features } =
    await getDashboardContext();

  if (!activeBarId) {
    return (
      <Panel title="Export PDF">
        <EmptyState message="Seleziona un locale attivo per generare i PDF mensili." />
      </Panel>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return <BillingRequired role={String(role)} />;
  }

  if (!features.reports) {
    return (
      <Panel title="Export PDF">
        <EmptyState message="Modulo report disattivato nelle impostazioni." />
      </Panel>
    );
  }

  // "Report ore": over the people of the departments or sites they cover.
  const canSelectEmployees = can(staff, "reports");

  const employees = await prisma.employeeBar.findMany({
    where: {
      barId: activeBarId,
      isActive: true,
      ...(canSelectEmployees ? memberScopeWhere(staff) : { userId: session.user.id }),
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
    <div className="wb-desk-split">
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
      <aside className="wb-desk-only">
        <ReportAside barId={activeBarId} userId={session.user.id} staff={staff} />
      </aside>
    </div>
  );
}
