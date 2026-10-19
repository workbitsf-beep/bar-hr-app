import "server-only";

import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";

/**
 * A legal document's text as a PDF, so that once it is published it can be
 * downloaded and kept - by the owner who accepts it, by staff, from the
 * public pages. The text comes from the templates: headings in capitals
 * ("1. CHI È IL TITOLARE"), "•" for list items, blank lines between blocks.
 * A PDF uploaded by hand always wins over this one.
 */

const FONT = path.join(process.cwd(), "public", "fonts", "Workbit-Regular.ttf");
const INK = "#1d1b26";
const MUTED = "#6b6880";
const ACCENT = "#4c1d95";

function isHeading(line: string) {
  const letters = line.replace(/[^A-Za-zÀ-ÿ]/g, "");
  return letters.length >= 3 && letters === letters.toUpperCase() && line.length <= 120;
}

export function slugForLegalFile(title: string, version: string, revision: number) {
  const base = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `workbit-${base || "documento"}-v${version}.${revision}.pdf`;
}

export function renderLegalPdf(input: { title: string; version: string; revision: number; updatedAt: Date; content: string }) {
  return new Promise<Buffer>((resolve, reject) => {
    const hasFont = fs.existsSync(FONT);
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 64, bottom: 64, left: 64, right: 64 },
      bufferPages: true,
      info: { Title: input.title, Author: "Workbit" },
      ...(hasFont ? { font: FONT } : {}),
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const width = doc.page.width - 128;
    const date = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" }).format(
      input.updatedAt
    );

    doc.fillColor(ACCENT).fontSize(9).text("WORKBIT", { characterSpacing: 2 });
    doc.moveDown(0.4);
    doc.fillColor(INK).fontSize(20).text(input.title, { width });
    doc.moveDown(0.3);
    doc.fillColor(MUTED).fontSize(9.5).text(`Versione ${input.version}.${input.revision} · aggiornata il ${date}`);
    doc.moveDown(1.2);

    const lines = input.content.replace(/\r\n/g, "\n").split("\n");
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim()) {
        doc.moveDown(0.5);
        continue;
      }
      if (isHeading(line.trim())) {
        // Keeps a heading with the paragraph after it.
        if (doc.y > doc.page.height - 140) doc.addPage();
        doc.moveDown(0.4);
        doc.fillColor(ACCENT).fontSize(11.5).text(line.trim(), { width });
        doc.moveDown(0.25);
        continue;
      }
      const bullet = /^\s*[•\-–]\s+/.exec(line);
      if (bullet) {
        doc.fillColor(INK).fontSize(10.5).text(`•  ${line.slice(bullet[0].length)}`, 80, doc.y, {
          width: width - 16,
          lineGap: 2.5,
          indent: 0,
        });
        doc.x = 64;
        continue;
      }
      doc.fillColor(INK).fontSize(10.5).text(line.trim(), 64, doc.y, { width, lineGap: 2.5, align: "left" });
    }

    // Page numbers, once every page exists.
    const range = doc.bufferedPageRange();
    for (let index = 0; index < range.count; index += 1) {
      doc.switchToPage(range.start + index);
      const bottom = doc.page.height - 40;
      doc.page.margins.bottom = 0;
      doc.fillColor(MUTED).fontSize(8.5).text(`${input.title} · v${input.version}.${input.revision} · pagina ${index + 1} di ${range.count}`, 64, bottom, {
        width,
        align: "center",
        lineBreak: false,
      });
    }
    doc.end();
  });
}

/**
 * Writes the PDF onto the document when its text is the body: no file yet,
 * or the file was made from an earlier text. An uploaded PDF is left alone.
 */
export async function refreshLegalPdf(documentId: string) {
  const document = await prisma.legalDocument.findUnique({
    where: { id: documentId },
    select: { id: true, title: true, version: true, revision: true, updatedAt: true, content: true, fileContent: true, fileGenerated: true },
  });
  if (!document?.content?.trim()) return false;
  if (document.fileContent && !document.fileGenerated) return false;

  const pdf = await renderLegalPdf({
    title: document.title,
    version: document.version,
    revision: document.revision,
    updatedAt: document.updatedAt,
    content: document.content,
  });
  await prisma.legalDocument.update({
    where: { id: document.id },
    data: {
      fileContent: new Uint8Array(pdf),
      fileName: slugForLegalFile(document.title, document.version, document.revision),
      fileMimeType: "application/pdf",
      fileSize: pdf.length,
      fileUrl: null,
      fileGenerated: true,
    },
  });
  return true;
}

/**
 * Published documents still without their PDF (written before this existed)
 * get it the first time a page lists them. A cheap check when there is none.
 */
let checkedAt = 0;

export async function ensurePublishedLegalPdfs() {
  // Once nothing is missing, looked at again only every ten minutes.
  if (Date.now() - checkedAt < 10 * 60 * 1000) return 0;
  const missing = await prisma.legalDocument.findMany({
    where: { isActive: true, content: { not: null }, fileContent: null },
    select: { id: true },
    take: 20,
  });
  for (const document of missing) await refreshLegalPdf(document.id).catch(() => false);
  if (missing.length === 0) checkedAt = Date.now();
  return missing.length;
}
