// Prova del lettore di fatture: zip, p7m, FatturaPA, regole delle categorie.
// node --conditions=react-server --import tsx scripts/prova-fatture.mts <file.zip>
import fs from "node:fs";
import { readZip } from "../lib/costs/zip";
import { readInvoiceFile } from "../lib/costs/fattura";
import { categorizeByRules, productKeyFromDescription, unitsFromDescription } from "../lib/costs/categories";

const file = process.argv[2];
const entries = readZip(fs.readFileSync(file));
console.log("file nello zip:", entries.map((entry) => `${entry.name} (${entry.data.length} B)`).join(", "));

for (const entry of entries) {
  const result = readInvoiceFile(entry.name, entry.data);
  if (result.kind === "skip") {
    console.log(`- ${entry.name}: saltato (${result.reason})`);
    continue;
  }
  for (const invoice of result.invoices) {
    console.log(
      `- ${invoice.supplierName} [${invoice.supplierVat}] → ${invoice.recipientVat} · ${invoice.docType} n.${invoice.number} del ${invoice.date} · imponibile ${invoice.taxableCents / 100} · totale ${invoice.totalCents / 100} · xml ${result.xml.length} car.`,
    );
    for (const line of invoice.lines) {
      const units = unitsFromDescription(line.description, line.unit);
      console.log(
        `    ${line.description} | ${line.quantity} ${line.unit} × ${line.unitPrice} = ${line.totalCents / 100} | cat ${categorizeByRules(line.description, invoice.supplierName, line.unit)} | ${productKeyFromDescription(line.description)} | ${units ? `${units.unitsPerItem} ${units.baseUnit}/unità` : "unità ?"}`,
      );
    }
  }
}
