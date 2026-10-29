import Link from "next/link";
import { Role } from "@prisma/client";
import { defaultPayrollMonth, parseMonthKey } from "@/lib/payroll/access";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/staff-permissions";
import { memberScopeWhere } from "@/lib/staff-scope";
import { BillingRequired } from "../../../billing-required";
import { getDashboardContext } from "../../../context";
import { EmptyState, Panel } from "../../../ui";
import { Avatar, initials } from "../../payroll-ui";
import { PersonMonth } from "../../person-month";

export const dynamic = "force-dynamic";

const clock = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

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

  const [member, lastStamp] = await Promise.all([
    prisma.employeeBar.findFirst({
      where: { barId: activeBarId, userId, ...(isOwner || isSelf ? {} : memberScopeWhere(staff)) },
      select: { contractWeeklyHours: true, user: { select: { firstName: true, lastName: true } } },
    }),
    prisma.timeLog.findFirst({
      where: { barId: activeBarId, userId, timestamp: { gte: new Date(Date.now() - 16 * 3_600_000) } },
      orderBy: { timestamp: "desc" },
      select: { type: true, timestamp: true },
    }),
  ]);
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
  const name = `${member.user.firstName} ${member.user.lastName}`.trim();
  const status =
    features.timeTracking && lastStamp?.type === "IN"
      ? `In lavoro dalle ${clock.format(lastStamp.timestamp)}`
      : member.contractWeeklyHours
        ? `Contratto ${member.contractWeeklyHours.toLocaleString("it-IT")} h a settimana`
        : null;

  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 760, margin: "0 auto", width: "100%" }}>
      <header style={{ display: "grid", gap: 8, padding: "0 4px" }}>
        <Link href={`/dashboard/presenze?mese=${year}-${String(month).padStart(2, "0")}`} style={{ fontSize: 13.5, fontWeight: 700, color: "#5e4ae3", textDecoration: "none" }}>
          ‹ Presenze
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar text={initials(member.user.firstName, member.user.lastName)} size={44} />
          <div style={{ display: "grid", gap: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 25, fontWeight: 750, letterSpacing: "-0.03em" }}>{name}</h1>
            {status ? (
              <span style={{ fontSize: 13, color: lastStamp?.type === "IN" && features.timeTracking ? "#0f7a4f" : "#6f6a88" }}>{status}</span>
            ) : null}
          </div>
        </div>
      </header>
      <PersonMonth
        barId={activeBarId}
        userId={userId}
        personName={name}
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
