import { toDateInputValueInTimeZone } from "@/lib/time-zone";

/** Midnight, `days - 1` days back, so the resulting window includes today. */
export function windowStart(days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  return start;
}

/**
 * Counts timestamps into one bucket per day, keyed in the app's timezone so
 * the columns line up with the days people actually worked.
 */
export function countByDay(timestamps: Array<{ getTime: () => number } | Date>, days: number) {
  const buckets: Array<{ key: string; label: string; value: number }> = [];
  const cursor = windowStart(days);

  for (let index = 0; index < days; index += 1) {
    const day = new Date(cursor);
    day.setDate(cursor.getDate() + index);

    buckets.push({
      key: toDateInputValueInTimeZone(day),
      label: `${day.getDate()}/${day.getMonth() + 1}`,
      value: 0,
    });
  }

  const positions = new Map(buckets.map((bucket, index) => [bucket.key, index]));

  for (const timestamp of timestamps) {
    const position = positions.get(toDateInputValueInTimeZone(timestamp as Date));

    if (position !== undefined) {
      buckets[position].value += 1;
    }
  }

  return buckets;
}
