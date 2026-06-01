function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatDurationClock(hours: number | null | undefined) {
  if (typeof hours !== "number" || !Number.isFinite(hours)) {
    return "00:00";
  }

  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;

  return `${pad(hh)}:${pad(mm)}`;
}

export function formatDurationFromMilliseconds(duration: number | null | undefined) {
  if (typeof duration !== "number" || !Number.isFinite(duration)) {
    return "00:00";
  }

  return formatDurationClock(duration / 3600000);
}
