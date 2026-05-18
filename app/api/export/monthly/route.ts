import PDFDocument from "pdfkit";
import { Role } from "@prisma/client";
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

function formatTime(dateIso: string): string {
  return new Date(dateIso).toLocaleTimeString("it-IT", {
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

    doc.fontSize(18).text("Report mensile dipendente");
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Dipendente: ${input.userLabel}`);
    doc.text(`Mese: ${String(input.month).padStart(2, "0")}/${input.year}`);
    doc.moveDown();

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

export const POST = withBar(
  async (req: Request, session: SessionWithBar): Promise<Response> => {
    const body = (await req.json()) as ExportBody;
    const month = Number(body.month);
    const year = Number(body.year);
    const format = body.format === "pdf" ? "pdf" : "json";
    const access = await getActiveBarAccess(session as never);
    const requestedUserId = String(body.userId ?? "").trim() || session.user.id;

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

    if (access.role !== Role.OWNER && requestedUserId !== session.user.id) {
      return Response.json(
        { ok: false, message: "Non autorizzato" },
        { status: 403 }
      );
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
      year
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
      data: dataset.groupedLogs,
      totals: dataset.totals,
    });
  }
);
