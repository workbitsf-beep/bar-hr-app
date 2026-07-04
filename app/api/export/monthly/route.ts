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

function isAbsenceType(type: string) {
  return type === "Ferie" || type === "Permesso" || type === "Malattia";
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

async function createMonthlyPdfBuffer(input: {
  userLabel: string;
  employeeName?: string;
  employeeEmail?: string;
  month: number;
  year: number;
  dataset: Awaited<ReturnType<typeof buildMonthlyDataset>>;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdfFontPath = resolvePdfFontPath();
    const doc = new PDFDocument({
      margin: 24,
      size: "A4",
      layout: "landscape",
      font: pdfFontPath,
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    const marginX = 24;
    const pageWidth = doc.page.width - marginX * 2;
    const pageBottom = doc.page.height - 24;
    const softBorder = "#e5e7eb";
    const lighterBorder = "#eef2f7";
    const navy = "#111827";
    const muted = "#64748b";
    const blue = "#1d8bd7";
    const green = "#15945b";
    const orange = "#f59e0b";
    const purple = "#7c3aed";
    const red = "#ef4444";
    const panelFill = "#fbfdff";

    const ensureSpace = (needed = 24) => {
      if (doc.y + needed > pageBottom) {
        doc.addPage();
      }
    };

    const text = (
      value: string,
      x: number,
      y: number,
      width: number,
      options: { size?: number; color?: string; align?: "left" | "center" | "right"; bold?: boolean } = {}
    ) => {
      doc
        .font(pdfFontPath)
        .fillColor(options.color ?? navy)
        .fontSize(options.size ?? 8)
        .text(value, x, y, {
          width,
          align: options.align ?? "left",
          lineBreak: false,
          ellipsis: true,
        });
      doc.fillColor("#000000");
    };

    const drawCircle = (x: number, y: number, color: string, radius = 3) => {
      doc.circle(x, y, radius).fill(color);
    };

    const drawBadge = (label: string, x: number, y: number, fill: string, color: string, width = 58) => {
      doc.roundedRect(x, y, width, 12, 6).fill(fill);
      text(label, x + 6, y + 3, width - 12, { size: 6.5, color, align: "center" });
    };

    const drawRoundedPanel = (x: number, y: number, width: number, height: number, fill = "#ffffff") => {
      doc.roundedRect(x, y, width, height, 7).fillAndStroke(fill, softBorder);
    };

    const absenceItems = input.dataset.groupedLogs.flatMap((day) =>
      (day.items ?? []).filter((item) => isAbsenceType(item.type))
    );
    const sumAbsenceHours = (type: "Ferie" | "Permesso" | "Malattia") =>
      absenceItems
        .filter((item) => item.type === type)
        .reduce((total, item) => total + hoursBetween(item.startsAt, item.endsAt), 0);
    const permissionHours = sumAbsenceHours("Permesso");
    const vacationHours = sumAbsenceHours("Ferie");
    const sicknessHours = sumAbsenceHours("Malattia");
    const workedDays = input.dataset.groupedLogs.filter((day) => day.entries.length > 0).length;
    const absenceDays = input.dataset.groupedLogs.filter((day) =>
      (day.items ?? []).some((item) => isAbsenceType(item.type))
    ).length;
    const availabilityDays = input.dataset.groupedLogs.filter((day) =>
      (day.items ?? []).some((item) => item.type === "Indisponibilita")
    ).length;
    const recognizedHours =
      input.dataset.totals.roundedHours + permissionHours + vacationHours + sicknessHours;

    const drawHeader = () => {
      doc.y = 22;
      text("Report Timbrature Dipendente", marginX, 24, 250, { size: 14.5, color: navy });
      text(formatMonthYear(input.month, input.year), marginX, 45, 170, { size: 10.5, color: navy });
      text(`Generato il ${formatDateTime(new Date().toISOString())}`, pageWidth - 200, 28, 220, {
        size: 7.5,
        color: muted,
        align: "right",
      });
    };

    const addFooters = () => {
      const pages = doc.bufferedPageRange();
      for (let pageIndex = 0; pageIndex < pages.count; pageIndex += 1) {
        doc.switchToPage(pageIndex);
        text(`Pagina ${pageIndex + 1} di ${pages.count}`, doc.page.width - 95, doc.page.height - 18, 70, {
          size: 7,
          color: "#94a3b8",
          align: "right",
        });
      }
    };

    const finishDocument = () => {
      addFooters();
      doc.end();
    };

    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font(pdfFontPath);
    drawHeader();

    if (input.dataset.mode === "company") {
      if (input.dataset.groupedLogs.length === 0) {
        doc
          .fontSize(10)
          .text("Nessuna indisponibilita, ferie, permessi o corsi registrati nel mese selezionato.");
      }

      for (const day of input.dataset.groupedLogs) {
        ensureSpace(64);
        doc.font(pdfFontPath).fontSize(11).text(day.date);

        for (const item of day.items ?? []) {
          ensureSpace(34);
          doc.fontSize(10).text(`${item.type}: ${item.title}`);
          doc.text(`Periodo: ${formatDateTime(item.startsAt)} - ${formatDateTime(item.endsAt)}`);

          if (item.note) {
            doc.fillColor("#64748b").text(item.note);
            doc.fillColor("#000000");
          }

          doc.moveDown(0.2);
        }

        doc.moveDown(0.5);
      }

      ensureSpace(34);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.6);
      doc.font(pdfFontPath).text(
        `Riepilogo mese: indisponibilita ${input.dataset.summary.availability} | ferie ${input.dataset.summary.vacation} | permessi ${input.dataset.summary.permission} | malattie ${input.dataset.summary.sickness} | straordinari ${input.dataset.summary.overtime} | corsi ${input.dataset.summary.courses} | chiusure ${input.dataset.summary.closures}`
      );
      finishDocument();
      return;
    }

    const employeeTop = 70;
    drawRoundedPanel(marginX, employeeTop, 220, 74, "#ffffff");
    doc.circle(marginX + 36, employeeTop + 37, 25).fill("#eef2ff");
    text((input.employeeName ?? input.userLabel).slice(0, 1).toUpperCase(), marginX + 27, employeeTop + 24, 18, {
      size: 21,
      color: purple,
      align: "center",
    });
    text(input.employeeName ?? input.userLabel, marginX + 70, employeeTop + 16, 110, {
      size: 11,
      color: navy,
    });
    drawBadge("DIPENDENTE", marginX + 151, employeeTop + 15, "#dbeafe", "#1d4ed8", 55);
    text(input.employeeEmail ?? "-", marginX + 70, employeeTop + 35, 130, { size: 7.5, color: muted });
    text(`Periodo: ${formatMonthYear(input.month, input.year)}`, marginX + 70, employeeTop + 50, 130, {
      size: 7.5,
      color: muted,
    });

    const metricX = marginX + 238;
    const metricY = employeeTop;
    const metricW = (pageWidth - 238) / 6;
    const topMetrics = [
      { value: formatDurationClock(input.dataset.totals.realHours), label: "Ore Reali", color: blue },
      { value: formatDurationClock(input.dataset.totals.roundedHours), label: "Ore Arrotondate", color: green },
      { value: String(workedDays), label: "Giorni Lavorati", color: orange },
      { value: String(absenceDays), label: "Permessi / Ferie", color: purple },
      { value: String(availabilityDays), label: "Indisponibilita", color: orange },
      { value: formatDurationClock(input.dataset.totals.roundedHours), label: "Totale Ore Mese", color: blue },
    ];

    drawRoundedPanel(metricX, metricY, pageWidth - 238, 74, "#ffffff");
    topMetrics.forEach((metric, index) => {
      const x = metricX + index * metricW;
      if (index > 0) {
        doc.moveTo(x, metricY).lineTo(x, metricY + 74).strokeColor(lighterBorder).stroke();
      }
      drawCircle(x + 22, metricY + 28, metric.color, 8);
      text(metric.value, x + 40, metricY + 19, metricW - 46, { size: 11, color: navy });
      text(metric.label, x + 10, metricY + 46, metricW - 20, { size: 7, color: navy, align: "center" });
    });

    const legendY = employeeTop + 94;
    [
      ["Lavorato", blue],
      ["Permesso / Ferie", green],
      ["Indisponibilita", orange],
      ["Festivo", purple],
      ["Nessun dato", "#94a3b8"],
    ].forEach(([label, color], index) => {
      const x = marginX + index * 95;
      drawCircle(x + 4, legendY + 4, color);
      text(label, x + 13, legendY, 76, { size: 7.5, color: navy });
    });

    const tableTop = legendY + 20;
    const columns = [
      { key: "date", label: "Data", width: 50 },
      { key: "day", label: "Giorno", width: 36 },
      { key: "status", label: "Stato", width: 70 },
      { key: "type", label: "Tipo", width: 86 },
      { key: "plannedStart", label: "Prev. Inizio", width: 48 },
      { key: "plannedEnd", label: "Prev. Fine", width: 46 },
      { key: "plannedTotal", label: "Prev. Tot.", width: 46 },
      { key: "realStart", label: "Entrata", width: 45 },
      { key: "realEnd", label: "Uscita", width: 45 },
      { key: "realTotal", label: "Reale", width: 43 },
      { key: "roundedStart", label: "Arr. Ent.", width: 45 },
      { key: "roundedEnd", label: "Arr. Usc.", width: 45 },
      { key: "roundedTotal", label: "Arr. Tot.", width: 43 },
      { key: "hours", label: "Ore", width: 42 },
      { key: "note", label: "Note", width: pageWidth - 690 },
    ];
    const tableWidth = columns.reduce((total, column) => total + column.width, 0);
    const rowH = 17;

    const drawTableHeader = () => {
      doc.roundedRect(marginX, doc.y, tableWidth, 28, 6).fillAndStroke("#f8fafc", softBorder);
      let x = marginX;
      columns.forEach((column) => {
        text(column.label, x + 4, doc.y + 10, column.width - 8, {
          size: 6.7,
          color: navy,
          align: column.key === "note" || column.key === "type" ? "left" : "center",
        });
        x += column.width;
      });
      doc.y += 28;
    };

    doc.y = tableTop;
    drawTableHeader();

    const drawDataRow = (values: string[], statusColor: string, fill = "#ffffff") => {
      ensureSpace(rowH + 36);
      if (doc.y < 60) {
        drawHeader();
        doc.y = 68;
        drawTableHeader();
      }
      const y = doc.y;
      doc.rect(marginX, y, tableWidth, rowH).fillAndStroke(fill, lighterBorder);
      let x = marginX;
      values.forEach((value, index) => {
        if (index === 2) {
          drawCircle(x + 8, y + 8.5, statusColor, 2.7);
          text(value, x + 15, y + 5, columns[index].width - 17, { size: 6.6, color: navy });
        } else {
          text(value, x + 4, y + 5, columns[index].width - 8, {
            size: 6.6,
            color: index === 14 ? "#334155" : navy,
            align: index <= 13 && index !== 3 ? "center" : "left",
          });
        }
        x += columns[index].width;
      });
      doc.y += rowH;
    };

    for (const day of input.dataset.groupedLogs) {
      const dayAbsences = (day.items ?? []).filter((item) => isAbsenceType(item.type));
      const availabilities = (day.items ?? []).filter((item) => item.type === "Indisponibilita");

      if (day.entries.length > 0) {
        day.entries.forEach((entry, index) => {
          drawDataRow(
            [
              index === 0 ? formatDateOnly(day.date) : "",
              index === 0 ? formatShortDay(day.date) : "",
              "Lavorato",
              "Turno",
              "-",
              "-",
              "-",
              formatTime(entry.clockIn),
              formatTime(entry.clockOut),
              formatDurationClock(entry.realHours),
              formatTime(entry.clockIn),
              formatTime(entry.clockOut),
              formatDurationClock(entry.roundedHours),
              formatDurationClock(entry.roundedHours),
              "-",
            ],
            blue
          );
        });
      }

      dayAbsences.forEach((absence, index) => {
        const color = absence.type === "Ferie" ? blue : absence.type === "Malattia" ? red : green;
        drawDataRow(
          [
            day.entries.length === 0 && index === 0 ? formatDateOnly(day.date) : "",
            day.entries.length === 0 && index === 0 ? formatShortDay(day.date) : "",
            absence.type,
            absence.title || absence.type,
            formatTime(absence.startsAt),
            formatTime(absence.endsAt),
            formatDurationClock(hoursBetween(absence.startsAt, absence.endsAt)),
            "-",
            "-",
            "-",
            formatTime(absence.startsAt),
            formatTime(absence.endsAt),
            formatDurationClock(hoursBetween(absence.startsAt, absence.endsAt)),
            formatDurationClock(hoursBetween(absence.startsAt, absence.endsAt)),
            absence.note || absence.type,
          ],
          color,
          "#fffdfa"
        );
      });

      availabilities.forEach((availability, index) => {
        drawDataRow(
          [
            day.entries.length === 0 && dayAbsences.length === 0 && index === 0 ? formatDateOnly(day.date) : "",
            day.entries.length === 0 && dayAbsences.length === 0 && index === 0 ? formatShortDay(day.date) : "",
            "Indisponibilita",
            availability.title || "Indisponibilita",
            "-",
            "-",
            "-",
            "-",
            "-",
            "-",
            "-",
            "-",
            "-",
            "-",
            "Indisponibilita",
          ],
          orange,
          "#fffdf7"
        );
      });
    }

    ensureSpace(72);
    const summaryY = doc.y + 10;
    drawRoundedPanel(marginX, summaryY, pageWidth, 55, panelFill);
    text("RIEPILOGO MESE", marginX + 18, summaryY + 20, 110, { size: 10, color: "#1d4ed8" });
    const bottomMetrics = [
      [formatDurationClock(input.dataset.totals.realHours), "Ore Reali", blue],
      [formatDurationClock(input.dataset.totals.roundedHours), "Ore Arrotondate", green],
      [String(workedDays), "Giorni Lavorati", navy],
      [
        `${absenceDays} giorni`,
        `Permessi ${formatDurationClock(permissionHours)} / Ferie ${formatDurationClock(vacationHours)}`,
        green,
      ],
      [`${availabilityDays} giorni`, "Indisponibilita", orange],
      [formatDurationClock(round(recognizedHours)), "Totale Ore Riconosciute", blue],
    ];
    const bottomStart = marginX + 140;
    const bottomW = (pageWidth - 155) / bottomMetrics.length;
    bottomMetrics.forEach(([value, label, color], index) => {
      const x = bottomStart + index * bottomW;
      if (index > 0) {
        doc.moveTo(x, summaryY + 10).lineTo(x, summaryY + 45).strokeColor(lighterBorder).stroke();
      }
      text(value, x + 8, summaryY + 14, bottomW - 16, { size: 10, color: String(color), align: "center" });
      text(label, x + 8, summaryY + 31, bottomW - 16, { size: 6.8, color: navy, align: "center" });
    });

    finishDocument();
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
