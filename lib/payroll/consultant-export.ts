import "server-only";

import { ActivityType, RequestStatus, RequestType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildMonthlyDataset } from "@/lib/reporting";
import {
  DAY_KINDS,
  PAYROLL_CODE_LABELS,
  PAYROLL_KINDS,
  payrollCsvText,
  payrollFileBaseName,
  renderPayrollTable,
  type PayrollCodeKey,
  type PayrollEntry,
  type PayrollMonthData,
  type PayrollPersonData,
  type PayrollTemplate,
} from "./template";

/**
 * The month's attendance the way a labour consultant enters it in payroll
 * software: per person and per day, hours by kind - ordinary, overtime,
 * holiday, leave, sickness. The hours come from the clock-ins, or, for a
 * venue that does not clock in, from the shifts in the calendar: the file
 * follows the calendar as shifts are added, moved and deleted. A day
 * corrected at review replaces that day in the file only.
 */

export type PayrollSource = "CLOCK" | "SHIFTS";

export type PayrollFlag = { date: string; message: string };

export type PayrollPerson = PayrollPersonData & {
  dailyHours: number | null;
  totals: Record<PayrollCodeKey, { hours: number; days: number }>;
  workedDays: number;
  onCallHours: number;
  /** Sickness certificate numbers, for the consultant. */
  certificates: string[];
  /** Days worth a look before sending. */
  flags: PayrollFlag[];
  /** Days corrected at review. */
  overridden: string[];
  warnings: string[];
};

export type PayrollMonth = Omit<PayrollMonthData, "people"> & {
  source: PayrollSource;
  people: PayrollPerson[];
  /** Shifts not published yet, left out when the hours come from the shifts. */
  draftShifts: number;
  /** Hours past the weekly contract are overtime (owner's choice). */
  countOvertime: boolean;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

function emptyTotals(): PayrollPerson["totals"] {
  return Object.fromEntries(PAYROLL_KINDS.map((kind) => [kind, { hours: 0, days: 0 }])) as PayrollPerson["totals"];
}

/** Same local day key as the monthly report. */
function dayKeyOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Monday of the week a day key falls in: weeks group overtime. */
function weekOf(dayKey: string) {
  const date = new Date(`${dayKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function spanHoursOnDay(startsAt: string, endsAt: string) {
  const hours = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 3_600_000;
  return hours > 0 && hours < 12 ? round2(hours) : null;
}

const timeOf = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

export function entriesOf(value: Prisma.JsonValue): Array<Omit<PayrollEntry, "date">> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const kind = item.kind as PayrollCodeKey;
      if (!PAYROLL_KINDS.includes(kind)) return null;
      const hours = Number(item.hours) || 0;
      const days = Number(item.days) || 0;
      return hours > 0 || days > 0 ? { kind, hours: round2(hours), days } : null;
    })
    .filter((item): item is Omit<PayrollEntry, "date"> => item !== null);
}

export async function payrollSourceOf(barId: string): Promise<PayrollSource> {
  const settings = await prisma.barSettings.findUnique({ where: { barId }, select: { payrollSource: true, timeTrackingEnabled: true } });
  if (settings?.payrollSource === "CLOCK" || settings?.payrollSource === "SHIFTS") return settings.payrollSource;
  return settings && !settings.timeTrackingEnabled ? "SHIFTS" : "CLOCK";
}

export async function buildPayrollMonth(input: {
  barId: string;
  month: number;
  year: number;
  /** The members the person exporting may see (memberScopeWhere). */
  memberWhere?: Prisma.EmployeeBarWhereInput;
}): Promise<PayrollMonth> {
  const monthStart = new Date(input.year, input.month - 1, 1);
  const monthEnd = new Date(input.year, input.month, 1);

  const [bar, settings, members, sickness, overtimeRequests, overrides] = await Promise.all([
    prisma.bar.findUniqueOrThrow({
      where: { id: input.barId },
      select: { name: true, legalName: true, vatNumber: true, ownerId: true, activityType: true },
    }),
    prisma.barSettings.findUnique({
      where: { barId: input.barId },
      select: { payrollSource: true, timeTrackingEnabled: true, payrollBreakMinutes: true, payrollBreakAfterHours: true, payrollOvertime: true },
    }),
    prisma.employeeBar.findMany({
      where: {
        barId: input.barId,
        OR: [{ isActive: true }, { endedAt: { gte: monthStart } }],
        hiredAt: { lt: monthEnd },
        ...(input.memberWhere ?? {}),
      },
      select: {
        userId: true,
        payrollCode: true,
        contractWeeklyHours: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.request.findMany({
      where: {
        barId: input.barId,
        type: RequestType.SICKNESS,
        status: RequestStatus.APPROVED,
        startsAt: { lt: monthEnd },
        endsAt: { gte: monthStart },
        certificateCode: { not: null },
      },
      select: { employeeId: true, certificateCode: true },
    }),
    prisma.request.findMany({
      where: {
        barId: input.barId,
        type: RequestType.OVERTIME,
        status: RequestStatus.APPROVED,
        startsAt: { gte: monthStart, lt: monthEnd },
      },
      select: { employeeId: true, startsAt: true, endsAt: true },
    }),
    prisma.payrollDayOverride.findMany({
      where: {
        barId: input.barId,
        date: { gte: new Date(Date.UTC(input.year, input.month - 1, 1)), lt: new Date(Date.UTC(input.year, input.month, 1)) },
      },
      select: { userId: true, date: true, entries: true },
    }),
  ]);

  const source: PayrollSource =
    settings?.payrollSource === "CLOCK" || settings?.payrollSource === "SHIFTS"
      ? settings.payrollSource
      : settings && !settings.timeTrackingEnabled
        ? "SHIFTS"
        : "CLOCK";
  const people = members.filter((item) => item.userId !== bar.ownerId);
  const userIds = people.map((member) => member.userId);

  // The calendar: hours themselves when the venue does not clock in, and a
  // check on the clock-ins when it does (a shift nobody clocked).
  const shifts = userIds.length
    ? await prisma.shift.findMany({
        where: {
          barId: input.barId,
          startTime: { gte: monthStart, lt: monthEnd },
          OR: [{ assignedToId: { in: userIds } }, { assignments: { some: { userId: { in: userIds } } } }],
        },
        select: {
          startTime: true,
          endTime: true,
          isOnCall: true,
          confirmedAt: true,
          assignedToId: true,
          assignments: { select: { userId: true } },
        },
        orderBy: { startTime: "asc" },
      })
    : [];
  const shiftsByUser = new Map<string, typeof shifts>();
  for (const shift of shifts) {
    const owners = new Set([shift.assignedToId, ...shift.assignments.map((assignment) => assignment.userId)].filter(Boolean) as string[]);
    for (const userId of owners) shiftsByUser.set(userId, [...(shiftsByUser.get(userId) ?? []), shift]);
  }
  const draftShifts = source === "SHIFTS" ? shifts.filter((shift) => !shift.confirmedAt).length : 0;

  const breakMinutes = settings?.payrollBreakMinutes ?? 0;
  const breakAfter = settings?.payrollBreakAfterHours ?? 0;
  const shiftHours = (shift: (typeof shifts)[number]) => {
    const hours = (shift.endTime.getTime() - shift.startTime.getTime()) / 3_600_000;
    if (hours <= 0 || hours > 16) return 0;
    return round2(breakMinutes > 0 && hours >= breakAfter ? Math.max(0, hours - breakMinutes / 60) : hours);
  };

  // A bar's long shift is ordinary hours unless the owner says otherwise.
  const countOvertime = settings?.payrollOvertime ?? bar.activityType === ActivityType.COMPANY;
  // Six working days a week in a bar or restaurant, five in an office.
  const workingDays = bar.activityType === ActivityType.COMPANY ? 5 : 6;
  const result: PayrollPerson[] = [];

  for (const member of people) {
    // Always the day-by-day report: absences on every day they cover.
    const dataset = await buildMonthlyDataset(input.barId, member.userId, input.month, input.year, ActivityType.RESTAURANT);
    const dailyHours = member.contractWeeklyHours ? round2(member.contractWeeklyHours / workingDays) : null;
    const memberShifts = shiftsByUser.get(member.userId) ?? [];
    const flags: PayrollFlag[] = [];
    const warnings: string[] = [];
    let onCallHours = 0;

    // Day by day: worked hours, and the absences on the calendar.
    type Day = { worked: number; absences: Array<Omit<PayrollEntry, "date">> };
    const days = new Map<string, Day>();
    const dayOf = (key: string) => {
      const existing = days.get(key);
      if (existing) return existing;
      const created: Day = { worked: 0, absences: [] };
      days.set(key, created);
      return created;
    };

    for (const day of dataset.groupedLogs) {
      const entry = dayOf(day.date);
      if (source === "CLOCK") {
        entry.worked = round2(day.totals.roundedHours);
        onCallHours += day.entries.filter((item) => item.onCall).reduce((sum, item) => sum + item.roundedHours, 0);
        if (day.totals.roundedHours > 12) flags.push({ date: day.date, message: `${round2(day.totals.roundedHours)} ore timbrate in un giorno` });
      }
      const seen = new Set<string>();
      for (const item of day.items ?? []) {
        const kind: PayrollCodeKey | null =
          item.type === "Ferie"
            ? "holiday"
            : item.type === "Permesso"
              ? "leave"
              : item.type === "Malattia"
                ? "sickness"
                : item.type === "Corso"
                  ? "training"
                  : item.type === "Chiusura"
                    ? /festivit/i.test(item.title) ? "publicHoliday" : "closure"
                    : null;
        if (!kind || seen.has(kind)) continue;
        seen.add(kind);
        const partial = spanHoursOnDay(item.startsAt, item.endsAt);
        if (kind === "leave" || (kind === "training" && partial)) {
          entry.absences.push({ kind, hours: partial ?? dailyHours ?? 0, days: partial ? 0 : 1 });
        } else {
          entry.absences.push({ kind, hours: dailyHours ?? 0, days: 1 });
        }
      }
    }

    if (source === "SHIFTS") {
      let onCallShifts = 0;
      for (const shift of memberShifts) {
        if (!shift.confirmedAt) continue;
        if (shift.isOnCall) {
          onCallShifts += 1;
          continue;
        }
        const key = dayKeyOf(shift.startTime);
        const day = dayOf(key);
        if (day.absences.some((absence) => absence.days > 0)) {
          flags.push({ date: key, message: `Turno ${timeOf.format(shift.startTime)}–${timeOf.format(shift.endTime)} in un giorno di ${PAYROLL_CODE_LABELS[day.absences.find((absence) => absence.days > 0)!.kind].toLowerCase()}: conta l'assenza` });
          continue;
        }
        day.worked = round2(day.worked + shiftHours(shift));
      }
      if (onCallShifts) warnings.push(`${onCallShifts} ${onCallShifts === 1 ? "turno su chiamata non è contato" : "turni su chiamata non sono contati"}: se ha lavorato, correggi il giorno.`);
    } else {
      // A published shift with nobody clocked and no absence: forgotten, or not worked?
      for (const shift of memberShifts) {
        if (!shift.confirmedAt || shift.isOnCall || shift.endTime > new Date()) continue;
        const key = dayKeyOf(shift.startTime);
        const day = days.get(key);
        if (!day || (day.worked === 0 && day.absences.length === 0)) {
          flags.push({ date: key, message: `Turno ${timeOf.format(shift.startTime)}–${timeOf.format(shift.endTime)} senza timbratura` });
        }
      }
    }

    const corrected = new Map(
      overrides.filter((item) => item.userId === member.userId).map((item) => [item.date.toISOString().slice(0, 10), entriesOf(item.entries)]),
    );
    for (const key of corrected.keys()) dayOf(key);

    const entries: PayrollEntry[] = [];
    const workedByWeek = new Map<string, number>();
    let workedDays = 0;
    for (const key of Array.from(days.keys()).sort()) {
      const day = days.get(key)!;
      const fixed = corrected.get(key);
      if (fixed) {
        // The owner's word for the day; its hours still count towards the week.
        const worked = fixed.filter((item) => item.kind === "ordinary" || item.kind === "overtime").reduce((sum, item) => sum + item.hours, 0);
        if (worked > 0) workedDays += 1;
        workedByWeek.set(weekOf(key), (workedByWeek.get(weekOf(key)) ?? 0) + worked);
        entries.push(...fixed.map((item) => ({ ...item, date: key })));
        continue;
      }

      const worked = day.worked;
      if (worked > 0) {
        workedDays += 1;
        if (member.contractWeeklyHours && countOvertime) {
          // Ordinary up to the week's contract hours, day by day; the rest is overtime.
          const week = weekOf(key);
          const before = workedByWeek.get(week) ?? 0;
          const ordinary = Math.max(0, Math.min(worked, member.contractWeeklyHours - before));
          workedByWeek.set(week, before + worked);
          if (ordinary > 0) entries.push({ date: key, kind: "ordinary", hours: round2(ordinary), days: 0 });
          if (worked - ordinary > 0) entries.push({ date: key, kind: "overtime", hours: round2(worked - ordinary), days: 0 });
        } else {
          entries.push({ date: key, kind: "ordinary", hours: round2(worked), days: 0 });
        }
      }
      for (const absence of day.absences) {
        // A whole day away is not also a day worked: the hours worked win.
        if (worked > 0 && absence.days > 0) continue;
        entries.push({ ...absence, date: key });
      }
    }

    const approvedOvertime = overtimeRequests
      .filter((request) => request.employeeId === member.userId && request.startsAt && request.endsAt)
      .reduce((sum, request) => sum + (request.endsAt!.getTime() - request.startsAt!.getTime()) / 3_600_000, 0);
    if (countOvertime && !member.contractWeeklyHours && approvedOvertime > 0) {
      warnings.push(`${round2(approvedOvertime)} ore di straordinario approvate sono comprese nelle ordinarie: scrivi le ore settimanali del contratto per separarle.`);
    }
    if (!member.contractWeeklyHours && entries.some((entry) => DAY_KINDS.includes(entry.kind))) {
      warnings.push("Ferie e malattia sono solo in giorni: con le ore del contratto avrebbero anche le ore.");
    }
    if (!member.payrollCode) warnings.push("Manca la matricola o il codice fiscale.");

    const totals = emptyTotals();
    for (const entry of entries) {
      totals[entry.kind].hours = round2(totals[entry.kind].hours + entry.hours);
      totals[entry.kind].days += entry.days;
    }

    result.push({
      userId: member.userId,
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      payrollCode: member.payrollCode,
      contractWeeklyHours: member.contractWeeklyHours,
      dailyHours,
      entries,
      totals,
      workedDays,
      onCallHours: round2(onCallHours),
      certificates: sickness.filter((request) => request.employeeId === member.userId).map((request) => request.certificateCode!),
      flags: flags.filter((flag) => !corrected.has(flag.date)).sort((a, b) => a.date.localeCompare(b.date)),
      overridden: Array.from(corrected.keys()).sort(),
      warnings,
    });
  }

  result.sort((a, b) => a.lastName.localeCompare(b.lastName, "it") || a.firstName.localeCompare(b.firstName, "it"));
  return {
    month: input.month,
    year: input.year,
    venueName: bar.name,
    legalName: bar.legalName,
    vatNumber: bar.vatNumber,
    source,
    people: result,
    draftShifts,
    countOvertime,
  };
}

const MIME = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
};

/** The file the template describes: its bytes, name and type. */
export async function payrollFile(data: PayrollMonth, template: PayrollTemplate) {
  const table = renderPayrollTable(data, template);
  const fileName = `${payrollFileBaseName(data, template)}.${template.fileType}`;

  if (template.fileType === "csv") {
    const text = payrollCsvText(table, template);
    const bytes =
      template.encoding === "latin1"
        ? Buffer.from(text.replace(/[^\u0000-ÿ]/g, (char) => (char === "€" ? "E" : "?")), "latin1")
        : Buffer.from(template.encoding === "utf8bom" ? `﻿${text}` : text, "utf8");
    return { fileName, mimeType: `${MIME.csv}; charset=${template.encoding === "latin1" ? "iso-8859-1" : "utf-8"}`, content: bytes };
  }

  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Workbit";
  const sheet = workbook.addWorksheet(template.sheetName || "Presenze");
  if (table.header) {
    sheet.addRow(table.header);
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }
  for (const row of table.rows) sheet.addRow(row);
  // Excel shows the decimal separator of the computer it is opened on.
  sheet.eachRow((row) =>
    row.eachCell((cell) => {
      if (typeof cell.value === "number" && !Number.isInteger(cell.value)) cell.numFmt = "0.00";
    }),
  );
  sheet.columns.forEach((column, index) => {
    const widest = Math.max(
      String(table.header?.[index] ?? "").length,
      ...table.rows.slice(0, 200).map((row) => String(row[index] ?? "").length),
    );
    column.width = template.layout === "calendar" && index >= template.columns.length ? Math.max(5, widest + 1) : Math.min(40, Math.max(8, widest + 2));
  });
  if (table.legend) {
    sheet.addRow([]);
    sheet.addRow([table.legend]);
  }

  if (template.summarySheet) {
    const summary = workbook.addWorksheet(sheet.name.toLowerCase() === "riepilogo" ? "Riepilogo del mese" : "Riepilogo");
    const kinds = PAYROLL_KINDS.filter((kind) => template.codes[kind]);
    summary.addRow([
      "Matricola / CF",
      "Cognome",
      "Nome",
      "Ore contratto / sett.",
      "Giorni lavorati",
      ...kinds.map((kind) => `${PAYROLL_CODE_LABELS[kind]} (${template.codes[kind]}) ${DAY_KINDS.includes(kind) ? "gg" : "ore"}`),
      "Certificati malattia",
    ]);
    summary.getRow(1).font = { bold: true };
    for (const person of data.people) {
      summary.addRow([
        person.payrollCode ?? "",
        person.lastName,
        person.firstName,
        person.contractWeeklyHours ?? "",
        person.workedDays,
        ...kinds.map((kind) => (DAY_KINDS.includes(kind) ? person.totals[kind].days || "" : person.totals[kind].hours || "")),
        person.certificates.join(", "),
      ]);
    }
    summary.addRow([]);
    summary.addRow([
      `${data.legalName || data.venueName}${data.vatNumber ? ` · P.IVA ${data.vatNumber}` : ""} · ore ${data.source === "SHIFTS" ? "dai turni del calendario" : "dalle timbrature"}`,
    ]);
    summary.columns.forEach((column, index) => {
      column.width = index < 3 ? 18 : 14;
    });
  }

  return { fileName, mimeType: MIME.xlsx, content: Buffer.from(await workbook.xlsx.writeBuffer()) };
}
