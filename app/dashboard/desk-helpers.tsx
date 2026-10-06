import { toTimeInputValueInTimeZone } from "@/lib/time-zone";

/** Small pieces shared by the desktop pages (desktop-*.tsx). */

export function addDaysKey(dayKey: string, days: number) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function mondayKey(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDaysKey(dayKey, -((weekday + 6) % 7));
}

export const hm = (value: Date) => toTimeInputValueInTimeZone(value);

export function duration(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

const PALETTE = ["#6d3df0", "#e0679a", "#2fa8a0", "#f2a93b", "#3a6ff0", "#8b5cff", "#ef6fa4", "#13806f"];

export function colorFor(id: string) {
  let sum = 0;
  for (const char of id) sum = (sum + char.charCodeAt(0)) % 997;
  return PALETTE[sum % PALETTE.length];
}

export function Avatar({
  user,
  small,
}: {
  user: { id: string; firstName: string; lastName: string };
  small?: boolean;
}) {
  return (
    <span
      className={small ? "wbd-av wbd-av--sm" : "wbd-av"}
      style={{ background: colorFor(user.id) }}
      aria-hidden="true"
    >
      {`${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase()}
    </span>
  );
}

export const REQUEST_LABEL: Record<string, string> = {
  VACATION: "Ferie",
  PERMISSION: "Permesso",
  OVERTIME: "Straordinario",
  SHIFT_CHANGE: "Cambio turno",
  SICKNESS: "Malattia",
};

export const REQUEST_TONE: Record<string, string> = {
  VACATION: "wbd-tag--pink",
  PERMISSION: "wbd-tag--warn",
  OVERTIME: "wbd-tag--warn",
  SHIFT_CHANGE: "wbd-tag--teal",
  SICKNESS: "wbd-tag--bad",
};
