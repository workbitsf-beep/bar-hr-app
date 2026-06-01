import { ClockType, RoundingMode } from "@prisma/client";

function getQuarterHourMinute(minutes: number) {
  if (minutes <= 5) {
    return 0;
  }

  if (minutes <= 20) {
    return 15;
  }

  if (minutes <= 35) {
    return 30;
  }

  if (minutes <= 50) {
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

function floorToQuarterHour(date: Date): Date {
  const rounded = new Date(date);
  const minutes = rounded.getUTCMinutes();
  const flooredMinutes = Math.floor(minutes / 15) * 15;

  rounded.setUTCSeconds(0, 0);
  rounded.setUTCMinutes(flooredMinutes, 0, 0);
  return rounded;
}

function ceilToQuarterHour(date: Date): Date {
  const rounded = new Date(date);
  const minutes = rounded.getUTCMinutes();
  const ceiledMinutes = Math.ceil(minutes / 15) * 15;

  rounded.setUTCSeconds(0, 0);

  if (ceiledMinutes === 60) {
    rounded.setUTCHours(rounded.getUTCHours() + 1, 0, 0, 0);
    return rounded;
  }

  rounded.setUTCMinutes(ceiledMinutes, 0, 0);
  return rounded;
}

function roundWithTolerance(reference: Date, actual: Date, kind: ClockType): Date {
  const toleranceMs = 5 * 60 * 1000;
  const delta = actual.getTime() - reference.getTime();

  if (Math.abs(delta) <= toleranceMs) {
    return new Date(reference);
  }

  if (delta > 0) {
    return ceilToQuarterHour(actual);
  }

  if (kind === ClockType.OUT) {
    return floorToQuarterHour(actual);
  }

  return floorToQuarterHour(actual);
}

export function applyScheduledRounding(
  date: Date,
  kind: ClockType,
  referenceStart: Date | null,
  referenceEnd: Date | null
): Date {
  if (kind === ClockType.IN && referenceStart) {
    return roundWithTolerance(referenceStart, date, kind);
  }

  if (kind === ClockType.OUT && referenceEnd) {
    const toleranceMs = 5 * 60 * 1000;
    const delta = date.getTime() - referenceEnd.getTime();

    if (Math.abs(delta) <= toleranceMs) {
      return new Date(referenceEnd);
    }

    return floorToQuarterHour(date);
  }

  return applyRounding(date, RoundingMode.NEAREST, 15);
}
