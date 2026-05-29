import PDFDocument from "pdfkit";
import { ActivityType, Role } from "@prisma/client";
import { buildMonthlyDataset } from "@/lib/reporting";
import { prisma } from "@/lib/prisma";
import { getActiveBarAccess } from "@/lib/permissions";
import { withBar } from "@/lib/withBar";

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

function formatTime(dateIso: string): string {
  return new Date(dateIso).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(dateIso: string): string {
  return new Date(dateIso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function createMonthlyPdfBuffer(input: {
  userLabel: string;
  month: number;
  year: number;
  dataset: Awaited<ReturnType<typeof buildMonthlyDataset>>;
}): Promise<Buffer> {
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

    doc
      .fontSize(18)
      .text(
        input.dataset.mode === "company"
          ? "Report mensile registrazioni"
          : "Report mensile dipendente"
      );
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Profilo: ${input.userLabel}`);
    doc.text(`Mese: ${String(input.month).padStart(2, "0")}/${input.year}`);
    doc.moveDown();

    if (input.dataset.mode === "company") {
      if (input.dataset.groupedLogs.length === 0) {
        doc
          .fontSize(10)
          .text("Nessuna indisponibilita, ferie, permessi o corsi registrati nel mese selezionato.");
      }

      for (const day of input.dataset.groupedLogs) {
        ensureSpace(64);
        doc.font("Helvetica-Bold").fontSize(11).text(day.date);
        doc.font("Helvetica");

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
      doc.font("Helvetica-Bold").text(
        `Riepilogo mese: indisponibilita ${input.dataset.summary.availability} | ferie ${input.dataset.summary.vacation} | permessi ${input.dataset.summary.permission} | malattie ${input.dataset.summary.sickness} | straordinari ${input.dataset.summary.overtime} | corsi ${input.dataset.summary.courses} | chiusure ${input.dataset.summary.closures}`
      );
      doc.end();
      return;
    }

    for (const day of input.dataset.groupedLogs) {
      ensureSpace(56);
      doc.font("Helvetica-Bold").fontSize(11).text(day.date);
      doc.font("Helvetica");

      if (day.labels.length > 0) {
        doc
          .fontSize(10)
          .fillColor("#92400e")
          .text(`Etichette: ${day.labels.join(", ")}`);
        doc.fillColor("#000000");
      }

      if (day.entries.length === 0) {
        doc
          .fontSize(10)
          .text("Nessuna timbratura registrata per questa giornata.");
      }

      for (const entry of day.entries) {
        ensureSpace(24);
        doc
          .fontSize(10)
          .text(
            `${formatTime(entry.clockIn)} - ${formatTime(entry.clockOut)} | ore reali ${entry.realHours.toFixed(2)} | ore arrotondate ${entry.roundedHours.toFixed(2)}`
          );
      }

      ensureSpace(22);
      doc
        .font("Helvetica-Oblique")
        .text(
          `Totale giorno: reali ${day.totals.realHours.toFixed(2)}h | arrotondate ${day.totals.roundedHours.toFixed(2)}h`
        );
      doc.font("Helvetica").moveDown(0.6);
    }

    ensureSpace(30);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.6);
    doc
      .font("Helvetica-Bold")
      .text(
        `Totale mese: ore reali ${input.dataset.totals.realHours.toFixed(2)}h | ore arrotondate ${input.dataset.totals.roundedHours.toFixed(2)}h`
      );
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
    const body = (await req.json()) as ExportBody;
    const month = Number(body.month);
    const year = Number(body.year);
    const format = body.format === "pdf" ? "pdf" : "json";
    const access = await getActiveBarAccess(session as never);
    const activityType = access.activeBar?.activityType ?? ActivityType.RESTAURANT;
    const requestedUserId = String(body.userId ?? "").trim() || session.user.id;
    const canExportAll =
      access.role === Role.OWNER ||
      (access.role === Role.MANAGER && activityType === ActivityType.COMPANY);

    if (
      Number.isNaN(month) ||
      Number.isNaN(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(year) ||
      month < 1 ||
      month > 12
    ) {
      return Response.json(
        { ok: false, message: "Input non valido" },
        { status: 400 }
      );
    }

    if (!canExportAll && requestedUserId !== session.user.id) {
      return Response.json(
        { ok: false, message: "Non autorizzato" },
        { status: 403 }
      );
    }

    if (requestedUserId === "__ALL__") {
      if (!canExportAll || activityType !== ActivityType.COMPANY) {
        return Response.json(
          { ok: false, message: "Non autorizzato" },
          { status: 403 }
        );
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
          month,
          year,
          dataset,
        });

        return new Response(new Uint8Array(pdfBuffer), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="report-generale-${year}-${String(month).padStart(2, "0")}.pdf"`,
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
      return Response.json(
        { ok: false, message: "Dipendente non trovato" },
        { status: 404 }
      );
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
        userLabel: `${membership.user.firstName} ${membership.user.lastName} (${membership.user.email})`,
        month,
        year,
        dataset,
      });

      return new Response(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="report-${year}-${String(month).padStart(2, "0")}.pdf"`,
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
  }
);
