import { formatDateTimeLocalInTimeZone } from "@/lib/time-zone";

export function toDateInputValue(source: Date | string) {
  return formatDateTimeLocalInTimeZone(source).slice(0, 10);
}

export function toTimeInputValue(source: Date | string) {
  return formatDateTimeLocalInTimeZone(source).slice(11, 16);
}

export function combineDateAndTime(dateValue: string, timeValue: string) {
  return `${dateValue}T${timeValue}`;
}
