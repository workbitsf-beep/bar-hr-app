function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function toDateInputValue(source: Date | string) {
  const date = source instanceof Date ? source : new Date(source);

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toTimeInputValue(source: Date | string) {
  const date = source instanceof Date ? source : new Date(source);

  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function combineDateAndTime(dateValue: string, timeValue: string) {
  return `${dateValue}T${timeValue}`;
}
