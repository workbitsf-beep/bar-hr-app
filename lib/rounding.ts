import { RoundingMode } from "@prisma/client";

export function applyRounding(
  date: Date,
  mode: RoundingMode,
  minutes: number
): Date {
  const intervalMs = minutes * 60 * 1000;
  const timestamp = date.getTime();
  let roundedTimestamp: number;

  if (mode === RoundingMode.UP) {
    roundedTimestamp = Math.ceil(timestamp / intervalMs) * intervalMs;
  } else if (mode === RoundingMode.DOWN) {
    roundedTimestamp = Math.floor(timestamp / intervalMs) * intervalMs;
  } else {
    roundedTimestamp = Math.round(timestamp / intervalMs) * intervalMs;
  }

  return new Date(roundedTimestamp);
}
