export type ShiftPhotoMember = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

export type ParsedShiftPhotoDraft = {
  date: string;
  startTime: string;
  endTime: string;
  employeeId: string;
  employeeName: string;
  sourceLine: string;
};

const weekdayMatchers: Array<{ weekday: number; tokens: string[] }> = [
  { weekday: 1, tokens: ["lun", "lunedi", "lunedi", "mon", "monday"] },
  { weekday: 2, tokens: ["mar", "martedi", "martedi", "tue", "tuesday"] },
  { weekday: 3, tokens: ["mer", "mercoledi", "mercoledi", "wed", "wednesday"] },
  { weekday: 4, tokens: ["gio", "giovedi", "giovedi", "thu", "thursday"] },
  { weekday: 5, tokens: ["ven", "venerdi", "venerdi", "fri", "friday"] },
  { weekday: 6, tokens: ["sab", "sabato", "sat", "saturday"] },
  { weekday: 0, tokens: ["dom", "domenica", "sun", "sunday"] },
];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[|_•·]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function parseDateKey(value: string) {
  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
}

function extractExplicitDate(line: string, referenceYear: number) {
  const match = line.match(/\b(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?\b/);

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const yearValue = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : referenceYear;
  const parsed = new Date(yearValue, month - 1, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getDate() !== day ||
    parsed.getMonth() !== month - 1
  ) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function extractTimeRange(line: string) {
  const match = line.match(
    /\b(\d{1,2})[:.](\d{2})\s*(?:-|–|—|to|a|alle?|fino a|\/)\s*(\d{1,2})[:.](\d{2})\b/
  );

  if (!match) {
    return null;
  }

  return {
    startTime: `${pad2(Number(match[1]))}:${match[2]}`,
    endTime: `${pad2(Number(match[3]))}:${match[4]}`,
  };
}

function extractWeekday(line: string) {
  for (const entry of weekdayMatchers) {
    if (entry.tokens.some((token) => new RegExp(`\\b${token}\\b`, "i").test(line))) {
      return entry.weekday;
    }
  }

  return null;
}

function getNextMatchingWeekdayDate(
  weekday: number,
  rangeStart: Date,
  rangeEnd: Date,
  afterDate?: Date | null
) {
  const cursor = new Date(afterDate ?? rangeStart);
  cursor.setHours(0, 0, 0, 0);

  if (!afterDate) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (true) {
    cursor.setDate(cursor.getDate() + 1);

    if (cursor > rangeEnd) {
      return null;
    }

    if (cursor.getDay() === weekday) {
      return new Date(cursor);
    }
  }
}

function normalizeName(value: string) {
  return normalizeText(value).replace(/[^a-z0-9 ]/g, " ");
}

function findMember(line: string, members: ShiftPhotoMember[]) {
  const normalizedLine = normalizeName(line);
  let bestMember: ShiftPhotoMember | null = null;
  let bestScore = 0;

  for (const member of members) {
    const firstName = normalizeName(member.firstName);
    const lastName = normalizeName(member.lastName);
    const fullName = normalizeName(`${member.firstName} ${member.lastName}`);
    const reversedName = normalizeName(`${member.lastName} ${member.firstName}`);
    let score = 0;

    if (normalizedLine.includes(fullName) || normalizedLine.includes(reversedName)) {
      score = 4;
    } else if (normalizedLine.includes(firstName) && normalizedLine.includes(lastName)) {
      score = 3;
    } else if (normalizedLine.includes(fullName.split(" ")[0]) && normalizedLine.includes(lastName)) {
      score = 2.5;
    } else if (normalizedLine.includes(firstName) || normalizedLine.includes(lastName)) {
      score = 1.5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMember = member;
    }
  }

  return bestScore >= 1.5 ? bestMember : null;
}

export function parseShiftPhotoText(
  rawText: string,
  members: ShiftPhotoMember[],
  rangeStart: string,
  rangeEnd: string
) {
  const startDate = parseDateKey(rangeStart);
  const endDate = parseDateKey(rangeEnd);

  if (!startDate || !endDate) {
    return [];
  }

  const lines = rawText
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const parsed: ParsedShiftPhotoDraft[] = [];
  const seen = new Set<string>();
  let currentDate: Date | null = null;

  for (const rawLine of lines) {
    const normalizedLine = normalizeText(rawLine);

    if (!normalizedLine) {
      continue;
    }

    const explicitDate = extractExplicitDate(normalizedLine, startDate.getFullYear());
    if (explicitDate) {
      currentDate = explicitDate;
    }

    const weekday = extractWeekday(normalizedLine);
    if (!explicitDate && weekday !== null) {
      const resolvedDate = getNextMatchingWeekdayDate(weekday, startDate, endDate, currentDate);
      if (resolvedDate) {
        currentDate = resolvedDate;
      }
    }

    const timeRange = extractTimeRange(normalizedLine);
    if (!timeRange) {
      continue;
    }

    const targetDate = explicitDate ?? currentDate;

    if (!targetDate) {
      continue;
    }

    const member = findMember(normalizedLine, members);

    if (!member) {
      continue;
    }

    const parsedLine = {
      date: formatDateKey(targetDate),
      startTime: timeRange.startTime,
      endTime: timeRange.endTime,
      employeeId: member.id,
      employeeName: `${member.firstName} ${member.lastName}`.trim(),
      sourceLine: rawLine,
    };

    const dedupeKey = [
      parsedLine.date,
      parsedLine.startTime,
      parsedLine.endTime,
      parsedLine.employeeId,
    ].join("|");

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    parsed.push(parsedLine);
  }

  return parsed.sort((left, right) =>
    `${left.date} ${left.startTime}`.localeCompare(`${right.date} ${right.startTime}`)
  );
}
