export const APP_TIME_ZONE = "Europe/Rome";

type ZonedDateParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

function toDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }

  return date;
}

export function getZonedDateParts(value: Date | string, timeZone = APP_TIME_ZONE): ZonedDateParts {
  const date = toDate(value);
  const parts = new Intl.DateTimeFormat("en-GB", {
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

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

export function formatDateInTimeZone(
  value: Date | string,
  locale = "it-IT",
  timeZone = APP_TIME_ZONE
) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone,
  }).format(toDate(value));
}

export function formatDateTimeInTimeZone(
  value: Date | string,
  locale = "it-IT",
  timeZone = APP_TIME_ZONE
) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(toDate(value));
}

export function formatDateTimeLocalInTimeZone(value: Date | string, timeZone = APP_TIME_ZONE) {
  const parts = getZonedDateParts(value, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function toDateInputValueInTimeZone(value: Date | string, timeZone = APP_TIME_ZONE) {
  return formatDateTimeLocalInTimeZone(value, timeZone).slice(0, 10);
}

export function toTimeInputValueInTimeZone(value: Date | string, timeZone = APP_TIME_ZONE) {
  return formatDateTimeLocalInTimeZone(value, timeZone).slice(11, 16);
}
