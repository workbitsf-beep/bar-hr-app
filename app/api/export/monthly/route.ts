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
    month: "long",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
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
      margin: 40,
      size: "A4",
      font: pdfFontPath,
    });
    const chunks: Buffer[] = [];
    const pageWidth = doc.page.width - 80;
    const softBorder = "#e5e7eb";
    const navy = "#111827";
    const muted = "#64748b";

    const ensureSpace = (needed = 24) => {
      if (doc.y + needed > doc.page.height - 40) {
        doc.addPage();
      }
    };

    const drawCard = (height: number, fill = "#ffffff") => {
      ensureSpace(height + 12);
      const top = doc.y;
      doc.roundedRect(40, top, pageWidth, height, 14).fillAndStroke(fill, softBorder);
      doc.y = top + 14;
      return top;
    };

    const drawPill = (text: string, x: number, y: number, fill: string, color: string) => {
      doc.roundedRect(x, y, Math.max(74, text.length * 5.8 + 18), 20, 10).fill(fill);
      doc.fillColor(color).fontSize(9).text(text, x + 9, y + 6, {
        lineBreak: false,
      });
      doc.fillColor("#000000");
    };

    const drawSummaryMetric = (label: string, value: string, index: number) => {
      const columnWidth = pageWidth / 3;
      const x = 52 + (index % 3) * columnWidth;
      const y = doc.y + Math.floor(index / 3) * 42;
      doc.fillColor(muted).fontSize(8).text(label.toUpperCase(), x, y, {
        width: columnWidth - 12,
      });
      doc.fillColor(navy).fontSize(13).text(value, x, y + 14, {
        width: columnWidth - 12,
      });
    };

    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font(pdfFontPath);
    doc.fillColor(navy).fontSize(22).text("Report mensile dipendente", 40, 42);
    doc
      .fillColor(muted)
      .fontSize(10)
      .text(`Generato il ${formatDateTime(new Date().toISOString())}`, 40, 72);
    doc.moveDown(1.6);
    doc
      .fillColor(navy)
      .fontSize(12)
      .text(`Dipendente: ${input.employeeName ?? input.userLabel}`, 40, doc.y);
    if (input.employeeEmail) {
      doc.fillColor(muted).fontSize(11).text(`Email: ${input.employeeEmail}`);
    }
    doc.fillColor(muted).fontSize(11).text(`Periodo: ${formatMonthYear(input.month, input.year)}`);
    doc.moveDown(1.2);

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
      doc.end();
      return;
    }

    const absenceItems = input.dataset.groupedLogs.flatMap((day) =>
      (day.items ?? []).filter((item) => isAbsenceType(item.type))
    );
    const overtimeItems = input.dataset.groupedLogs.flatMap((day) =>
      (day.items ?? []).filter((item) => item.type === "Straordinario")
    );
    const sumAbsenceHours = (type: "Ferie" | "Permesso" | "Malattia") =>
      absenceItems
        .filter((item) => item.type === type)
        .reduce((total, item) => total + hoursBetween(item.startsAt, item.endsAt), 0);
    const overtimeHours = overtimeItems.reduce(
      (total, item) => total + hoursBetween(item.startsAt, item.endsAt),
      0
    );
    const workedDays = input.dataset.groupedLogs.filter((day) => day.entries.length > 0).length;
    const absenceDays = input.dataset.groupedLogs.filter((day) =>
      (day.items ?? []).some((item) => isAbsenceType(item.type))
    ).length;

    drawCard(126, "#fbf8ff");
    doc.fillColor(navy).fontSize(13).text("Riepilogo mese", 52, doc.y);
    doc.moveDown(0.7);
    const summaryStartY = doc.y;
    [
      ["Totale ore lavorate", formatDurationClock(input.dataset.totals.roundedHours)],
      ["Totale ore reali", formatDurationClock(input.dataset.totals.realHours)],
      ["Totale ore permessi", formatDurationClock(sumAbsenceHours("Permesso"))],
      ["Totale ore ferie", formatDurationClock(sumAbsenceHours("Ferie"))],
      ["Totale ore malattia", formatDurationClock(sumAbsenceHours("Malattia"))],
      ["Assenze giustificate", `${absenceDays} giorni`],
      ["Giorni lavorati", String(workedDays)],
      ["Giorni con assenza", String(absenceDays)],
      ["Straordinari", formatDurationClock(overtimeHours)],
    ].forEach(([label, value], index) => drawSummaryMetric(label, value, index));
    doc.y = summaryStartY + 128;

    doc.fillColor(navy).fontSize(15).text("Dettaglio giornaliero", 40, doc.y);
    doc.moveDown(0.8);

    for (const day of input.dataset.groupedLogs) {
      const dayAbsences = (day.items ?? []).filter((item) => isAbsenceType(item.type));
      const cardHeight = 74 + day.entries.length * 48 + dayAbsences.length * 54;
      const top = drawCard(Math.max(92, cardHeight), "#ffffff");
      const contentX = 56;
      let cursorY = top + 16;
      const status =
        day.entries.length > 0
          ? "Lavorato"
          : dayAbsences[0]?.type ?? (day.labels[0] || "Registrazione");
      const statusFill =
        status === "Lavorato" ? "#dcfce7" : status === "Ferie" ? "#dbeafe" : "#ffedd5";
      const statusColor =
        status === "Lavorato" ? "#166534" : status === "Ferie" ? "#1d4ed8" : "#9a3412";

      doc.fillColor(navy).fontSize(12).text(formatDateOnly(day.date), contentX, cursorY);
      drawPill(status, 410, cursorY - 2, statusFill, statusColor);
      cursorY += 26;

      for (const entry of day.entries) {
        doc
          .fillColor("#334155")
          .fontSize(10)
          .text(`Entrata: ${formatTime(entry.clockIn)}    Uscita: ${formatTime(entry.clockOut)}`, contentX, cursorY);
        cursorY += 15;
        doc
          .fillColor(muted)
          .fontSize(10)
          .text(
            `Pause: -    Ore lavorate: ${formatDurationClock(entry.roundedHours)}    Ore reali: ${formatDurationClock(entry.realHours)}`,
            contentX,
            cursorY
          );
        cursorY += 24;
      }

      for (const absence of dayAbsences) {
        doc
          .fillColor("#334155")
          .fontSize(10)
          .text(
            `${absence.type}: ${formatTime(absence.startsAt)} - ${formatTime(absence.endsAt)}`,
            contentX,
            cursorY
          );
        cursorY += 15;
        doc
          .fillColor(muted)
          .fontSize(10)
          .text(`Ore riconosciute: ${formatDurationClock(hoursBetween(absence.startsAt, absence.endsAt))}`, contentX, cursorY);
        cursorY += 15;
        if (absence.note) {
          doc.fillColor(muted).fontSize(9).text(`Nota: ${absence.note}`, contentX, cursorY);
          cursorY += 16;
        }
        cursorY += 6;
      }

      if (day.entries.length === 0 && dayAbsences.length === 0) {
        doc.fillColor(muted).fontSize(10).text("Nessun dato registrato.", contentX, cursorY);
      }

      doc.y = top + Math.max(92, cardHeight) + 12;
    }

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
