import "server-only";

import { ActivityType, RequestStatus, RequestType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildMonthlyDataset } from "@/lib/reporting";

/**
 * The month's attendance the way a labour consultant enters it in payroll
 * software (Zucchetti, TeamSystem, Inaz...): per person and per day, hours
 * by kind - ordinary, overtime, holiday, leave, sickness - under the codes
 * their software uses. The codes are the venue's to set: every consultant
 * names them differently.
 */
export type PayrollCodeKey = "ordinary" | "overtime" | "holiday" | "leave" | "sickness" | "closure" | "publicHoliday" | "training";

export const PAYROLL_CODE_LABELS: Record<PayrollCodeKey, string> = {
  ordinary: "Ore ordinarie",
  overtime: "Straordinari",
  holiday: "Ferie",
  leave: "Permessi",
  sickness: "Malattia",
  closure: "Chiusura del locale",
  publicHoliday: "Festività",
  training: "Formazione",
};

export const DEFAULT_PAYROLL_CODES: Record<PayrollCodeKey, string> = {
  ordinary: "ORD",
  overtime: "STR",
  holiday: "FER",
  leave: "PER",
  sickness: "MAL",
  closure: "CHI",
  publicHoliday: "FES",
  training: "FOR",
};

export function payrollCodesOf(value: Prisma.JsonValue | null | undefined): Record<PayrollCodeKey, string> {
  const stored = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const codes = { ...DEFAULT_PAYROLL_CODES };
  for (const key of Object.keys(codes) as PayrollCodeKey[]) {
    const code = stored[key];
    if (typeof code === "string" && code.trim()) codes[key] = code.trim().slice(0, 12);
  }
  return codes;
}

export type PayrollEntry = {
  /** YYYY-MM-DD */
  date: string;
  kind: PayrollCodeKey;
  hours: number;
  /** 1 for a whole day away (holiday, sickness, closure), 0 for hours. */
  days: number;
  note?: string;
};

export type PayrollPerson = {
  userId: string;
  firstName: string;
  lastName: string;
  payrollCode: string | null;
  contractWeeklyHours: number | null;
  dailyHours: number | null;
  entries: PayrollEntry[];
  totals: Record<PayrollCodeKey, { hours: number; days: number }>;
  workedDays: number;
  onCallHours: number;
  /** Sickness certificate numbers, for the consultant. */
  certificates: string[];
  warnings: string[];
};

export type PayrollMonth = {
  month: number;
  year: number;
  venueName: string;
  legalName: string | null;
  vatNumber: string | null;
  codes: Record<PayrollCodeKey, string>;
  people: PayrollPerson[];
};

const round2 = (value: number) => Math.round(value * 100) / 100;

function emptyTotals(): PayrollPerson["totals"] {
  return {
    ordinary: { hours: 0, days: 0 },
    overtime: { hours: 0, days: 0 },
    holiday: { hours: 0, days: 0 },
    leave: { hours: 0, days: 0 },
    sickness: { hours: 0, days: 0 },
    closure: { hours: 0, days: 0 },
    publicHoliday: { hours: 0, days: 0 },
    training: { hours: 0, days: 0 },
  };
}

/** Monday of the week a day key falls in, as a key: weeks group overtime. */
function weekOf(dayKey: string) {
  const date = new Date(`${dayKey}T12:00:00Z`);
  const shift = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - shift);
  return date.toISOString().slice(0, 10);
}

function spanHoursOnDay(startsAt: string, endsAt: string) {
  const hours = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 3_600_000;
  return hours > 0 && hours < 12 ? round2(hours) : null;
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

  const [bar, settings, members, sickness, overtimeRequests] = await Promise.all([
    prisma.bar.findUniqueOrThrow({
      where: { id: input.barId },
      select: { name: true, legalName: true, vatNumber: true, ownerId: true, activityType: true },
    }),
    prisma.barSettings.findUnique({ where: { barId: input.barId }, select: { payrollCodes: true } }),
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
  ]);

  // Six working days a week in a bar or restaurant, five in an office.
  const workingDays = bar.activityType === ActivityType.COMPANY ? 5 : 6;
  const people: PayrollPerson[] = [];

  for (const member of members.filter((item) => item.userId !== bar.ownerId)) {
    const dataset = await buildMonthlyDataset(input.barId, member.userId, input.month, input.year, bar.activityType);
    const dailyHours = member.contractWeeklyHours ? round2(member.contractWeeklyHours / workingDays) : null;
    const entries: PayrollEntry[] = [];
    const warnings: string[] = [];
    let onCallHours = 0;
    let workedDays = 0;
    const workedByWeek = new Map<string, number>();
    const approvedOvertime = overtimeRequests
      .filter((request) => request.employeeId === member.userId && request.startsAt && request.endsAt)
      .reduce((sum, request) => sum + (request.endsAt!.getTime() - request.startsAt!.getTime()) / 3_600_000, 0);

    for (const day of dataset.groupedLogs) {
      const worked = day.totals.roundedHours;
      onCallHours += day.entries.filter((entry) => entry.onCall).reduce((sum, entry) => sum + entry.roundedHours, 0);

      if (worked > 0) {
        workedDays += 1;
        if (member.contractWeeklyHours) {
          // Ordinary up to the week's contract hours, day by day; the rest is overtime.
          const week = weekOf(day.date);
          const before = workedByWeek.get(week) ?? 0;
          const ordinary = Math.max(0, Math.min(worked, member.contractWeeklyHours - before));
          workedByWeek.set(week, before + worked);
          if (ordinary > 0) entries.push({ date: day.date, kind: "ordinary", hours: round2(ordinary), days: 0 });
          if (worked - ordinary > 0) entries.push({ date: day.date, kind: "overtime", hours: round2(worked - ordinary), days: 0 });
        } else {
          entries.push({ date: day.date, kind: "ordinary", hours: round2(worked), days: 0 });
        }
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
        // A whole day off is not also a day worked: clocked hours win.
        if (worked > 0 && kind !== "leave" && kind !== "training") continue;
        const partial = spanHoursOnDay(item.startsAt, item.endsAt);
        if (kind === "leave" || (kind === "training" && partial)) {
          entries.push({ date: day.date, kind, hours: partial ?? dailyHours ?? 0, days: partial ? 0 : 1 });
        } else {
          entries.push({ date: day.date, kind, hours: dailyHours ?? 0, days: 1 });
        }
      }
    }

    // Without contract hours the only overtime known is the one approved in the app.
    if (!member.contractWeeklyHours && approvedOvertime > 0) {
      warnings.push(`${round2(approvedOvertime)} ore di straordinario approvate nell'app sono comprese nelle ordinarie: scrivi le ore settimanali del contratto per separarle.`);
    }
    if (!member.payrollCode) warnings.push("Manca la matricola o il codice fiscale.");

    const totals = emptyTotals();
    for (const entry of entries) {
      totals[entry.kind].hours = round2(totals[entry.kind].hours + entry.hours);
      totals[entry.kind].days += entry.days;
    }

    people.push({
      userId: member.userId,
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      payrollCode: member.payrollCode,
      contractWeeklyHours: member.contractWeeklyHours,
      dailyHours,
      entries: entries.sort((a, b) => a.date.localeCompare(b.date)),
      totals,
      workedDays,
      onCallHours: round2(onCallHours),
      certificates: sickness.filter((request) => request.employeeId === member.userId).map((request) => request.certificateCode!),
      warnings,
    });
  }

  people.sort((a, b) => a.lastName.localeCompare(b.lastName, "it") || a.firstName.localeCompare(b.firstName, "it"));
  return {
    month: input.month,
    year: input.year,
    venueName: bar.name,
    legalName: bar.legalName,
    vatNumber: bar.vatNumber,
    codes: payrollCodesOf(settings?.payrollCodes),
    people,
  };
}

const KIND_ORDER: PayrollCodeKey[] = ["ordinary", "overtime", "holiday", "leave", "sickness", "publicHoliday", "closure", "training"];

function decimalComma(value: number) {
  return value.toFixed(2).replace(".", ",");
}

function italianDate(dayKey: string) {
  const [year, month, day] = dayKey.split("-");
  return `${day}/${month}/${year}`;
}

/** One row per person, day and kind of hour: the file payroll software imports. */
export function payrollCsv(data: PayrollMonth) {
  const rows = [["Matricola", "Cognome", "Nome", "Data", "Causale", "Descrizione", "Ore", "Giorni"].join(";")];
  for (const person of data.people) {
    for (const entry of person.entries) {
      rows.push(
        [
          person.payrollCode ?? "",
          person.lastName,
          person.firstName,
          italianDate(entry.date),
          data.codes[entry.kind],
          PAYROLL_CODE_LABELS[entry.kind],
          decimalComma(entry.hours),
          String(entry.days),
        ]
          .map((cell) => (/[;"\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell))
          .join(";"),
      );
    }
  }
  // The BOM makes Excel read the accents right.
  return `﻿${rows.join("\r\n")}\r\n`;
}

/** Summary, the month's grid and the same rows as the CSV, in one workbook. */
export async function payrollWorkbook(data: PayrollMonth) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Workbit";
  const monthName = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(new Date(data.year, data.month - 1, 1));
  const header = (sheet: import("exceljs").Worksheet) => {
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEECFB" } };
    sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 3 }];
  };

  const summary = workbook.addWorksheet("Riepilogo");
  summary.columns = [
    { header: "Matricola / CF", key: "code", width: 18 },
    { header: "Cognome", key: "lastName", width: 18 },
    { header: "Nome", key: "firstName", width: 16 },
    { header: "Ore contratto / sett.", key: "contract", width: 12 },
    { header: "Giorni lavorati", key: "workedDays", width: 10 },
    ...KIND_ORDER.map((kind) => ({
      header: `${PAYROLL_CODE_LABELS[kind]} (${data.codes[kind]}) ${["holiday", "sickness", "closure", "publicHoliday"].includes(kind) ? "gg" : "ore"}`,
      key: kind,
      width: 14,
    })),
    { header: "Di cui su chiamata (ore)", key: "onCall", width: 12 },
    { header: "Certificati malattia", key: "certificates", width: 22 },
    { header: "Da controllare", key: "warnings", width: 60 },
  ];
  header(summary);
  for (const person of data.people) {
    const row: Record<string, string | number> = {
      code: person.payrollCode ?? "",
      lastName: person.lastName,
      firstName: person.firstName,
      contract: person.contractWeeklyHours ?? "",
      workedDays: person.workedDays,
      onCall: person.onCallHours || "",
      certificates: person.certificates.join(", "),
      warnings: person.warnings.join(" "),
    };
    for (const kind of KIND_ORDER) {
      const total = person.totals[kind];
      row[kind] = ["holiday", "sickness", "closure", "publicHoliday"].includes(kind) ? total.days || "" : total.hours || "";
    }
    summary.addRow(row);
  }
  summary.addRow({});
  summary.addRow({ code: `${data.legalName || data.venueName}${data.vatNumber ? ` · P.IVA ${data.vatNumber}` : ""} · ${monthName}` });
  summary.addRow({ code: "Ore arrotondate secondo le regole del locale. Ferie e malattia in giorni; le ore usano le ore settimanali del contratto divise per i giorni lavorativi." });

  const days = new Date(data.year, data.month, 0).getDate();
  const grid = workbook.addWorksheet("Foglio presenze");
  grid.columns = [
    { header: "Matricola / CF", key: "code", width: 16 },
    { header: "Cognome", key: "lastName", width: 16 },
    { header: "Nome", key: "firstName", width: 14 },
    ...Array.from({ length: days }, (_, index) => {
      const date = new Date(data.year, data.month - 1, index + 1);
      const weekday = new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(date).slice(0, 2);
      return { header: `${index + 1} ${weekday}`, key: `d${index + 1}`, width: 7 };
    }),
    { header: "Totale ore", key: "total", width: 10 },
  ];
  header(grid);
  for (const person of data.people) {
    const row: Record<string, string | number> = { code: person.payrollCode ?? "", lastName: person.lastName, firstName: person.firstName };
    let total = 0;
    for (const entry of person.entries) {
      const key = `d${Number(entry.date.slice(8, 10))}`;
      const piece =
        entry.kind === "ordinary" || entry.kind === "overtime"
          ? entry.hours
          : `${data.codes[entry.kind]}${entry.days ? "" : ` ${entry.hours}`}`;
      if (entry.kind === "ordinary" || entry.kind === "overtime") total += entry.hours;
      const previous = row[key];
      row[key] =
        previous === undefined
          ? piece
          : typeof previous === "number" && typeof piece === "number"
            ? round2(previous + piece)
            : `${previous} ${piece}`;
    }
    row.total = round2(total);
    grid.addRow(row);
  }
  grid.addRow({});
  grid.addRow({ code: `Legenda: numero = ore lavorate; ${KIND_ORDER.slice(2).map((kind) => `${data.codes[kind]} = ${PAYROLL_CODE_LABELS[kind]}`).join(", ")}` });

  const rows = workbook.addWorksheet("Tracciato");
  rows.columns = [
    { header: "Matricola", key: "code", width: 16 },
    { header: "Cognome", key: "lastName", width: 16 },
    { header: "Nome", key: "firstName", width: 14 },
    { header: "Data", key: "date", width: 12 },
    { header: "Causale", key: "cause", width: 10 },
    { header: "Descrizione", key: "label", width: 20 },
    { header: "Ore", key: "hours", width: 8 },
    { header: "Giorni", key: "days", width: 8 },
  ];
  header(rows);
  for (const person of data.people) {
    for (const entry of person.entries) {
      rows.addRow({
        code: person.payrollCode ?? "",
        lastName: person.lastName,
        firstName: person.firstName,
        date: italianDate(entry.date),
        cause: data.codes[entry.kind],
        label: PAYROLL_CODE_LABELS[entry.kind],
        hours: entry.hours,
        days: entry.days,
      });
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function payrollFileName(data: PayrollMonth, extension: "xlsx" | "csv") {
  const venue = (data.legalName || data.venueName).replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "presenze";
  return `presenze-${venue}-${data.year}-${String(data.month).padStart(2, "0")}.${extension}`;
}
