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

const DEFAULT_ROUNDING_STEP_MINUTES = 15;
const SUPPORTED_STEPS = new Set([5, 10, 15, 30]);

export function normalizeRoundingStep(stepMinutes?: number | null): number {
  if (!stepMinutes || !Number.isFinite(stepMinutes)) {
    return DEFAULT_ROUNDING_STEP_MINUTES;
  }

  const normalized = Math.round(stepMinutes);
  return SUPPORTED_STEPS.has(normalized) ? normalized : DEFAULT_ROUNDING_STEP_MINUTES;
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
  const roundedStart = isRoundingEnabled(settings)
    ? roundTimeToStep(
        realStart,
        normalizeRoundingStep(settings?.roundingMinutes),
        settings?.roundingMode ?? RoundingMode.NEAREST
      )
    : new Date(realStart);
  const roundedEnd = isRoundingEnabled(settings)
    ? roundTimeToStep(
        realEnd,
        normalizeRoundingStep(settings?.roundingMinutes),
        settings?.roundingMode ?? RoundingMode.NEAREST
      )
    : new Date(realEnd);

  return {
    realStart: new Date(realStart),
    realEnd: new Date(realEnd),
    roundedStart,
    roundedEnd,
    realMs: Math.max(0, realEnd.getTime() - realStart.getTime()),
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
