import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { ActivityType, Role } from "@prisma/client";
import { buildMonthlyDataset } from "@/lib/reporting";
import { prisma } from "@/lib/prisma";
import { getActiveBarAccess } from "@/lib/permissions";
import { formatDurationClock } from "@/lib/time-format";
import { APP_TIME_ZONE } from "@/lib/time-zone";
import { withBar } from "@/lib/withBar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportBody = {
  userId?: string;
  month?: number;
  year?: number;
  format?: "json" | "pdf";
};

type SessionWithBar = {
  activeBarId: string;
  user: {
    id: string;
    role: Role;
  };
};

type MonthlyDataset = Awaited<ReturnType<typeof buildMonthlyDataset>>;

const WORKBIT_FONT_CANDIDATES = [
  path.join(process.cwd(), "public", "fonts", "Workbit-Regular.ttf"),
  path.join(
    process.cwd(),
    "node_modules",
    "next",
    "dist",
    "compiled",
    "@vercel",
    "og",
    "Geist-Regular.ttf"
  ),
];

function resolvePdfFontPath() {
  const fontPath = WORKBIT_FONT_CANDIDATES.find((candidate) => fs.existsSync(candidate));

  if (!fontPath) {
    throw new Error("Missing PDF font asset");
  }

  return fontPath;
}

function formatTime(dateIso: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(dateIso));
}

function formatDateTime(dateIso: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(dateIso));
}

function formatDateOnly(value: string | Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
}

function formatDateRange(start: string | Date, end?: string | Date | null): string {
  const startLabel = formatDateOnly(start);

  if (!end) {
    return startLabel;
  }

  const endLabel = formatDateOnly(end);
  return startLabel === endLabel ? startLabel : `${startLabel} -> ${endLabel}`;
}

function formatShortDay(value: string | Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    timeZone: APP_TIME_ZONE,
  })
    .format(new Date(value))
    .replace(".", "");
}

function formatMonthYear(month: number, year: number): string {
  return new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function hoursBetween(startIso: string, endIso: string) {
  const duration = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.max(0, Math.round((duration / 3600000) * 100) / 100);
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

async function createMonthlyPdfBuffer(input: {
  userLabel: string;
  employeeName?: string;
  employeeEmail?: string;
  employeeCode?: string;
  activityName?: string;
  month: number;
  year: number;
  dataset: Awaited<ReturnType<typeof buildMonthlyDataset>>;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdfFontPath = resolvePdfFontPath();
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    const doc = new PDFDocument({
      margin: 0,
      size: "A4",
      layout: "landscape",
      font: pdfFontPath,
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    const marginX = 26;
    const marginTop = 24;
    const marginBottom = 30;
    const pageWidth = doc.page.width - marginX * 2;
    const pageBottom = doc.page.height - marginBottom;
    const navy = "#121833";
    const violet = "#7c3aed";
    const violetSoft = "#f5f0ff";
    const border = "#dfe5f1";
    const grid = "#edf1f7";
    const muted = "#667085";
    const colors = {
      worked: { fill: "#dcfce7", text: "#166534", dot: "#16a34a" },
      onCall: { fill: "#dbeafe", text: "#1d4ed8", dot: "#2563eb" },
      vacation: { fill: "#ede9fe", text: "#5b21b6", dot: "#7c3aed" },
      permission: { fill: "#ffedd5", text: "#9a3412", dot: "#f97316" },
      absence: { fill: "#fee2e2", text: "#991b1b", dot: "#dc2626" },
      empty: { fill: "#f1f5f9", text: "#475569", dot: "#94a3b8" },
    };

    type BadgeColor = (typeof colors)[keyof typeof colors];

    const drawText = (
      value: string,
      x: number,
      y: number,
      width: number,
      options: {
        size?: number;
        color?: string;
        align?: "left" | "center" | "right";
        height?: number;
        lineGap?: number;
      } = {}
    ) => {
      doc
        .font(pdfFontPath)
        .fillColor(options.color ?? "#111827")
        .fontSize(options.size ?? 8)
        .text(value, x, y, {
          width,
          height: options.height,
          align: options.align ?? "left",
          lineGap: options.lineGap ?? 0,
          ellipsis: true,
        });
      doc.fillColor("#111827");
    };

    const drawPanel = (x: number, y: number, width: number, height: number, fill = "#ffffff") => {
      doc.roundedRect(x, y, width, height, 9).fillAndStroke(fill, border);
    };

    const formatRange = (start?: string | null, end?: string | null) => {
      if (!start || !end) {
        return "-";
      }

      return `${formatTime(start)}-${formatTime(end)}`;
    };

    const getHours = (hours: number) => formatDurationClock(round(hours));

    const dayKeyDate = (dayKey: string) => new Date(`${dayKey}T12:00:00`);

    const getMonthDayKeys = () => {
      const days: string[] = [];
      const cursor = new Date(input.year, input.month - 1, 1, 12, 0, 0, 0);

      while (cursor.getMonth() === input.month - 1) {
        const year = cursor.getFullYear();
        const month = String(cursor.getMonth() + 1).padStart(2, "0");
        const day = String(cursor.getDate()).padStart(2, "0");
        days.push(`${year}-${month}-${day}`);
        cursor.setDate(cursor.getDate() + 1);
      }

      return days;
    };

    const uniqueItems = (type: string) => {
      const seen = new Set<string>();
      const items = input.dataset.groupedLogs.flatMap((day) => day.items ?? []).filter((item) => item.type === type);

      return items.filter((item) => {
        const key = `${item.id}-${item.type}`;
        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });
    };

    const sumItemHours = (type: string) =>
      uniqueItems(type).reduce((total, item) => total + hoursBetween(item.startsAt, item.endsAt), 0);

    const permissionItems = uniqueItems("Permesso");
    const vacationItems = uniqueItems("Ferie");
    const availabilityItems = uniqueItems("Indisponibilita");
    const onCallItems = uniqueItems("Reperibilita");
    const permissionHours = sumItemHours("Permesso");
    const vacationHours = sumItemHours("Ferie");
    const overtimeHours = sumItemHours("Straordinario");
    const workedDays = input.dataset.groupedLogs.filter((day) => day.entries.length > 0).length;

    const drawBadge = (label: string, x: number, y: number, width: number, color: BadgeColor) => {
      doc.roundedRect(x, y, width, 13, 6.5).fill(color.fill);
      drawText(label, x + 5, y + 3.2, width - 10, {
        size: 6.4,
        color: color.text,
        align: "center",
        height: 8,
      });
    };

    const badgeFor = (type: string): BadgeColor => {
      if (type.includes("Lavorato")) return colors.worked;
      if (type.includes("Reper")) return colors.onCall;
      if (type.includes("Ferie")) return colors.vacation;
      if (type.includes("Permesso")) return colors.permission;
      if (type.includes("Malattia") || type.includes("Congedo") || type.includes("Indispon")) return colors.absence;
      return colors.empty;
    };

    const drawHeader = () => {
      doc.rect(0, 0, doc.page.width, 78).fill("#ffffff");
      doc
        .roundedRect(marginX, marginTop, 42, 42, 12)
        .fill("#111936");

      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, marginX + 3, marginTop + 3, { width: 36, height: 36 });
        } catch {
          drawText("WB", marginX + 10, marginTop + 14, 24, { size: 12, color: "#ffffff", align: "center" });
        }
      } else {
        drawText("WB", marginX + 10, marginTop + 14, 24, { size: 12, color: "#ffffff", align: "center" });
      }

      drawText("WORKBIT", marginX + 54, marginTop + 2, 140, { size: 7.5, color: violet });
      drawText("Report Timbrature Dipendente", marginX + 54, marginTop + 14, 310, {
        size: 18,
        color: navy,
      });
      drawText(`Periodo: ${formatMonthYear(input.month, input.year)}`, marginX + 55, marginTop + 39, 260, {
        size: 8.5,
        color: muted,
      });

      drawText(`Generato il ${formatDateTime(new Date().toISOString())}`, doc.page.width - marginX - 210, marginTop + 9, 210, {
        size: 8,
        color: muted,
        align: "right",
      });
      drawText(input.activityName ?? "-", doc.page.width - marginX - 210, marginTop + 28, 210, {
        size: 10,
        color: navy,
        align: "right",
      });

      doc.moveTo(marginX, 74).lineTo(doc.page.width - marginX, 74).strokeColor(border).stroke();
    };

    const addPage = () => {
      doc.addPage();
      drawHeader();
      doc.y = 92;
    };

    const columns = [
      { key: "date", label: "Data", width: 52 },
      { key: "day", label: "Giorno", width: 38 },
      { key: "status", label: "Stato", width: 58 },
      { key: "type", label: "Tipo", width: 76 },
      { key: "planned", label: "Previsto", width: 88 },
      { key: "real", label: "Reale", width: 88 },
      { key: "total", label: "Ore ricon.", width: 64 },
      { key: "notes", label: "Note", width: pageWidth - 464 },
    ];
    const tableWidth = columns.reduce((total, column) => total + column.width, 0);
    const rowHeight = 24;

    const drawTableHeader = () => {
      const y = doc.y;
      doc.roundedRect(marginX, y, tableWidth, 24, 7).fillAndStroke(navy, navy);
      let x = marginX;
      columns.forEach((column) => {
        drawText(column.label, x + 4, y + 8, column.width - 8, {
          size: 7.2,
          color: "#ffffff",
          align: column.key === "note" || column.key === "type" ? "left" : "center",
        });
        x += column.width;
      });
      doc.y = y + 27;
    };

    const ensureRowSpace = () => {
      if (doc.y + rowHeight > pageBottom) {
        addPage();
        drawTableHeader();
      }
    };

    const drawRow = (
      values: {
        date: string;
        day: string;
        status: string;
        type: string;
        planned: string;
        real: string;
        total: string;
        notes: string;
      },
      color: BadgeColor,
      index: number
    ) => {
      ensureRowSpace();
      const y = doc.y;
      const fill = index % 2 === 0 ? "#ffffff" : "#fbfcff";
      doc.rect(marginX, y, tableWidth, rowHeight).fillAndStroke(fill, grid);
      let x = marginX;
      const rowValues = [
        values.date,
        values.day,
        values.status,
        values.type,
        values.planned,
        values.real,
        values.total,
        values.notes,
      ];

      rowValues.forEach((value, columnIndex) => {
        const column = columns[columnIndex];
        if (column.key === "status") {
          drawBadge(value, x + 5, y + 5.5, column.width - 10, color);
        } else {
          drawText(value, x + 4, y + 7, column.width - 8, {
            size: column.key === "notes" ? 6.8 : 7,
            color: column.key === "notes" ? "#344054" : "#111827",
            align: ["date", "day", "planned", "real", "total"].includes(column.key)
              ? "center"
              : "left",
            height: 10,
          });
        }
        x += column.width;
      });
      doc.y = y + rowHeight;
    };

    const buildRowsForDay = (dayKey: string) => {
      const day = input.dataset.groupedLogs.find((entry) => entry.date === dayKey);
      const rows: Array<{
        date?: string;
        day?: string;
        status: string;
        type: string;
        planned: string;
        real: string;
        total: string;
        notes: string;
        color: BadgeColor;
      }> = [];

      for (const entry of day?.entries ?? []) {
        rows.push({
          date: formatDateRange(entry.clockIn, entry.clockOut),
          day: formatShortDay(entry.clockIn),
          status: "Lavorato",
          type: "Turno",
          planned: formatRange(entry.plannedStart, entry.plannedEnd),
          real: formatRange(entry.clockIn, entry.clockOut),
          total: getHours(entry.roundedHours),
          notes: entry.realHours !== entry.roundedHours ? `Reali ${getHours(entry.realHours)}` : "-",
          color: colors.worked,
        });
      }

      for (const item of day?.items ?? []) {
        const total = formatDurationClock(hoursBetween(item.startsAt, item.endsAt));
        const itemType = item.type === "Straordinario" ? "Straordinario" : item.type;
        const status =
          itemType === "Permesso" || itemType === "Ferie" || itemType === "Malattia"
            ? itemType
            : itemType === "Indisponibilita"
              ? "Assenza"
              : itemType;

        rows.push({
          status,
          type: item.title || itemType,
          planned: formatRange(item.startsAt, item.endsAt),
          real: "-",
          total,
          notes: item.note || `${itemType} ${formatTime(item.startsAt)} - ${formatTime(item.endsAt)}`,
          color: badgeFor(itemType),
        });
      }

      if (rows.length === 0) {
        rows.push({
          status: "-",
          type: "-",
          planned: "-",
          real: "-",
          total: "-",
          notes: "-",
          color: colors.empty,
        });
      }

      return rows;
    };

    const drawTopSummary = () => {
      drawPanel(marginX, 88, pageWidth, 60, "#ffffff");
      const employeeName = input.employeeName ?? input.userLabel;
      const infoWidth = 210;
      drawText(employeeName, marginX + 14, 102, infoWidth, { size: 12, color: navy });
      drawText(`Email: ${input.employeeEmail ?? "-"}`, marginX + 14, 121, infoWidth, { size: 7.5, color: muted });
      drawText(`Matricola: ${input.employeeCode ?? "-"}`, marginX + 14, 134, infoWidth, { size: 7.5, color: muted });

      const metrics = [
        ["Ore reali", formatDurationClock(input.dataset.totals.realHours), colors.onCall.dot],
        ["Ore arrotondate", formatDurationClock(input.dataset.totals.roundedHours), colors.worked.dot],
        ["Giorni lavorati", String(workedDays), navy],
        ["Permessi", `${permissionItems.length} / ${formatDurationClock(permissionHours)}`, colors.permission.dot],
        ["Ferie", `${vacationItems.length} / ${formatDurationClock(vacationHours)}`, colors.vacation.dot],
        ["Indisponibilita", String(availabilityItems.length), colors.absence.dot],
        ["Straordinari", formatDurationClock(overtimeHours), colors.onCall.dot],
      ];
      const metricX = marginX + infoWidth + 18;
      const metricW = (pageWidth - infoWidth - 32) / metrics.length;

      metrics.forEach(([label, value, color], index) => {
        const x = metricX + index * metricW;
        if (index > 0) {
          doc.moveTo(x, 100).lineTo(x, 136).strokeColor(grid).stroke();
        }
        doc.circle(x + metricW / 2, 104, 3.5).fill(String(color));
        drawText(String(value), x + 4, 113, metricW - 8, { size: 10.5, color: navy, align: "center" });
        drawText(String(label), x + 4, 130, metricW - 8, { size: 6.5, color: muted, align: "center" });
      });
    };

    const drawTotalsFooter = () => {
      if (doc.y + 80 > pageBottom) {
        addPage();
      }

      const y = doc.y + 12;
      drawPanel(marginX, y, pageWidth, 58, violetSoft);
      drawText("Riepilogo finale", marginX + 14, y + 20, 105, { size: 11, color: navy });
      const footerMetrics = [
        ["Ore reali", formatDurationClock(input.dataset.totals.realHours)],
        ["Ore arrotondate", formatDurationClock(input.dataset.totals.roundedHours)],
        ["Giorni lavorati", String(workedDays)],
        ["Permessi", `${permissionItems.length} / ${formatDurationClock(permissionHours)}`],
        ["Ferie", `${vacationItems.length} / ${formatDurationClock(vacationHours)}`],
        ["Straordinari", formatDurationClock(overtimeHours)],
        ["Reperibilita", String(onCallItems.length)],
        ["Indisponibilita", String(availabilityItems.length)],
      ];
      const xStart = marginX + 125;
      const w = (pageWidth - 140) / footerMetrics.length;
      footerMetrics.forEach(([label, value], index) => {
        const x = xStart + index * w;
        drawText(value, x + 4, y + 15, w - 8, { size: 8.5, color: navy, align: "center" });
        drawText(label, x + 4, y + 32, w - 8, { size: 6.4, color: muted, align: "center" });
      });
    };

    const addFooters = () => {
      const pages = doc.bufferedPageRange();
      for (let pageIndex = 0; pageIndex < pages.count; pageIndex += 1) {
        doc.switchToPage(pageIndex);
        doc.moveTo(marginX, doc.page.height - 22).lineTo(doc.page.width - marginX, doc.page.height - 22).strokeColor(grid).stroke();
        drawText("Workbit - Report generato automaticamente", marginX, doc.page.height - 16, 250, {
          size: 6.5,
          color: "#98a2b3",
        });
        drawText(`Pagina ${pageIndex + 1} di ${pages.count}`, doc.page.width - marginX - 80, doc.page.height - 16, 80, {
          size: 6.5,
          color: "#98a2b3",
          align: "right",
        });
      }
    };

    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader();
    drawTopSummary();
    doc.y = 166;
    drawTableHeader();

    let rowIndex = 0;
    for (const dayKey of getMonthDayKeys()) {
      const dayDate = dayKeyDate(dayKey);
      const rows = buildRowsForDay(dayKey);
      rows.forEach((row, index) => {
        drawRow(
          {
            date: row.date ?? (index === 0 ? formatDateOnly(dayDate) : ""),
            day: row.day ?? (index === 0 ? formatShortDay(dayDate) : ""),
            status: row.status,
            type: row.type,
            planned: row.planned,
            real: row.real,
            total: row.total,
            notes: row.notes,
          },
          row.color,
          rowIndex
        );
        rowIndex += 1;
      });
    }

    drawTotalsFooter();
    addFooters();
    doc.end();
  });
}

function mergeCompanyDatasets(
  datasets: Array<{ userLabel: string; dataset: MonthlyDataset }>
): MonthlyDataset {
  const groupedMap = new Map<string, MonthlyDataset["groupedLogs"][number]>();
  const summary = {
    availability: 0,
    vacation: 0,
    permission: 0,
    sickness: 0,
    overtime: 0,
    courses: 0,
    closures: 0,
    total: 0,
  };

  for (const { userLabel, dataset } of datasets) {
    if (dataset.mode !== "company") {
      continue;
    }

    summary.availability += dataset.summary.availability;
    summary.vacation += dataset.summary.vacation;
    summary.permission += dataset.summary.permission;
    summary.sickness += dataset.summary.sickness;
    summary.overtime += dataset.summary.overtime;
    summary.courses += dataset.summary.courses;
    summary.closures += dataset.summary.closures;
    summary.total += dataset.summary.total;

    for (const day of dataset.groupedLogs) {
      const current =
        groupedMap.get(day.date) ?? {
          date: day.date,
          entries: [],
          totals: {
            realHours: 0,
            roundedHours: 0,
          },
          labels: [],
          items: [],
        };

      current.items = [
        ...(current.items ?? []),
        ...(day.items ?? []).map((item) => ({
          ...item,
          id: `${userLabel}-${item.id}`,
          title: `${userLabel} - ${item.title}`,
        })),
      ].sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());

      groupedMap.set(day.date, current);
    }
  }

  return {
    mode: "company",
    groupedLogs: Array.from(groupedMap.values()).sort((left, right) =>
      left.date.localeCompare(right.date)
    ),
    totals: {
      realHours: 0,
      roundedHours: 0,
    },
    summary,
  };
}

export const POST = withBar(
  async (req: Request, session: SessionWithBar): Promise<Response> => {
    try {
      const body = (await req.json()) as ExportBody;
      const month = Number(body.month);
      const year = Number(body.year);
      const format = body.format === "pdf" ? "pdf" : "json";
      const access = await getActiveBarAccess(session as never);
      const activityType = access.activeBar?.activityType ?? ActivityType.RESTAURANT;
      const requestedUserId = String(body.userId ?? "").trim() || session.user.id;
      const canExportAll =
        access.role === Role.OWNER ||
        (access.role === Role.AMMINISTRAZIONE && activityType === ActivityType.COMPANY);

      if (
        Number.isNaN(month) ||
        Number.isNaN(year) ||
        !Number.isInteger(month) ||
        !Number.isInteger(year) ||
        month < 1 ||
        month > 12
      ) {
        return Response.json({ ok: false, message: "Input non valido" }, { status: 400 });
      }

      if (!canExportAll && requestedUserId !== session.user.id) {
        return Response.json({ ok: false, message: "Non autorizzato" }, { status: 403 });
      }

      if (requestedUserId === "__ALL__") {
        if (!canExportAll || activityType !== ActivityType.COMPANY) {
          return Response.json({ ok: false, message: "Non autorizzato" }, { status: 403 });
        }

        const memberships = await prisma.employeeBar.findMany({
          where: {
            barId: session.activeBarId,
            isActive: true,
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });

        const datasets = await Promise.all(
          memberships.map(async (membership) => ({
            userLabel: `${membership.user.firstName} ${membership.user.lastName}`,
            dataset: await buildMonthlyDataset(
              session.activeBarId,
              membership.user.id,
              month,
              year,
              activityType
            ),
          }))
        );

        const dataset = mergeCompanyDatasets(datasets);

        if (format === "pdf") {
          const pdfBuffer = await createMonthlyPdfBuffer({
            userLabel: "Report generale",
            employeeName: "Report generale",
            employeeCode: "-",
            activityName: access.activeBar?.name ?? "Attivita",
            month,
            year,
            dataset,
          });

          return new Response(new Uint8Array(pdfBuffer), {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="report-generale-${year}-${String(month).padStart(2, "0")}.pdf"`,
              "Cache-Control": "no-store",
            },
          });
        }

        return Response.json({
          ok: true,
          mode: dataset.mode,
          data: dataset.groupedLogs,
          totals: dataset.totals,
          summary: dataset.summary,
        });
      }

      const membership = await prisma.employeeBar.findFirst({
        where: {
          barId: session.activeBarId,
          userId: requestedUserId,
          isActive: true,
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      if (!membership) {
        return Response.json({ ok: false, message: "Dipendente non trovato" }, { status: 404 });
      }

      const dataset = await buildMonthlyDataset(
        session.activeBarId,
        requestedUserId,
        month,
        year,
        activityType
      );

      if (format === "pdf") {
        const pdfBuffer = await createMonthlyPdfBuffer({
          userLabel: `${membership.user.firstName} ${membership.user.lastName}`,
          employeeName: `${membership.user.firstName} ${membership.user.lastName}`,
          employeeEmail: membership.user.email,
          employeeCode: membership.id.slice(0, 8).toUpperCase(),
          activityName: access.activeBar?.name ?? "Attivita",
          month,
          year,
          dataset,
        });

        return new Response(new Uint8Array(pdfBuffer), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="report-${year}-${String(month).padStart(2, "0")}.pdf"`,
            "Cache-Control": "no-store",
          },
        });
      }

      return Response.json({
        ok: true,
        mode: dataset.mode,
        data: dataset.groupedLogs,
        totals: dataset.totals,
        summary: dataset.mode === "company" ? dataset.summary : undefined,
      });
    } catch (error) {
      console.error("[export-monthly] failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return Response.json(
        { ok: false, message: "PDF non disponibile in questo momento." },
        { status: 500 }
      );
    }
  }
);
