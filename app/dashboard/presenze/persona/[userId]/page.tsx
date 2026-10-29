import Link from "next/link";
import { Role } from "@prisma/client";
import { defaultPayrollMonth, parseMonthKey } from "@/lib/payroll/access";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/staff-permissions";
import { memberScopeWhere } from "@/lib/staff-scope";
import { BillingRequired } from "../../../billing-required";
import { getDashboardContext } from "../../../context";
import { EmptyState, Panel } from "../../../ui";
import { MonthMenu } from "../../payroll-ui";
import { PdfButton } from "../../pdf-button";
import { PersonMonth } from "../../person-month";
import { roundWhite } from "../../../round-button";

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
      select: { user: { select: { firstName: true, lastName: true } } },
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
  const inNow = features.timeTracking && lastStamp?.type === "IN";
  const canPdf = features.reports && (canReports || isSelf);
  const base = `/dashboard/presenze/persona/${userId}`;

  return (
    <div style={{ display: "grid", gap: 20, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 640, margin: "0 auto", width: "100%", padding: "4px 4px 8px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Link href={`/dashboard/presenze?mese=${year}-${String(month).padStart(2, "0")}`} style={{ fontSize: 15, fontWeight: 600, color: "#5e4ae3", textDecoration: "none" }}>
          ‹ Presenze
        </Link>
        {canPdf ? (
          <details style={{ position: "relative" }}>
            <summary
              aria-label="Altro"
              style={{ ...roundWhite, listStyle: "none", fontSize: 20, cursor: "pointer" }}
            >
              ⋯
            </summary>
            <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 30, background: "#ffffff", borderRadius: 16, boxShadow: "0 18px 40px rgba(31,27,58,.16)", padding: 6, minWidth: 190 }}>
              <PdfButton
                userId={userId}
                month={month}
                year={year}
                style={{ border: 0, background: "transparent", width: "100%", textAlign: "left", padding: "11px 12px", borderRadius: 12, fontSize: 15, color: "#1f1b3a", cursor: "pointer" }}
              />
            </div>
          </details>
        ) : null}
      </div>
      <header style={{ display: "grid", gap: 4 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 750, letterSpacing: "-0.03em" }}>{name}</h1>
        {inNow ? <span style={{ fontSize: 14, color: "#0f7a4f" }}>In lavoro dalle {clock.format(lastStamp!.timestamp)}</span> : null}
      </header>
      <MonthMenu base={base} year={year} month={month} />
      <PersonMonth
        barId={activeBarId}
        userId={userId}
        personName={name}
        year={year}
        month={month}
        // Staff never fix their own hours: the owner does.
        canFixStamps={canStamps && (isOwner || !isSelf)}
        canCorrectFile={canReports}
        canPdf={canPdf}
        timeTracking={features.timeTracking}
      />
    </div>
  );
}
