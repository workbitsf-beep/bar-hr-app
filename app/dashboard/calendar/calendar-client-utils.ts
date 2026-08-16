import { RequestType, Role } from "@prisma/client";
import { APP_TIME_ZONE, toDateInputValueInTimeZone } from "@/lib/time-zone";

type DatedCalendarItem = {
  date: string;
};

type ShiftStartItem = {
  startTime: string;
};

export function dateKeyToLocalDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function formatLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const date = dateKeyToLocalDate(dateKey);
  date.setDate(date.getDate() + days);
  return formatLocalDateKey(date);
}

export function startOfWeekDateKey(dateKey: string) {
  const date = dateKeyToLocalDate(dateKey);
  const diff = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - diff);
  return formatLocalDateKey(date);
}

export function chunkByWeek<T>(items: T[]) {
  return Array.from({ length: Math.ceil(items.length / 7) }, (_, index) =>
    items.slice(index * 7, index * 7 + 7)
  );
}

export function formatDayLabel(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
}

export function formatCompactDayLabel(value: string, locale: string) {
  const label = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));

  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatDayHeading(value: string, locale: string) {
  const date = new Date(value);
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: APP_TIME_ZONE,
  }).format(date);
  const dayAndMonth = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    timeZone: APP_TIME_ZONE,
  }).format(date);

  return {
    weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    dayAndMonth,
  };
}

export function formatWeekHeading(week: DatedCalendarItem[], locale: string) {
  const first = week[0];
  const last = week[week.length - 1];

  if (!first || !last) {
    return "";
  }

  const firstDay = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(first.date));
  const lastLabel = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(last.date));

  return `${firstDay}\u00a0\u2014\u00a0${lastLabel}`;
}

export function formatTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
}

export function formatRange(start: string, end: string, locale: string) {
  return `${formatTime(start, locale)} - ${formatTime(end, locale)}`;
}

export function hasTimeOverlap(
  rangeStart: string,
  rangeEnd: string,
  shiftStart: string,
  shiftEnd: string
) {
  return new Date(rangeStart) < new Date(shiftEnd) && new Date(rangeEnd) > new Date(shiftStart);
}

export function isShiftPastDay(shift: ShiftStartItem, todayKey: string) {
  return toDateInputValueInTimeZone(shift.startTime) < todayKey;
}

export function formatRoleLabel(role: string) {
  if (role === Role.MANAGER) {
    return "Responsabile";
  }

  if (role === Role.OWNER) {
    return "Titolare";
  }

  return "Dipendente";
}

export function formatRequestTypeLabel(type: string) {
  if (type === RequestType.OVERTIME) {
    return "Straordinario";
  }

  if (type === RequestType.PERMISSION) {
    return "Permesso";
  }

  if (type === RequestType.SICKNESS) {
    return "Malattia";
  }

  return "Ferie";
}

export function truncateCalendarText(value: string, maxLength = 25) {
  const clean = value.replace(/\s+/g, " ").trim();

  if (clean.length <= maxLength) {
    return clean;
  }

  return `${clean.slice(0, maxLength - 3).trimEnd()}...`;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Operazione non riuscita.";
}
