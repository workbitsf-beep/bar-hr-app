/**
 * The Italian national holidays of a year, as day keys (YYYY-MM-DD). The
 * town's patron saint is not here: it changes from place to place, and a
 * venue marks it as a closure in the calendar.
 */
function easterSunday(year: number) {
  // Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

export function italianHolidays(year: number) {
  const fixed = ["01-01", "01-06", "04-25", "05-01", "06-02", "08-15", "11-01", "12-08", "12-25", "12-26"].map((day) => `${year}-${day}`);
  const easterMonday = easterSunday(year);
  easterMonday.setUTCDate(easterMonday.getUTCDate() + 1);
  return new Set([...fixed, easterMonday.toISOString().slice(0, 10)]);
}
