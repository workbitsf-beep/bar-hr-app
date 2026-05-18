import Link from "next/link";
import { RequestStatus, RequestType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../context";
import { ClockActionsPanel } from "../timelogs/timelogs-client";
import { BillingRequiredState, EmptyState, Panel, PrimaryButton, StatusPill } from "../ui";
import { OwnerCalendarClient } from "./owner-calendar-client";
import { PublishWeekPanel } from "./publish-week-panel";

function getLocale(language: string) {
  if (language === "en") {
    return "en-US";
  }

  if (language === "es") {
    return "es-ES";
  }

  if (language === "fr") {
    return "fr-FR";
  }

  return "it-IT";
}

function parseMonth(searchParams?: Record<string, string | string[] | undefined>) {
  const now = new Date();
  const monthRaw = Array.isArray(searchParams?.month)
    ? searchParams.month[0]
    : searchParams?.month;
  const yearRaw = Array.isArray(searchParams?.year)
    ? searchParams.year[0]
    : searchParams?.year;
  const month = Number(monthRaw ?? now.getMonth() + 1);
  const year = Number(yearRaw ?? now.getFullYear());

  const safeMonth =
    Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1;
  const safeYear =
    Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : now.getFullYear();

  return { month: safeMonth, year: safeYear };
}

function startOfCalendarMonth(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const day = firstDay.getDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - mondayOffset);
  start.setHours(0, 0, 0, 0);
  return start;
}

function endOfCalendarMonth(year: number, month: number) {
  const start = startOfCalendarMonth(year, month);
  const end = new Date(start);
  end.setDate(start.getDate() + 41);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getMonthNavigation(year: number, month: number) {
  const prev = new Date(year, month - 2, 1);
  const next = new Date(year, month, 1);

  return {
    prev: { year: prev.getFullYear(), month: prev.getMonth() + 1 },
    next: { year: next.getFullYear(), month: next.getMonth() + 1 },
  };
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function DashboardCalendarPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const { role, language, activeBarId, billingStatus } = await getDashboardContext();

  if (!activeBarId) {
    return (
      <Panel title="Calendario">
        <EmptyState message="Seleziona un locale attivo per visualizzare il calendario turni." />
      </Panel>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return <BillingRequiredState role={String(role)} />;
  }

  const locale = getLocale(language);
  const { month, year } = parseMonth(params);
  const calendarStart = startOfCalendarMonth(year, month);
  const calendarEnd = endOfCalendarMonth(year, month);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const navigation = getMonthNavigation(year, month);

  const [settings, shifts, availabilities, approvedRequests, ownerMembers] = await Promise.all([
    role === Role.OWNER
      ? Promise.resolve(null)
      : prisma.barSettings.findUnique({
          where: { barId: activeBarId },
          select: {
            gpsLatitude: true,
            gpsLongitude: true,
            gpsRadius: true,
            roundingEnabled: true,
            roundingMinutes: true,
            roundingMode: true,
          },
        }),
    prisma.shift.findMany({
      where: {
        barId: activeBarId,
        startTime: {
          lte: calendarEnd,
        },
        endTime: {
          gte: calendarStart,
        },
      },
      orderBy: {
        startTime: "asc",
      },
      include: {
        confirmedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    }),
    prisma.availability.findMany({
      where: {
        barId: activeBarId,
        startsAt: {
          lte: calendarEnd,
        },
        endsAt: {
          gte: calendarStart,
        },
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        startsAt: "asc",
      },
    }),
    prisma.request.findMany({
      where: {
        barId: activeBarId,
        type: {
          in: [RequestType.VACATION, RequestType.PERMISSION],
        },
        status: RequestStatus.APPROVED,
        startsAt: {
          lte: calendarEnd,
        },
        endsAt: {
          gte: calendarStart,
        },
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        startsAt: "asc",
      },
    }),
    role === Role.OWNER
      ? prisma.employeeBar.findMany({
          where: {
            barId: activeBarId,
            isActive: true,
            role: {
              not: Role.OWNER,
            },
          },
          orderBy: [{ role: "asc" }, { hiredAt: "asc" }],
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    date.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return {
      date,
      shifts: shifts.filter((shift) => shift.startTime <= dayEnd && shift.endTime >= date),
      availabilities: availabilities.filter(
        (availability) => availability.startsAt <= dayEnd && availability.endsAt >= date
      ),
      requests: approvedRequests.filter(
        (request) => (request.startsAt ?? date) <= dayEnd && (request.endsAt ?? date) >= date
      ),
    };
  });

  const weekdayLabels = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(2026, 0, 5 + index);
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  });

  const serializedDays = days.map((day) => ({
    date: day.date.toISOString(),
    isToday: day.date.toDateString() === new Date().toDateString(),
    inCurrentMonth: day.date >= monthStart && day.date <= monthEnd,
    shifts: day.shifts.map((shift) => ({
      id: shift.id,
      title: shift.title,
      startTime: shift.startTime.toISOString(),
      endTime: shift.endTime.toISOString(),
      confirmedAt: shift.confirmedAt?.toISOString() ?? null,
      assignments: shift.assignments.map((assignment) => ({
        id: assignment.user.id,
        firstName: assignment.user.firstName,
        lastName: assignment.user.lastName,
      })),
    })),
    availabilities: day.availabilities.map((availability) => ({
      id: availability.id,
      firstName: availability.user.firstName,
      lastName: availability.user.lastName,
    })),
    requests: day.requests.map((request) => ({
      id: request.id,
      type: request.type,
      firstName: request.employee.firstName,
      lastName: request.employee.lastName,
    })),
  }));

  const memberOptions = ownerMembers.map((member) => ({
    id: member.user.id,
    firstName: member.user.firstName,
    lastName: member.user.lastName,
    role: member.role,
  }));
  const unconfirmedShiftCount = shifts.filter((shift) => !shift.confirmedAt).length;
  const weekOptions = Array.from({ length: 6 }, (_, index) => {
    const start = new Date(calendarStart);
    start.setDate(calendarStart.getDate() + index * 7);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    const pendingCount = shifts.filter(
      (shift) => !shift.confirmedAt && shift.startTime <= end && shift.endTime >= start
    ).length;

    return {
      start: toLocalDateKey(start),
      label: `${new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
      }).format(start)} - ${new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
      }).format(end)}`,
      pendingCount,
    };
  });
  const now = new Date();
  const defaultWeekStart =
    weekOptions.find((week) => {
      const weekStart = new Date(`${week.start}T00:00:00`);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      return now >= weekStart && now <= weekEnd;
    })?.start ??
    weekOptions.find((week) => week.pendingCount > 0)?.start ??
    weekOptions[0]?.start ??
    "";

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {role !== Role.OWNER ? <ClockActionsPanel role={role} settings={settings} compact /> : null}

      {(role === Role.OWNER || role === Role.MANAGER) ? (
        <Panel
          title="Invio turni"
          action={unconfirmedShiftCount === 0 ? "Tutti inviati" : `${unconfirmedShiftCount} da inviare`}
        >
          <PublishWeekPanel weeks={weekOptions} defaultWeekStart={defaultWeekStart} />
        </Panel>
      ) : null}

      <Panel
        title={new Intl.DateTimeFormat(locale, {
          month: "long",
          year: "numeric",
        }).format(monthStart)}
        action={
          <div className="dashboard-inline-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href={`/dashboard/calendar?month=${navigation.prev.month}&year=${navigation.prev.year}`}
              style={{ textDecoration: "none" }}
            >
              <PrimaryButton type="button" tone="sand">
                {"<"}
              </PrimaryButton>
            </Link>
            <Link href="/dashboard/calendar" style={{ textDecoration: "none" }}>
              <PrimaryButton type="button" tone="sand">
                Oggi
              </PrimaryButton>
            </Link>
            <Link
              href={`/dashboard/calendar?month=${navigation.next.month}&year=${navigation.next.year}`}
              style={{ textDecoration: "none" }}
            >
              <PrimaryButton type="button" tone="sand">
                {">"}
              </PrimaryButton>
            </Link>
          </div>
        }
      >
        {role === Role.OWNER ? (
          <OwnerCalendarClient
            locale={locale}
            weekdayLabels={weekdayLabels}
            days={serializedDays}
            members={memberOptions}
          />
        ) : (
          <div className="dashboard-calendar-scroll">
            <div
              className="dashboard-calendar-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                gap: 12,
              }}
            >
              {weekdayLabels.map((label) => (
                <div
                  key={label}
                  className="dashboard-calendar-weekday"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 16,
                    background: "#e2e8f0",
                    color: "#334155",
                    fontWeight: 700,
                    textTransform: "capitalize",
                    textAlign: "center",
                  }}
                >
                  {label}
                </div>
              ))}

              {days.map((day) => {
                const inCurrentMonth = day.date >= monthStart && day.date <= monthEnd;
                const isToday = day.date.toDateString() === new Date().toDateString();

                return (
                  <div
                    key={day.date.toISOString()}
                    className="dashboard-calendar-day"
                    style={{
                      minHeight: 220,
                      padding: 14,
                      borderRadius: 20,
                      background: inCurrentMonth ? "#ffffff" : "#f8fafc",
                      border: isToday ? "2px solid #0f172a" : "1px solid #e2e8f0",
                      boxShadow: "0 8px 20px rgba(15, 23, 42, 0.05)",
                      display: "grid",
                      alignContent: "start",
                      gap: 10,
                      opacity: inCurrentMonth ? 1 : 0.72,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <strong style={{ color: "#0f172a", fontSize: 16 }}>{day.date.getDate()}</strong>
                      {isToday ? <StatusPill label="Oggi" tone="neutral" /> : null}
                    </div>

                    {day.shifts.length === 0 &&
                    day.availabilities.length === 0 &&
                    day.requests.length === 0 ? (
                      <div style={{ color: "#94a3b8", fontSize: 14 }}>Nessun evento</div>
                    ) : null}

                    {day.shifts.map((shift) => (
                      <div
                        key={shift.id}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 16,
                          background: "#eff6ff",
                          border: "1px solid #dbeafe",
                          color: "#0f172a",
                          display: "grid",
                          gap: 4,
                        }}
                      >
                        <strong style={{ fontSize: 14 }}>{shift.title || "Turno"}</strong>
                        <span style={{ color: "#475569", fontSize: 13 }}>
                          {new Intl.DateTimeFormat(locale, {
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(shift.startTime)} - {new Intl.DateTimeFormat(locale, {
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(shift.endTime)}
                        </span>
                        <span style={{ color: "#64748b", fontSize: 12, lineHeight: 1.4 }}>
                          {shift.assignments
                            .map(
                              (assignment) =>
                                `${assignment.user.firstName} ${assignment.user.lastName}`
                            )
                            .join(", ")}
                        </span>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {shift.confirmedAt ? (
                            <StatusPill label="Confermato" tone="success" />
                          ) : (
                            <StatusPill label="Da confermare" tone="warning" />
                          )}
                        </div>
                      </div>
                    ))}

                    {day.availabilities.map((availability) => (
                      <div
                        key={availability.id}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 16,
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          color: "#991b1b",
                          fontSize: 13,
                          lineHeight: 1.5,
                        }}
                      >
                        Indisponibilita: {availability.user.firstName} {availability.user.lastName}
                      </div>
                    ))}

                    {day.requests.map((request) => (
                      <div
                        key={request.id}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 16,
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          color: "#991b1b",
                          fontSize: 13,
                          lineHeight: 1.5,
                        }}
                      >
                        {request.type === RequestType.VACATION ? "Ferie" : "Permesso"}:{" "}
                        {request.employee.firstName} {request.employee.lastName}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
