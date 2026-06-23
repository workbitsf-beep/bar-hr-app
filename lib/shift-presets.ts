export type ShiftPresetKey = "MORNING" | "AFTERNOON" | "EVENING";

export type ShiftPreset = {
  key: string;
  label: string;
  startTime: string;
  endTime: string;
};

type ShiftPresetSettings = {
  standardShiftPresets?: unknown;
  morningStartTime?: string | null;
  morningEndTime?: string | null;
  afternoonStartTime?: string | null;
  afternoonEndTime?: string | null;
  eveningStartTime?: string | null;
  eveningEndTime?: string | null;
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

  if (Array.isArray(settings.standardShiftPresets)) {
    const customPresets = settings.standardShiftPresets.flatMap((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }

      const data = entry as Record<string, unknown>;
      const startTime = normalizePresetTime(String(data.startTime ?? ""));
      const endTime = normalizePresetTime(String(data.endTime ?? ""));

      if (!startTime || !endTime) {
        return [];
      }

      const title = typeof data.title === "string" ? data.title.trim() : "";

      return [
        {
          key: typeof data.id === "string" && data.id.trim() ? data.id.trim() : `CUSTOM_${index}`,
          label: title || `Orario ${index + 1}`,
          startTime,
          endTime,
        },
      ];
    });

    if (customPresets.length > 0) {
      return customPresets;
    }
  }

  const candidates: Array<[ShiftPresetKey, string | null, string | null]> = [
    ["MORNING", normalizePresetTime(settings.morningStartTime), normalizePresetTime(settings.morningEndTime)],
    ["AFTERNOON", normalizePresetTime(settings.afternoonStartTime), normalizePresetTime(settings.afternoonEndTime)],
    ["EVENING", normalizePresetTime(settings.eveningStartTime), normalizePresetTime(settings.eveningEndTime)],
  ];

  return candidates.flatMap(([key, startTime, endTime], index) =>
    startTime && endTime
      ? [
          {
            key,
            label: `Orario ${index + 1}`,
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
