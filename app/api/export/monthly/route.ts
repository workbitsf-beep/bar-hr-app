import PDFDocument from "pdfkit";
import { ClockType, RoundingMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyRounding } from "@/lib/rounding";
import { withBar } from "@/lib/withBar";

type ExportBody = {
  userId?: string;
  month?: number;
  year?: number;
  format?: "json" | "pdf";
};

type SessionWithBar = {
  activeBarId: string;
};

type TimeLogItem = {
  id: string;
  type: ClockType;
  timestamp: Date;
};

type ExportEntry = {
  inLogId: string;
  outLogId: string;
  clockIn: string;
  clockOut: string;
  realDurationMs: number;
  roundedDurationMs: number;
  realHours: number;
  roundedHours: number;
};

type GroupedDay = {
  date: string;
  entries: ExportEntry[];
  totals: {
    realHours: number;
    roundedHours: number;
  };
};

type MonthlyDataset = {
  groupedLogs: GroupedDay[];
  totals: {
    realHours: number;
    roundedHours: number;
  };
};

function formatDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(dateIso: string): string {
  return new Date(dateIso).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toHours(durationMs: number): number {
  return Math.round((durationMs / 3600000) * 100) / 100;
}

function getRoundedTimestamp(
  timestamp: Date,
  roundingEnabled: boolean,
  roundingMode: RoundingMode | null,
  roundingMinutes: number | null
): Date {
  if (!roundingEnabled || !roundingMode || !roundingMinutes) {
    return timestamp;
  }

  return applyRounding(timestamp, roundingMode, roundingMinutes);
}

async function buildMonthlyDataset(
  activeBarId: string,
  userId: string,
  month: number,
  year: number
): Promise<MonthlyDataset> {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const [timeLogs, settings] = await Promise.all([
    prisma.timeLog.findMany({
      where: {
        userId,
        barId: activeBarId,
        timestamp: {
          gte: monthStart,
          lt: monthEnd,
        },
      },
      select: {
        id: true,
        type: true,
        timestamp: true,
      },
      orderBy: {
        timestamp: "asc",
      },
    }),
    prisma.barSettings.findUnique({
      where: {
        barId: activeBarId,
      },
      select: {
        roundingEnabled: true,
        roundingMode: true,
        roundingMinutes: true,
      },
    }),
  ]);

  const groupedMap = new Map<string, GroupedDay>();
  let pendingIn: TimeLogItem | null = null;
  let totalRealMs = 0;
  let totalRoundedMs = 0;

  for (const log of timeLogs) {
    if (log.type === ClockType.IN) {
      pendingIn = log;
      continue;
    }

    if (!pendingIn) {
      continue;
    }

    const realDurationMs = Math.max(
      0,
      log.timestamp.getTime() - pendingIn.timestamp.getTime()
    );

    const roundedIn = getRoundedTimestamp(
      pendingIn.timestamp,
      settings?.roundingEnabled ?? false,
      settings?.roundingMode ?? null,
      settings?.roundingMinutes ?? null
    );
    const roundedOut = getRoundedTimestamp(
      log.timestamp,
      settings?.roundingEnabled ?? false,
      settings?.roundingMode ?? null,
      settings?.roundingMinutes ?? null
    );
    const roundedDurationMs = Math.max(
      0,
      roundedOut.getTime() - roundedIn.getTime()
    );

    const dayKey = formatDayKey(pendingIn.timestamp);
    const existingDay = groupedMap.get(dayKey) ?? {
      date: dayKey,
      entries: [],
      totals: {
        realHours: 0,
        roundedHours: 0,
      },
    };

    const entry: ExportEntry = {
      inLogId: pendingIn.id,
      outLogId: log.id,
      clockIn: pendingIn.timestamp.toISOString(),
      clockOut: log.timestamp.toISOString(),
      realDurationMs,
      roundedDurationMs,
      realHours: toHours(realDurationMs),
      roundedHours: toHours(roundedDurationMs),
    };

    existingDay.entries.push(entry);
    existingDay.totals.realHours = Math.round(
      (existingDay.totals.realHours + entry.realHours) * 100
    ) / 100;
    existingDay.totals.roundedHours = Math.round(
      (existingDay.totals.roundedHours + entry.roundedHours) * 100
    ) / 100;
    groupedMap.set(dayKey, existingDay);

    totalRealMs += realDurationMs;
    totalRoundedMs += roundedDurationMs;
    pendingIn = null;
  }

  const groupedLogs = Array.from(groupedMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return {
    groupedLogs,
    totals: {
      realHours: toHours(totalRealMs),
      roundedHours: toHours(totalRoundedMs),
    },
  };
}

async function createMonthlyPdfBuffer(
  userLabel: string,
  month: number,
  year: number,
  dataset: MonthlyDataset
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 40,
      size: "A4",
    });
    const chunks: Buffer[] = [];

    const ensureSpace = (needed = 24) => {
      if (doc.y + needed > doc.page.height - 40) {
        doc.addPage();
      }
    };

    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("Monthly Time Log Export", { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`User: ${userLabel}`);
    doc.text(`Month: ${String(month).padStart(2, "0")}/${year}`);
    doc.moveDown();

    doc.fontSize(10).text("Date", 40, doc.y, { continued: true });
    doc.text("Clock In", 120, doc.y, { continued: true });
    doc.text("Clock Out", 200, doc.y, { continued: true });
    doc.text("Real Hours", 290, doc.y, { continued: true });
    doc.text("Rounded Hours", 380, doc.y);
    doc.moveTo(40, doc.y + 4).lineTo(555, doc.y + 4).stroke();
    doc.moveDown();

    for (const day of dataset.groupedLogs) {
      ensureSpace(36);
      doc.fontSize(10).font("Helvetica-Bold").text(day.date);
      doc.font("Helvetica");

      for (const entry of day.entries) {
        ensureSpace(22);
        doc.text("", 40, doc.y, { continued: true });
        doc.text(formatTime(entry.clockIn), 120, doc.y, { continued: true });
        doc.text(formatTime(entry.clockOut), 200, doc.y, { continued: true });
        doc.text(entry.realHours.toFixed(2), 290, doc.y, { continued: true });
        doc.text(entry.roundedHours.toFixed(2), 380, doc.y);
      }

      ensureSpace(20);
      doc.font("Helvetica-Oblique").text(
        `Day totals: real ${day.totals.realHours.toFixed(2)}h | rounded ${day.totals.roundedHours.toFixed(2)}h`
      );
      doc.font("Helvetica").moveDown(0.5);
    }

    ensureSpace(40);
    doc.moveDown();
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").text(
      `Totals - Real: ${dataset.totals.realHours.toFixed(2)}h | Rounded: ${dataset.totals.roundedHours.toFixed(2)}h`
    );

    doc.end();
  });
}

export const POST = withBar(
  async (req: Request, session: SessionWithBar): Promise<Response> => {
    const body = (await req.json()) as ExportBody;
    const { userId, month, year, format = "json" } = body;
    const monthNum = Number(month);
    const yearNum = Number(year);

    if (
      !userId ||
      Number.isNaN(monthNum) ||
      Number.isNaN(yearNum) ||
      !Number.isInteger(monthNum) ||
      !Number.isInteger(yearNum) ||
      monthNum < 1 ||
      monthNum > 12
    ) {
      return Response.json(
        { ok: false, message: "Invalid input" },
        { status: 400 }
      );
    }

    const [dataset, user] = await Promise.all([
      buildMonthlyDataset(session.activeBarId, userId, monthNum, yearNum),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      }),
    ]);

    if (format === "pdf") {
      const userLabel = user
        ? `${user.firstName} ${user.lastName} (${user.email})`
        : userId;
      const pdfBuffer = await createMonthlyPdfBuffer(
        userLabel,
        monthNum,
        yearNum,
        dataset
      );
      const uint8Array = new Uint8Array(pdfBuffer);

      return new Response(uint8Array, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="monthly-export-${yearNum}-${monthNum}.pdf"`,
        },
      });
    }

    return Response.json({
      ok: true,
      data: dataset.groupedLogs,
      totals: dataset.totals,
    });
  }
);
