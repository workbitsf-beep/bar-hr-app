export type ShiftPresetKey = "MORNING" | "AFTERNOON" | "EVENING";

export type ShiftPreset = {
  key: ShiftPresetKey;
  label: string;
  startTime: string;
  endTime: string;
};

type ShiftPresetSettings = {
  morningStartTime?: string | null;
  morningEndTime?: string | null;
  afternoonStartTime?: string | null;
  afternoonEndTime?: string | null;
  eveningStartTime?: string | null;
  eveningEndTime?: string | null;
};

const SHIFT_PRESET_LABELS: Record<ShiftPresetKey, string> = {
  MORNING: "Mattina",
  AFTERNOON: "Pomeriggio",
  EVENING: "Sera",
};

function isValidTimeValue(value: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

export function normalizePresetTime(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return isValidTimeValue(normalized) ? normalized : null;
}

export function buildShiftPresets(settings: ShiftPresetSettings | null | undefined) {
  if (!settings) {
    return [] as ShiftPreset[];
  }

  const candidates: Array<[ShiftPresetKey, string | null, string | null]> = [
    ["MORNING", normalizePresetTime(settings.morningStartTime), normalizePresetTime(settings.morningEndTime)],
    ["AFTERNOON", normalizePresetTime(settings.afternoonStartTime), normalizePresetTime(settings.afternoonEndTime)],
    ["EVENING", normalizePresetTime(settings.eveningStartTime), normalizePresetTime(settings.eveningEndTime)],
  ];

  return candidates.flatMap(([key, startTime, endTime]) =>
    startTime && endTime
      ? [
          {
            key,
            label: SHIFT_PRESET_LABELS[key],
            startTime,
            endTime,
          },
        ]
      : []
  );
}

function getDateParts(dateSource: string) {
  const datePart = String(dateSource ?? "").slice(0, 10);
  const date = datePart ? new Date(`${datePart}T00:00:00`) : new Date(dateSource);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }

  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
  };
}

function toDateTimeLocal(year: number, month: number, day: number, time: string) {
  const monthValue = String(month + 1).padStart(2, "0");
  const dayValue = String(day).padStart(2, "0");
  return `${year}-${monthValue}-${dayValue}T${time}`;
}

export function applyShiftPreset(dateSource: string, preset: ShiftPreset) {
  const { year, month, day } = getDateParts(dateSource);
  const endOffset = preset.endTime <= preset.startTime ? 1 : 0;
  const endDate = new Date(year, month, day + endOffset);

  return {
    startTime: toDateTimeLocal(year, month, day, preset.startTime),
    endTime: toDateTimeLocal(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate(),
      preset.endTime
    ),
  };
}
