import type { MonthlyDataset } from "@/lib/reporting";

/**
 * Everyone's month in one report: each clock-in and each absence keeps the
 * person's name, and the totals are the team's.
 */
export function mergeRestaurantDatasets(
  datasets: Array<{ userLabel: string; dataset: MonthlyDataset }>
): MonthlyDataset {
  const groupedMap = new Map<string, MonthlyDataset["groupedLogs"][number]>();
  let realHours = 0;
  let roundedHours = 0;

  for (const { userLabel, dataset } of datasets) {
    if (dataset.mode !== "restaurant") {
      continue;
    }

    realHours += dataset.totals.realHours;
    roundedHours += dataset.totals.roundedHours;

    for (const day of dataset.groupedLogs) {
      const current =
        groupedMap.get(day.date) ?? {
          date: day.date,
          entries: [],
          totals: { realHours: 0, roundedHours: 0 },
          labels: [],
          items: [],
        };

      current.entries = [
        ...current.entries,
        ...day.entries.map((entry) => ({ ...entry, personLabel: userLabel })),
      ].sort((left, right) => left.clockIn.localeCompare(right.clockIn));
      current.items = [
        ...(current.items ?? []),
        ...(day.items ?? []).map((item) => ({
          ...item,
          id: `${userLabel}-${item.id}`,
          title: `${userLabel} - ${item.title}`,
        })),
      ];
      current.labels = Array.from(new Set([...current.labels, ...day.labels]));
      current.totals = {
        realHours: Math.round((current.totals.realHours + day.totals.realHours) * 100) / 100,
        roundedHours: Math.round((current.totals.roundedHours + day.totals.roundedHours) * 100) / 100,
      };

      groupedMap.set(day.date, current);
    }
  }

  return {
    mode: "restaurant",
    groupedLogs: Array.from(groupedMap.values()).sort((left, right) =>
      left.date.localeCompare(right.date)
    ),
    totals: {
      realHours: Math.round(realHours * 100) / 100,
      roundedHours: Math.round(roundedHours * 100) / 100,
    },
  };
}

export function mergeCompanyDatasets(
  datasets: Array<{ userLabel: string; dataset: MonthlyDataset }>
): MonthlyDataset {
  const groupedMap = new Map<string, MonthlyDataset["groupedLogs"][number]>();
  const summary = {
    availability: 0,
    vacation: 0,
    permission: 0,
    sickness: 0,
    overtime: 0,
    courses: 0,
    closures: 0,
    total: 0,
  };

  for (const { userLabel, dataset } of datasets) {
    if (dataset.mode !== "company") {
      continue;
    }

    summary.availability += dataset.summary.availability;
    summary.vacation += dataset.summary.vacation;
    summary.permission += dataset.summary.permission;
    summary.sickness += dataset.summary.sickness;
    summary.overtime += dataset.summary.overtime;
    summary.courses += dataset.summary.courses;
    summary.closures += dataset.summary.closures;
    summary.total += dataset.summary.total;

    for (const day of dataset.groupedLogs) {
      const current =
        groupedMap.get(day.date) ?? {
          date: day.date,
          entries: [],
          totals: {
            realHours: 0,
            roundedHours: 0,
          },
          labels: [],
          items: [],
        };

      current.items = [
        ...(current.items ?? []),
        ...(day.items ?? []).map((item) => ({
          ...item,
          id: `${userLabel}-${item.id}`,
          title: `${userLabel} - ${item.title}`,
        })),
      ].sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());

      groupedMap.set(day.date, current);
    }
  }

  return {
    mode: "company",
    groupedLogs: Array.from(groupedMap.values()).sort((left, right) =>
      left.date.localeCompare(right.date)
    ),
    totals: {
      realHours: 0,
      roundedHours: 0,
    },
    summary,
  };
}
