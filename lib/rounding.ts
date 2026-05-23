import { RoundingMode } from "@prisma/client";

function getQuarterHourMinute(minutes: number) {
  if (minutes <= 7) {
    return 0;
  }

  if (minutes <= 17) {
    return 15;
  }

  if (minutes <= 37) {
    return 30;
  }

  if (minutes <= 52) {
    return 45;
  }

  return 60;
}

export function applyRounding(
  date: Date,
  _mode: RoundingMode,
  _minutes: number
): Date {
  const rounded = new Date(date);
  const roundedMinutes = getQuarterHourMinute(rounded.getUTCMinutes());

  rounded.setUTCSeconds(0, 0);

  if (roundedMinutes === 60) {
    rounded.setUTCHours(rounded.getUTCHours() + 1, 0, 0, 0);
    return rounded;
  }

  rounded.setUTCMinutes(roundedMinutes, 0, 0);
  return rounded;
}
