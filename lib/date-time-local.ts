const DEFAULT_TIME_ZONE = "Europe/Rome";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((accumulator, part) => {
      if (part.type !== "literal") {
        accumulator[part.type] = part.value;
      }

      return accumulator;
    }, {});

  const formattedUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return (formattedUtc - date.getTime()) / 60000;
}

function parseLocalDateTimeParts(value: string) {
  const match = DATE_TIME_LOCAL_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] ? Number(match[6]) : 0;
  const millisecond = match[7] ? Number(match[7].padEnd(3, "0")) : 0;

  const utcMillis = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const normalized = new Date(utcMillis);

  if (
    Number.isNaN(normalized.getTime()) ||
    normalized.getUTCFullYear() !== year ||
    normalized.getUTCMonth() !== month - 1 ||
    normalized.getUTCDate() !== day ||
    normalized.getUTCHours() !== hour ||
    normalized.getUTCMinutes() !== minute ||
    normalized.getUTCSeconds() !== second ||
    normalized.getUTCMilliseconds() !== millisecond
  ) {
    return null;
  }

  return { year, month, day, hour, minute, second, millisecond, utcMillis };
}

export function parseDateTimeLocal(value: string, timeZone = DEFAULT_TIME_ZONE): Date {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("Invalid date");
  }

  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const date = new Date(trimmed);

    if (Number.isNaN(date.getTime())) {
      throw new Error("Invalid date");
    }

    return date;
  }

  const normalized = DATE_ONLY_PATTERN.test(trimmed) ? `${trimmed}T00:00:00` : trimmed;
  const parts = parseLocalDateTimeParts(normalized);

  if (!parts) {
    throw new Error("Invalid date");
  }

  let utcMillis = parts.utcMillis;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offsetMinutes = getTimeZoneOffsetMinutes(new Date(utcMillis), timeZone);
    const nextUtcMillis = parts.utcMillis - offsetMinutes * 60_000;

    if (nextUtcMillis === utcMillis) {
      break;
    }

    utcMillis = nextUtcMillis;
  }

  const date = new Date(utcMillis);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }

  return date;
}
