import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../context";
import { BillingRequiredState, EmptyState, Panel } from "../ui";
import { ExportClient } from "./export-client";

export default async function DashboardExportPage() {
  const { session, role, activeBarId, billingStatus } = await getDashboardContext();

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

  const employees = await prisma.employeeBar.findMany({
    where: {
      barId: activeBarId,
      isActive: true,
      ...(role === Role.OWNER ? {} : { userId: session.user.id }),
    },
    orderBy: {
      hiredAt: "desc",
    },
    include: {
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
        defaultMonth={now.getMonth() + 1}
        defaultYear={now.getFullYear()}
        allowEmployeeSelection={role === Role.OWNER}
      />
    </>
  );
}
