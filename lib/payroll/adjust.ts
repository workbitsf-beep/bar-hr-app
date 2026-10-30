import { DAY_KINDS, PAYROLL_KINDS, type PayrollCodeKey, type PayrollEntry } from "./template";

/**
 * The owner's changes to a person's month in the consultant's file, made on
 * the file itself before sending:
 * - rows: a day's item with other hours or days, or left out (off);
 * - kindsOff: a whole item left out (one row per item files);
 * - targets: a month total for an item (per-item and per-person files),
 *   laid over the days so the file still adds up in every layout;
 * - off: the person left out of the file.
 * The clock-ins themselves never change.
 */

export type MonthTargets = Partial<Record<PayrollCodeKey, { hours?: number; days?: number }>>;
export type RowChange = { hours?: number; days?: number; off?: boolean };
export type MonthAdjustment = {
  targets: MonthTargets;
  /** "2026-10-03|ordinary" → the change. */
  rows: Record<string, RowChange>;
  kindsOff: PayrollCodeKey[];
  off: boolean;
};

const round2 = (value: number) => Math.round(value * 100) / 100;
const WORKED: PayrollCodeKey[] = ["ordinary", "overtime"];
/** Past this a day takes no more added hours, unless there is nowhere else to put them. */
const DAY_CAP = 12;

export const rowKey = (date: string, kind: PayrollCodeKey) => `${date}|${kind}`;

function isKind(value: unknown): value is PayrollCodeKey {
  return typeof value === "string" && PAYROLL_KINDS.includes(value as PayrollCodeKey);
}

export function targetsOf(value: unknown): MonthTargets {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const targets: MonthTargets = {};
  for (const kind of PAYROLL_KINDS) {
    const raw = (value as Record<string, unknown>)[kind];
    if (!raw || typeof raw !== "object") continue;
    const { hours, days } = raw as { hours?: unknown; days?: unknown };
    const entry: { hours?: number; days?: number } = {};
    if (typeof hours === "number" && Number.isFinite(hours) && hours >= 0) entry.hours = round2(hours);
    if (typeof days === "number" && Number.isInteger(days) && days >= 0 && DAY_KINDS.includes(kind)) entry.days = days;
    if (entry.hours !== undefined || entry.days !== undefined) targets[kind] = entry;
  }
  return targets;
}

/** The stored JSON as an adjustment; the first version kept the targets at the top. */
export function adjustmentOf(value: unknown): MonthAdjustment {
  const stored = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const rows: Record<string, RowChange> = {};
  if (stored.rows && typeof stored.rows === "object" && !Array.isArray(stored.rows)) {
    for (const [key, raw] of Object.entries(stored.rows as Record<string, unknown>)) {
      const [date, kind] = key.split("|");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !isKind(kind) || !raw || typeof raw !== "object") continue;
      const { hours, days, off } = raw as { hours?: unknown; days?: unknown; off?: unknown };
      const change: RowChange = {};
      if (typeof hours === "number" && Number.isFinite(hours) && hours >= 0 && hours <= 24) change.hours = round2(hours);
      if (typeof days === "number" && (days === 0 || days === 1)) change.days = days;
      if (off === true) change.off = true;
      if (Object.keys(change).length) rows[key] = change;
    }
  }
  return {
    targets: targetsOf(stored.targets ?? stored),
    rows,
    kindsOff: Array.isArray(stored.kindsOff) ? (stored.kindsOff as unknown[]).filter(isKind) : [],
    off: stored.off === true,
  };
}

export function isEmptyAdjustment(adjustment: MonthAdjustment) {
  return !Object.keys(adjustment.targets).length && !Object.keys(adjustment.rows).length && !adjustment.kindsOff.length && !adjustment.off;
}

export function totalsOf(entries: PayrollEntry[]) {
  const totals = Object.fromEntries(PAYROLL_KINDS.map((kind) => [kind, { hours: 0, days: 0 }])) as Record<PayrollCodeKey, { hours: number; days: number }>;
  for (const entry of entries) {
    totals[entry.kind].hours = round2(totals[entry.kind].hours + entry.hours);
    totals[entry.kind].days += entry.days;
  }
  return totals;
}

/**
 * The person's month after the owner's changes: every row (for the review,
 * with the ones left out marked) and the rows that go in the file.
 */
export function applyAdjustment(
  source: PayrollEntry[],
  adjustment: MonthAdjustment,
  context: { year: number; month: number; dailyHours: number | null },
) {
  let entries = source.map((entry) => {
    const change = adjustment.rows[rowKey(entry.date, entry.kind)];
    return change ? { ...entry, hours: change.hours ?? entry.hours, days: change.days ?? entry.days } : { ...entry };
  });
  entries = applyMonthTargets(entries, adjustment.targets, context);
  const off = new Set<string>();
  for (const entry of entries) {
    if (adjustment.off || adjustment.kindsOff.includes(entry.kind) || adjustment.rows[rowKey(entry.date, entry.kind)]?.off) {
      off.add(rowKey(entry.date, entry.kind));
    }
  }
  return {
    all: entries,
    file: entries.filter((entry) => !off.has(rowKey(entry.date, entry.kind)) && (entry.hours > 0 || entry.days > 0)),
    off,
  };
}

export function applyMonthTargets(
  source: PayrollEntry[],
  targets: MonthTargets,
  context: { year: number; month: number; dailyHours: number | null },
): PayrollEntry[] {
  let entries = source.map((entry) => ({ ...entry }));
  const lastDay = new Date(Date.UTC(context.year, context.month, 0)).getUTCDate();
  const dateOf = (day: number) => `${context.year}-${String(context.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const latestFirst = (list: PayrollEntry[]) => [...list].sort((a, b) => b.date.localeCompare(a.date));
  const dayHours = (date: string) => entries.filter((entry) => entry.date === date).reduce((sum, entry) => sum + entry.hours, 0);

  for (const kind of PAYROLL_KINDS) {
    const target = targets[kind];
    if (!target) continue;

    // Whole days first: they bring their hours with them.
    if (target.days !== undefined && DAY_KINDS.includes(kind)) {
      let current = entries.filter((entry) => entry.kind === kind).reduce((sum, entry) => sum + entry.days, 0);
      for (const entry of latestFirst(entries.filter((item) => item.kind === kind && item.days > 0))) {
        if (current <= target.days) break;
        entries = entries.filter((item) => item !== entry);
        current -= entry.days;
      }
      const taken = new Set(entries.map((entry) => entry.date));
      for (let day = lastDay; day >= 1 && current < target.days; day -= 1) {
        if (taken.has(dateOf(day))) continue;
        entries.push({ date: dateOf(day), kind, hours: context.dailyHours ?? 0, days: 1 });
        current += 1;
      }
      while (current < target.days) {
        entries.push({ date: dateOf(lastDay), kind, hours: context.dailyHours ?? 0, days: 1 });
        current += 1;
      }
    }

    if (target.hours === undefined) continue;
    const current = round2(entries.filter((entry) => entry.kind === kind).reduce((sum, entry) => sum + entry.hours, 0));
    let delta = round2(target.hours - current);

    if (delta < 0) {
      let remove = -delta;
      for (const entry of latestFirst(entries.filter((item) => item.kind === kind))) {
        if (remove <= 0) break;
        const take = Math.min(entry.hours, remove);
        entry.hours = round2(entry.hours - take);
        remove = round2(remove - take);
      }
      entries = entries.filter((entry) => entry.hours > 0 || entry.days > 0);
      continue;
    }

    if (delta > 0) {
      const own = [...new Set(latestFirst(entries.filter((item) => item.kind === kind)).map((item) => item.date))];
      const worked = [...new Set(latestFirst(entries.filter((item) => WORKED.includes(item.kind))).map((item) => item.date))];
      // The item's own days first, then the days worked; the month's last day if there is nothing.
      const dates = [...new Set([...own, ...worked])];
      if (!dates.length) dates.push(dateOf(lastDay));
      const addTo = (date: string, hours: number) => {
        const existing = entries.find((entry) => entry.date === date && entry.kind === kind);
        if (existing) existing.hours = round2(existing.hours + hours);
        else entries.push({ date, kind, hours: round2(hours), days: 0 });
      };
      for (const date of dates) {
        if (delta <= 0) break;
        const room = round2(Math.max(0, DAY_CAP - dayHours(date)));
        const hours = Math.min(room, delta);
        if (hours > 0) {
          addTo(date, hours);
          delta = round2(delta - hours);
        }
      }
      if (delta > 0) addTo(dates[0], delta);
    }
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date) || PAYROLL_KINDS.indexOf(a.kind) - PAYROLL_KINDS.indexOf(b.kind));
}
