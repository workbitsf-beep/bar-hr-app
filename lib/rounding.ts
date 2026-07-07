import { RoundingMode } from "@prisma/client";

export type RoundingSettings = {
  roundingEnabled?: boolean | null;
  roundingMode?: RoundingMode | string | null;
  roundingMinutes?: number | null;
};

export type RoundedWorkDuration = {
  realStart: Date;
  realEnd: Date;
  roundedStart: Date;
  roundedEnd: Date;
  realMs: number;
  roundedMs: number;
};

export type ScheduledShiftWindow = {
  startTime: Date;
  endTime: Date;
};

const DEFAULT_ROUNDING_STEP_MINUTES = 15;
const SHIFT_TOLERANCE_MINUTES = 5;

export function normalizeRoundingStep(_stepMinutes?: number | null): number {
  void _stepMinutes;
  return DEFAULT_ROUNDING_STEP_MINUTES;
}

function normalizeRoundingMode(mode?: RoundingMode | string | null): RoundingMode {
  if (mode === RoundingMode.UP || mode === RoundingMode.DOWN || mode === RoundingMode.NEAREST) {
    return mode;
  }

  return RoundingMode.NEAREST;
}

export function isRoundingEnabled(settings?: RoundingSettings | null): boolean {
  return Boolean(settings?.roundingEnabled);
}

export function roundTimeToStep(
  date: Date,
  stepMinutes: number = DEFAULT_ROUNDING_STEP_MINUTES,
  mode: RoundingMode | string | null = RoundingMode.NEAREST
): Date {
  const stepMs = normalizeRoundingStep(stepMinutes) * 60 * 1000;
  const timestamp = date.getTime();
  const remainder = ((timestamp % stepMs) + stepMs) % stepMs;
  const normalizedMode = normalizeRoundingMode(mode);

  if (remainder === 0) {
    return new Date(timestamp);
  }

  if (normalizedMode === RoundingMode.DOWN) {
    return new Date(timestamp - remainder);
  }

  if (normalizedMode === RoundingMode.UP) {
    return new Date(timestamp + (stepMs - remainder));
  }

  return new Date(
    remainder >= stepMs / 2
      ? timestamp + (stepMs - remainder)
      : timestamp - remainder
  );
}

export function calculateRoundedWorkDuration(
  realStart: Date,
  realEnd: Date,
  settings?: RoundingSettings | null
): RoundedWorkDuration {
  const realMs = Math.max(0, realEnd.getTime() - realStart.getTime());
  const roundedMs = isRoundingEnabled(settings)
    ? roundDurationToNearestStep(realMs, normalizeRoundingStep(settings?.roundingMinutes))
    : realMs;
  const roundedStart = new Date(realStart);
  const roundedEnd = new Date(realStart.getTime() + roundedMs);

  return {
    realStart: new Date(realStart),
    realEnd: new Date(realEnd),
    roundedStart,
    roundedEnd,
    realMs,
    roundedMs,
  };
}

function roundDurationToNearestStep(durationMs: number, stepMinutes: number) {
  const stepMs = normalizeRoundingStep(stepMinutes) * 60 * 1000;
  return Math.round(Math.max(0, durationMs) / stepMs) * stepMs;
}

export function calculateShiftAwareRoundedWorkDuration(
  realStart: Date,
  realEnd: Date,
  shift: ScheduledShiftWindow | null | undefined,
  settings?: RoundingSettings | null
): RoundedWorkDuration {
  if (!isRoundingEnabled(settings) || !shift) {
    return calculateRoundedWorkDuration(realStart, realEnd, settings);
  }

  const stepMinutes = normalizeRoundingStep(settings?.roundingMinutes);
  const toleranceMs = SHIFT_TOLERANCE_MINUTES * 60 * 1000;
  const realMs = Math.max(0, realEnd.getTime() - realStart.getTime());
  const roundedStart =
    Math.abs(realStart.getTime() - shift.startTime.getTime()) <= toleranceMs
      ? new Date(shift.startTime)
      : roundTimeToStep(realStart, stepMinutes, RoundingMode.UP);
  const roundedEnd =
    Math.abs(realEnd.getTime() - shift.endTime.getTime()) <= toleranceMs
      ? new Date(shift.endTime)
      : roundTimeToStep(realEnd, stepMinutes, RoundingMode.NEAREST);

  return {
    realStart: new Date(realStart),
    realEnd: new Date(realEnd),
    roundedStart,
    roundedEnd,
    realMs,
    roundedMs: Math.max(0, roundedEnd.getTime() - roundedStart.getTime()),
  };
}

export function calculateDailyRoundedMinutes(
  pairs: Array<{ start: Date; end: Date }>,
  settings?: RoundingSettings | null
): number {
  return pairs.reduce((total, pair) => {
    const result = calculateRoundedWorkDuration(pair.start, pair.end, settings);
    return total + Math.round(result.roundedMs / 60000);
  }, 0);
}

export function calculateMonthlyRoundedMinutes(
  days: Array<Array<{ start: Date; end: Date }>>,
  settings?: RoundingSettings | null
): number {
  return days.reduce(
    (total, pairs) => total + calculateDailyRoundedMinutes(pairs, settings),
    0
  );
}

export function applyRounding(
  date: Date,
  mode: RoundingMode,
  minutes: number
): Date {
  return roundTimeToStep(date, minutes, mode);
}
