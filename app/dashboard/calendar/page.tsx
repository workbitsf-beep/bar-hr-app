import Link from "next/link";
import { RequestStatus, RequestType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../context";
import { ClockActionsPanel } from "../timelogs/timelogs-client";
import { BillingRequiredState, EmptyState, Panel, PrimaryButton, Stack, StatusPill, TextInput } from "../ui";
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

function formatMemberRole(role: Role | string) {
  if (role === Role.MANAGER || role === "MANAGER") {
    return "Manager";
  }

  if (role === Role.OWNER || role === "OWNER") {
    return "Titolare";
  }

  return "Dipendente";
}

function formatShiftTimeRange(locale: string, startTime: Date, endTime: Date) {
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${formatter.format(startTime)} - ${formatter.format(endTime)}`;
}

function chunkByWeek<T>(items: T[]) {
  return Array.from({ length: Math.ceil(items.length / 7) }, (_, index) =>
    items.slice(index * 7, index * 7 + 7)
  );
}

function getRangeDayKeys(start: Date, end: Date) {
  const keys: string[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  const limit = new Date(end);
  limit.setHours(0, 0, 0, 0);

  while (cursor <= limit) {
    keys.push(toLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

function parseDayFilter(searchParams?: Record<string, string | string[] | undefined>) {
  const raw = Array.isArray(searchParams?.day) ? searchParams?.day[0] : searchParams?.day;

  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  return raw;
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
  const dayFilter = parseDayFilter(params);
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
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        confirmedAt: true,
        assignments: {
          select: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
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
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
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
      select: {
        id: true,
        type: true,
        startsAt: true,
        endsAt: true,
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
          select: {
            role: true,
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

  const shiftsByDay = new Map<string, typeof shifts>();
  const availabilitiesByDay = new Map<string, typeof availabilities>();
  const requestsByDay = new Map<string, typeof approvedRequests>();

  for (const shift of shifts) {
    const start = shift.startTime > calendarStart ? shift.startTime : calendarStart;
    const end = shift.endTime < calendarEnd ? shift.endTime : calendarEnd;

    for (const dayKey of getRangeDayKeys(start, end)) {
      const dayShifts = shiftsByDay.get(dayKey) ?? [];
      dayShifts.push(shift);
      shiftsByDay.set(dayKey, dayShifts);
    }
  }

  for (const availability of availabilities) {
    const start = availability.startsAt > calendarStart ? availability.startsAt : calendarStart;
    const end = availability.endsAt < calendarEnd ? availability.endsAt : calendarEnd;

    for (const dayKey of getRangeDayKeys(start, end)) {
      const dayAvailabilities = availabilitiesByDay.get(dayKey) ?? [];
      dayAvailabilities.push(availability);
      availabilitiesByDay.set(dayKey, dayAvailabilities);
    }
  }

  for (const request of approvedRequests) {
    const safeStart = request.startsAt ?? calendarStart;
    const safeEnd = request.endsAt ?? safeStart;
    const start = safeStart > calendarStart ? safeStart : calendarStart;
    const end = safeEnd < calendarEnd ? safeEnd : calendarEnd;

    for (const dayKey of getRangeDayKeys(start, end)) {
      const dayRequests = requestsByDay.get(dayKey) ?? [];
      dayRequests.push(request);
      requestsByDay.set(dayKey, dayRequests);
    }
  }

  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    date.setHours(0, 0, 0, 0);
    const dayKey = toLocalDateKey(date);

    return {
      date,
      shifts: shiftsByDay.get(dayKey) ?? [],
      availabilities: availabilitiesByDay.get(dayKey) ?? [],
      requests: requestsByDay.get(dayKey) ?? [],
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
        role: assignment.user.role,
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
  const calendarWeeks = chunkByWeek(days);
  const unconfirmedShiftCount = shifts.filter(
    (shift) => !shift.confirmedAt && shift.startTime <= monthEnd && shift.endTime >= monthStart
  ).length;
  const visibleCalendarWeeks = dayFilter
    ? calendarWeeks.filter((week) => week.some((day) => toLocalDateKey(day.date) === dayFilter))
    : calendarWeeks;

  return (
    <Stack columns="minmax(0, 1fr)">
      {role !== Role.OWNER ? <ClockActionsPanel role={role} settings={settings} compact /> : null}

      {(role === Role.OWNER || role === Role.MANAGER) ? (
        <Panel
          title="Conferma turni"
          action={unconfirmedShiftCount === 0 ? "Tutti inviati" : `${unconfirmedShiftCount} da inviare`}
        >
          <PublishWeekPanel
            rangeStart={toLocalDateKey(monthStart)}
            rangeEnd={toLocalDateKey(monthEnd)}
            pendingCount={unconfirmedShiftCount}
          />
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
            <form
              method="get"
              style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
            >
              <input type="hidden" name="month" value={month} />
              <input type="hidden" name="year" value={year} />
              <TextInput
                type="date"
                name="day"
                defaultValue={dayFilter ?? ""}
                aria-label="Cerca giorno"
                style={{ minWidth: 180 }}
              />
              <PrimaryButton type="submit" tone="sand">
                Cerca giorno
              </PrimaryButton>
              {dayFilter ? (
                <Link href={`/dashboard/calendar?month=${month}&year=${year}`} style={{ textDecoration: "none" }}>
                  <PrimaryButton type="button" tone="sand">
                    Reset
                  </PrimaryButton>
                </Link>
              ) : null}
            </form>
          </div>
        }
      >
        {role === Role.OWNER ? (
          <OwnerCalendarClient
            locale={locale}
            weekdayLabels={weekdayLabels}
            days={serializedDays}
            members={memberOptions}
            filteredDay={dayFilter}
          />
        ) : (
          <>
            <div className="dashboard-desktop-only">
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
                              {formatShiftTimeRange(locale, shift.startTime, shift.endTime)}
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
            </div>

            <div className="dashboard-mobile-only dashboard-week-strip" style={{ display: "grid", gap: 16 }}>
              {visibleCalendarWeeks.map((week, weekIndex) => (
                <section
                  key={`${week[0]?.date.toISOString() ?? `${weekIndex}-${dayFilter ?? "all"}`}`}
                  className="dashboard-week-card"
                  style={{
                    display: "grid",
                    gap: 12,
                    padding: 16,
                    borderRadius: 22,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <strong style={{ color: "#0f172a", fontSize: 18 }}>
                      Settimana {weekIndex + 1}
                    </strong>
                    {week[0] && week[week.length - 1] ? (
                      <span style={{ color: "#64748b", lineHeight: 1.6 }}>
                        {new Intl.DateTimeFormat(locale, {
                          day: "numeric",
                          month: "long",
                        }).format(week[0].date)}{" "}
                        -{" "}
                        {new Intl.DateTimeFormat(locale, {
                          day: "numeric",
                          month: "long",
                        }).format(week[week.length - 1].date)}
                      </span>
                    ) : null}
                  </div>

                  <div style={{ display: "grid", gap: 12 }}>
                    {week.map((day) => {
                      const isToday = day.date.toDateString() === new Date().toDateString();

                      return (
                        <div
                          key={day.date.toISOString()}
                          style={{
                            display: "grid",
                            gap: 10,
                            padding: 16,
                            borderRadius: 20,
                            background: "#ffffff",
                            border: isToday ? "2px solid #0f172a" : "1px solid #e2e8f0",
                            boxShadow: "0 8px 20px rgba(15, 23, 42, 0.05)",
                            opacity: day.date >= monthStart && day.date <= monthEnd ? 1 : 0.7,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <strong style={{ color: "#0f172a", fontSize: 18 }}>
                              {new Intl.DateTimeFormat(locale, {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                              }).format(day.date)}
                            </strong>
                            {isToday ? <StatusPill label="Oggi" tone="neutral" /> : null}
                          </div>

                          {day.shifts.length === 0 &&
                          day.availabilities.length === 0 &&
                          day.requests.length === 0 ? (
                            <div style={{ color: "#94a3b8", fontSize: 15 }}>Nessun evento</div>
                          ) : null}

                          {day.shifts.map((shift) => (
                            <div
                              key={shift.id}
                              style={{
                                padding: 14,
                                borderRadius: 18,
                                background: "#eff6ff",
                                border: "1px solid #dbeafe",
                                display: "grid",
                                gap: 8,
                              }}
                            >
                              <strong style={{ color: "#0f172a", fontSize: 16 }}>
                                {shift.title || "Turno"}
                              </strong>
                              <div style={{ color: "#334155", fontWeight: 600, fontSize: 15 }}>
                                {formatShiftTimeRange(locale, shift.startTime, shift.endTime)}
                              </div>
                              <div style={{ display: "grid", gap: 6 }}>
                                {shift.assignments.map((assignment) => (
                                  <div key={assignment.user.id} style={{ color: "#475569", lineHeight: 1.5 }}>
                                    {assignment.user.firstName} {assignment.user.lastName} -{" "}
                                    {formatMemberRole(assignment.user.role)}
                                  </div>
                                ))}
                              </div>
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
                                padding: "12px 14px",
                                borderRadius: 18,
                                background: "#fef2f2",
                                border: "1px solid #fecaca",
                                color: "#991b1b",
                                lineHeight: 1.6,
                              }}
                            >
                              Indisponibilita: {availability.user.firstName} {availability.user.lastName}
                            </div>
                          ))}

                          {day.requests.map((request) => (
                            <div
                              key={request.id}
                              style={{
                                padding: "12px 14px",
                                borderRadius: 18,
                                background: "#fef2f2",
                                border: "1px solid #fecaca",
                                color: "#991b1b",
                                lineHeight: 1.6,
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
                </section>
              ))}
            </div>
          </>
        )}
      </Panel>
    </Stack>
  );
}
