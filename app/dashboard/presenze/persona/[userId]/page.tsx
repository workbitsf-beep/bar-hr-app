import Link from "next/link";
import { Role } from "@prisma/client";
import { defaultPayrollMonth, parseMonthKey } from "@/lib/payroll/access";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/staff-permissions";
import { memberScopeWhere } from "@/lib/staff-scope";
import { BillingRequired } from "../../../billing-required";
import { getDashboardContext } from "../../../context";
import { EmptyState, Panel } from "../../../ui";
import { MonthChips } from "../../payroll-ui";
import { PersonMonth } from "../../person-month";

export const dynamic = "force-dynamic";

/** One person's month in Presenze: their days, clock-ins to fix, the file to correct, the PDF. */
export default async function PersonPresencePage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ mese?: string }>;
}) {
  const { session, role, staff, activeBarId, billingStatus, features } = await getDashboardContext();
  if (!activeBarId) {
    return (
      <Panel title="Presenze">
        <EmptyState message="Seleziona un locale." />
      </Panel>
    );
  }
  if (billingStatus && !billingStatus.canAccess) return <BillingRequired role={String(role)} />;

  const { userId } = await params;
  const isOwner = role === Role.OWNER;
  const isSelf = userId === session.user.id;
  const canStamps = isOwner || can(staff, "timelogs");
  const canReports = isOwner || can(staff, "reports");

  const member = await prisma.employeeBar.findFirst({
    where: { barId: activeBarId, userId, ...(isOwner || isSelf ? {} : memberScopeWhere(staff)) },
    select: { user: { select: { firstName: true, lastName: true } } },
  });
  if (!member || (!isSelf && !canStamps && !canReports)) {
    return (
      <Panel title="Presenze">
        <EmptyState message="Non puoi vedere le presenze di questa persona." />
      </Panel>
    );
  }

  const { mese } = await searchParams;
  const today = new Date();
  const { year, month } =
    parseMonthKey(mese) ?? (today.getDate() <= 5 && !isSelf ? defaultPayrollMonth(today) : { year: today.getFullYear(), month: today.getMonth() + 1 });

  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 760, margin: "0 auto", width: "100%" }}>
      <header style={{ display: "grid", gap: 4, padding: "0 4px" }}>
        <Link href={`/dashboard/presenze?mese=${year}-${String(month).padStart(2, "0")}`} style={{ fontSize: 13, fontWeight: 700, color: "#6d5ce7", textDecoration: "none" }}>
          ‹ Presenze
        </Link>
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: "-0.03em" }}>
          {member.user.firstName} {member.user.lastName}
        </h1>
      </header>
      <MonthChips base={`/dashboard/presenze/persona/${userId}`} year={year} month={month} />
      <PersonMonth
        barId={activeBarId}
        userId={userId}
        year={year}
        month={month}
        // Staff never fix their own hours: the owner does.
        canFixStamps={canStamps && (isOwner || !isSelf)}
        canCorrectFile={canReports}
        canPdf={features.reports && (canReports || isSelf)}
        timeTracking={features.timeTracking}
      />
    </div>
  );
}
