import ExcelJS from "exceljs";
import mammoth from "mammoth";
import sanitizeHtml from "sanitize-html";

const MAX_SHEETS = 20;
const MAX_ROWS_PER_SHEET = 500;
const MAX_COLUMNS_PER_SHEET = 50;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildHtmlPage(title: string, content: string) {
  return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    html { color-scheme: light; }
    body { margin: 0; padding: 24px; background: #f8fafc; color: #172033; font: 15px/1.55 Arial, sans-serif; letter-spacing: 0; }
    main { width: min(100%, 1100px); min-height: calc(100vh - 48px); margin: 0 auto; padding: 28px; background: #fff; border: 1px solid #dbe3ef; border-radius: 8px; }
    h1, h2, h3, h4, h5, h6 { color: #111827; line-height: 1.25; letter-spacing: 0; }
    h1 { margin-top: 0; font-size: 26px; }
    h2 { margin: 30px 0 12px; font-size: 20px; }
    p { margin: 0 0 12px; }
    img { display: block; max-width: 100%; height: auto; margin: 16px auto; }
    a { color: #2855a6; }
    table { width: 100%; border-collapse: collapse; background: #fff; }
    th, td { min-width: 72px; padding: 8px 10px; border: 1px solid #cbd5e1; text-align: left; vertical-align: top; white-space: pre-wrap; overflow-wrap: anywhere; }
    th { position: sticky; top: 0; z-index: 1; background: #eef2f7; color: #172033; font-weight: 700; }
    .sheet { margin-bottom: 36px; overflow: auto; border: 1px solid #cbd5e1; border-radius: 6px; }
    .sheet table { border: 0; }
    .sheet th:first-child, .sheet td:first-child { position: sticky; left: 0; min-width: 52px; width: 52px; background: #f1f5f9; text-align: right; color: #64748b; }
    .empty { min-height: 220px; display: grid; place-items: center; color: #64748b; text-align: center; }
    .notice { margin: 12px 0; padding: 10px 12px; border-left: 3px solid #d49b24; background: #fff8e7; color: #5c471c; }
    @media (max-width: 640px) { body { padding: 0; } main { min-height: 100vh; padding: 18px; border: 0; border-radius: 0; } }
  </style>
</head>
<body><main>${content}</main></body>
</html>`;
}

export async function renderWordPreview(title: string, bytes: Uint8Array) {
  const result = await mammoth.convertToHtml(
    { buffer: Buffer.from(bytes) },
    {
      convertImage: mammoth.images.imgElement(async (image) => ({
        src: `data:${image.contentType};base64,${await image.read("base64")}`,
      })),
    }
  );
  const content = sanitizeHtml(result.value, {
    allowedTags: Array.from(
      new Set([...sanitizeHtml.defaults.allowedTags, "img", "table", "thead", "tbody", "tfoot", "tr", "th", "td"])
    ),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemesByTag: {
      img: ["data"],
      a: ["http", "https", "mailto"],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noreferrer" }),
    },
  });

  return buildHtmlPage(
    title,
    content.trim() || '<div class="empty">Il documento non contiene testo visualizzabile.</div>'
  );
}

export async function renderSpreadsheetPreview(title: string, bytes: Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(bytes).buffer);
  const sheets = workbook.worksheets.slice(0, MAX_SHEETS);

  if (sheets.length === 0) {
    return buildHtmlPage(title, '<div class="empty">Il file non contiene fogli visualizzabili.</div>');
  }

  const content = sheets.map((sheet) => {
    const rowCount = Math.min(sheet.actualRowCount, MAX_ROWS_PER_SHEET);
    const columnCount = Math.min(sheet.actualColumnCount, MAX_COLUMNS_PER_SHEET);
    const rows = [];

    for (let rowNumber = 1; rowNumber <= rowCount; rowNumber += 1) {
      const cells = [];
      for (let columnNumber = 1; columnNumber <= columnCount; columnNumber += 1) {
        const value = escapeHtml(sheet.getRow(rowNumber).getCell(columnNumber).text);
        const tag = rowNumber === 1 ? "th" : "td";
        cells.push(`<${tag}>${value || "&nbsp;"}</${tag}>`);
      }
      const numberTag = rowNumber === 1 ? "th" : "td";
      rows.push(`<tr><${numberTag}>${rowNumber}</${numberTag}>${cells.join("")}</tr>`);
    }

    const limited = sheet.actualRowCount > rowCount || sheet.actualColumnCount > columnCount;
    const table = rows.length > 0
      ? `<div class="sheet"><table><tbody>${rows.join("")}</tbody></table></div>`
      : '<div class="empty">Foglio vuoto.</div>';

    return `<section><h2>${escapeHtml(sheet.name)}</h2>${limited ? '<p class="notice">Anteprima limitata alle prime 500 righe e 50 colonne.</p>' : ""}${table}</section>`;
  }).join("");

  const sheetNotice = workbook.worksheets.length > sheets.length
    ? '<p class="notice">Anteprima limitata ai primi 20 fogli.</p>'
    : "";

  return buildHtmlPage(title, `${sheetNotice}${content}`);
}

export function renderUnsupportedPreview(title: string) {
  return buildHtmlPage(
    title,
    '<div class="empty">Questo formato non può essere visualizzato. Usa Apri per consultare il file originale.</div>'
  );
}
