/**
 * A company to show in a demo: Officina Meccanica Bellini (demo), owned by
 * the super admins' accounts so Costi shows without COSTS_ENABLED.
 *
 *   npx tsx scripts/create-company-demo.ts --confirm
 *   npx tsx scripts/create-company-demo.ts --remove
 *
 * Writes to DATABASE_URL (production). What it holds: eight people on the
 * contract's hours, holiday, leave, sickness and overtime (some to approve),
 * closures, certificates about to lapse, notes, the consultant with a CSV,
 * and four months of supplier invoices with their payment terms - prices
 * that creep up, quantities that move, a bonifico to confirm and one late.
 */
process.env.TZ = process.env.TZ || "Europe/Rome";

import { randomBytes, randomInt } from "node:crypto";
import { gzipSync } from "node:zlib";
import bcrypt from "bcrypt";
import { PrismaClient, type Prisma } from "@prisma/client";
import { TEMPLATE_PRESETS } from "../lib/payroll/template";

const prisma = new PrismaClient();
const BAR_NAME = "Officina Meccanica Bellini (demo)";
const EMPLOYEE_EMAIL = "demo.dipendente.azienda@workbit.it";
const OWNER_EMAILS = ["tipasergio3@gmail.com", "fedefabrisfedefabris@gmail.com"];
const VAT = "09876543210";

const day = (iso: string, hours = 0, minutes = 0) => {
  const date = new Date(`${iso}T00:00:00`);
  date.setHours(hours, minutes, 0, 0);
  return date;
};
const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const addDays = (iso: string, days: number) => {
  const date = utc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const endOfNextMonth = (iso: string) => {
  const date = utc(iso);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 2, 0)).toISOString().slice(0, 10);
};
const closedPassword = () => `closed:${randomBytes(24).toString("hex")}`;
const readablePassword = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: 12 }, () => alphabet[randomInt(alphabet.length)]).join("");
};

/* ---------- Suppliers and their invoices ---------- */

type LineSpec = { description: string; qty: number; unit: string; price: number; category: string; productKey: string; productLabel: string; baseUnit: string | null };
type InvoiceSpec = {
  supplier: { name: string; vat: string; iban?: string };
  number: string;
  date: string;
  lines: LineSpec[];
  /** MP05 bonifico, MP12 RiBa, MP19 SDD, MP08 carta */
  method: string;
  due: string;
  /** The owner's word on this instalment, for the demo's story. */
  state?: "PAID" | "NOT_PAID";
};

const ACCIAI = { name: "Acciai Nord Srl", vat: "IT01111111111", iban: "IT60X0542811101000000123456" };
const METALLI = { name: "Metalli Est Spa", vat: "IT02222222222" };
const VITERIA = { name: "Viteria Veneta Snc", vat: "IT03333333333", iban: "IT12A0306911884100000004321" };
const ZINCATURA = { name: "Zincatura Padana Srl", vat: "IT04444444444", iban: "IT45B0200812100000101234567" };
const CARBURANTE = { name: "Stazione Q8 Bellini", vat: "IT05555555555" };
const ENERGIA = { name: "Enel Energia Spa", vat: "IT06655971007" };
const TELEFONO = { name: "TIM Spa", vat: "IT00488410010" };

const MONTHS = ["2026-07", "2026-08", "2026-09", "2026-10"];

function invoices(): InvoiceSpec[] {
  const list: InvoiceSpec[] = [];
  const inox = [3.02, 3.05, 3.09, 3.15];
  const inoxKg = [380, 300, 400, 420];
  const tubeKg = [150, 120, 160, 140];
  const tube = [1.8, 1.8, 1.8, 1.86];
  const screws = [2000, 1500, 2500, 3000];
  const screwPrice = [0.042, 0.042, 0.043, 0.044];
  const zinc = [500, 400, 550, 600];
  const zincPrice = [0.65, 0.65, 0.66, 0.68];
  const diesel = [300, 280, 320, 350];
  const dieselPrice = [1.72, 1.75, 1.7, 1.78];
  const kwh = [2400, 2100, 2600, 2700];
  const kwhPrice = [0.158, 0.161, 0.165, 0.169];

  MONTHS.forEach((month, index) => {
    const acciaiDate = `${month}-06`;
    list.push({
      supplier: ACCIAI,
      number: `${120 + index * 37}/A`,
      date: acciaiDate,
      method: "MP05",
      due: endOfNextMonth(acciaiDate),
      state: index < 2 ? "PAID" : undefined,
      lines: [
        { description: "LAMIERA INOX AISI 304 SP. 2 MM", qty: inoxKg[index], unit: "KG", price: inox[index], category: "materie_prime", productKey: "lamiera-inox-aisi-304", productLabel: "Lamiera inox AISI 304", baseUnit: "kg" },
        { description: "TUBO ACCIAIO ZINCATO 40X40", qty: tubeKg[index], unit: "KG", price: tube[index], category: "materie_prime", productKey: "tubo-acciaio-zincato", productLabel: "Tubo acciaio zincato", baseUnit: "kg" },
      ],
    });
    if (index >= 2) {
      const date = `${month}-15`;
      list.push({
        supplier: METALLI,
        number: `FT-${2026}${String(400 + index).padStart(4, "0")}`,
        date,
        method: "MP12",
        due: addDays(date, 60),
        lines: [{ description: "LAMIERA AISI 304 2B SP.2", qty: 120, unit: "KG", price: 2.85, category: "materie_prime", productKey: "lamiera-inox-aisi-304", productLabel: "Lamiera inox AISI 304", baseUnit: "kg" }],
      });
    }
    const vitDate = `${month}-10`;
    list.push({
      supplier: VITERIA,
      number: `${month.slice(5)}${String(55 + index).padStart(3, "0")}`,
      date: vitDate,
      method: "MP05",
      due: addDays(vitDate, 30),
      // September's is the late one: told "non ancora".
      state: index < 2 ? "PAID" : index === 2 ? "NOT_PAID" : undefined,
      lines: [
        { description: "VITE TE INOX A2 M8X30", qty: screws[index], unit: "PZ", price: screwPrice[index], category: "componenti", productKey: "vite-inox-a2-m8", productLabel: "Viti inox A2 M8", baseUnit: "pz" },
        { description: "BULLONE ZINCATO M10", qty: 800, unit: "PZ", price: 0.11, category: "componenti", productKey: "bullone-zincato-m10", productLabel: "Bulloni zincati M10", baseUnit: "pz" },
      ],
    });
    const zincDate = `${month}-18`;
    list.push({
      supplier: ZINCATURA,
      number: `Z${String(900 + index * 3)}`,
      date: zincDate,
      method: "MP05",
      due: addDays(zincDate, 30),
      // September's is past due and not told yet: "Le hai pagate?".
      state: index < 2 ? "PAID" : undefined,
      lines: [{ description: "ZINCATURA A CALDO CONTO LAVORO", qty: zinc[index], unit: "KG", price: zincPrice[index], category: "lavorazioni", productKey: "zincatura-a-caldo", productLabel: "Zincatura a caldo", baseUnit: "kg" }],
    });
    const fuelDate = `${month}-25`;
    list.push({
      supplier: CARBURANTE,
      number: `${3000 + index}`,
      date: fuelDate,
      method: "MP08",
      due: fuelDate,
      lines: [{ description: "GASOLIO AUTOTRAZIONE", qty: diesel[index], unit: "LT", price: dieselPrice[index], category: "carburante", productKey: "gasolio-autotrazione", productLabel: "Gasolio", baseUnit: "l" }],
    });
    const energyDate = `${month}-08`;
    list.push({
      supplier: ENERGIA,
      number: `E${2026}${index}88`,
      date: energyDate,
      method: "MP19",
      due: addDays(energyDate, 20),
      lines: [{ description: "ENERGIA ATTIVA F1", qty: kwh[index], unit: "KWH", price: kwhPrice[index], category: "energia", productKey: "energia-elettrica", productLabel: "Energia elettrica", baseUnit: "kwh" }],
    });
    const phoneDate = `${month}-03`;
    list.push({
      supplier: TELEFONO,
      number: `8T${index}00412`,
      date: phoneDate,
      method: "MP19",
      due: addDays(phoneDate, 25),
      lines: [{ description: "CANONE TIM BUSINESS FIBRA", qty: 1, unit: "NR", price: 89, category: "telefonia", productKey: "canone-tim-business", productLabel: "Canone TIM Business", baseUnit: null }],
    });
  });

  // November's first bonifico, so "Da pagare" has the next weeks in it.
  list.push({
    supplier: ACCIAI,
    number: "250/A",
    date: "2026-10-29",
    method: "MP05",
    due: "2026-11-05",
    lines: [{ description: "LAMIERA INOX AISI 304 SP. 3 MM", qty: 90, unit: "KG", price: 3.15, category: "materie_prime", productKey: "lamiera-inox-aisi-304", productLabel: "Lamiera inox AISI 304", baseUnit: "kg" }],
  });
  return list;
}

const cents = (value: number) => Math.round(value * 100);
const amount = (value: number) => (value / 100).toFixed(2);

function xmlOf(spec: InvoiceSpec, taxable: number, vat: number) {
  const lines = spec.lines
    .map(
      (line, index) =>
        `<DettaglioLinee><NumeroLinea>${index + 1}</NumeroLinea><Descrizione>${line.description}</Descrizione><Quantita>${line.qty.toFixed(2)}</Quantita><UnitaMisura>${line.unit}</UnitaMisura><PrezzoUnitario>${line.price.toFixed(4)}</PrezzoUnitario><PrezzoTotale>${amount(cents(line.qty * line.price))}</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA></DettaglioLinee>`,
    )
    .join("");
  const iban = spec.supplier.iban && spec.method === "MP05" ? `<IBAN>${spec.supplier.iban}</IBAN>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?><p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"><FatturaElettronicaHeader><CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${spec.supplier.vat.slice(2)}</IdCodice></IdFiscaleIVA><Anagrafica><Denominazione>${spec.supplier.name}</Denominazione></Anagrafica></DatiAnagrafici></CedentePrestatore><CessionarioCommittente><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${VAT}</IdCodice></IdFiscaleIVA><Anagrafica><Denominazione>Officina Meccanica Bellini Srl</Denominazione></Anagrafica></DatiAnagrafici></CessionarioCommittente></FatturaElettronicaHeader><FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>TD01</TipoDocumento><Divisa>EUR</Divisa><Data>${spec.date}</Data><Numero>${spec.number}</Numero><ImportoTotaleDocumento>${amount(taxable + vat)}</ImportoTotaleDocumento></DatiGeneraliDocumento></DatiGenerali><DatiBeniServizi>${lines}<DatiRiepilogo><AliquotaIVA>22.00</AliquotaIVA><ImponibileImporto>${amount(taxable)}</ImponibileImporto><Imposta>${amount(vat)}</Imposta></DatiRiepilogo></DatiBeniServizi><DatiPagamento><CondizioniPagamento>TP02</CondizioniPagamento><DettaglioPagamento><ModalitaPagamento>${spec.method}</ModalitaPagamento><DataScadenzaPagamento>${spec.due}</DataScadenzaPagamento><ImportoPagamento>${amount(taxable + vat)}</ImportoPagamento>${iban}</DettaglioPagamento></DatiPagamento></FatturaElettronicaBody></p:FatturaElettronica>`;
}

/* ---------- People ---------- */

const STAFF: Array<[string, string, "MANAGER" | "EMPLOYEE", number, string]> = [
  ["Giulia", "Ferro", "MANAGER", 40, "M001"],
  ["Andrea", "Rossi", "EMPLOYEE", 40, "M002"],
  ["Luca", "Moretti", "EMPLOYEE", 40, "M003"],
  ["Davide", "Conte", "EMPLOYEE", 40, "M004"],
  ["Elena", "Galli", "EMPLOYEE", 24, "M005"],
  ["Matteo", "Ricci", "EMPLOYEE", 40, "M006"],
  ["Simone", "Gatti", "EMPLOYEE", 40, "M007"],
];

async function remove() {
  const bars = await prisma.bar.findMany({ where: { name: BAR_NAME }, select: { id: true } });
  for (const bar of bars) await prisma.bar.delete({ where: { id: bar.id } });
  const users = await prisma.user.deleteMany({ where: { OR: [{ email: EMPLOYEE_EMAIL }, { email: { endsWith: "@azienda.demo.workbit.invalid" } }] } });
  console.log(`Demo azienda rimossa (${bars.length} locale, ${users.count} account).`);
}

async function create() {
  if (await prisma.bar.findFirst({ where: { name: BAR_NAME } })) throw new Error("La demo esiste già: --remove e poi --confirm.");
  const owners = await prisma.user.findMany({ where: { email: { in: OWNER_EMAILS } }, select: { id: true, email: true } });
  const owner = owners.find((item) => item.email === OWNER_EMAILS[0]) ?? owners[0];
  if (!owner) throw new Error("Account del titolare non trovato.");
  const employeePassword = readablePassword();

  const bar = await prisma.bar.create({
    data: { name: BAR_NAME, legalName: "Officina Meccanica Bellini Srl", vatNumber: VAT, latitude: 45.4064, longitude: 11.8768, ownerId: owner.id, activityType: "COMPANY", city: "Padova" },
  });
  await prisma.barSettings.create({ data: { barId: bar.id, timeTrackingEnabled: false, shiftsEnabled: false, payrollSource: "CONTRACT", payrollOvertime: true } });
  await prisma.subscription.create({ data: { barId: bar.id, planType: "LIFETIME", status: "ACTIVE" } });
  for (const item of owners) await prisma.employeeBar.create({ data: { userId: item.id, barId: bar.id, role: "OWNER", hiredAt: day("2020-01-01") } });

  // People: one who can log in to show the employee's side, the rest closed.
  const people: Array<{ id: string; firstName: string }> = [];
  const demoUser = await prisma.user.create({
    data: { email: EMPLOYEE_EMAIL, passwordHash: await bcrypt.hash(employeePassword, 10), firstName: "Paolo", lastName: "Marchetti", role: "EMPLOYEE", mustChangePwd: false },
  });
  await prisma.employeeBar.create({ data: { userId: demoUser.id, barId: bar.id, role: "EMPLOYEE", hiredAt: day("2023-03-01"), payrollCode: "M008", contractWeeklyHours: 40, hourlyRate: 15.5 } });
  const documents = await prisma.legalDocument.findMany({ where: { isActive: true, isRequired: true }, select: { id: true, version: true, revision: true } });
  for (const document of documents) {
    await prisma.legalAcceptance.create({ data: { documentId: document.id, userId: demoUser.id, barId: bar.id, version: document.version, revision: document.revision } });
  }
  people.push({ id: demoUser.id, firstName: "Paolo" });

  for (const [index, [firstName, lastName, role, hours, code]] of STAFF.entries()) {
    const user = await prisma.user.create({
      data: { email: `persona-${index}@azienda.demo.workbit.invalid`, passwordHash: closedPassword(), firstName, lastName, role, mustChangePwd: false },
    });
    await prisma.employeeBar.create({
      data: { userId: user.id, barId: bar.id, role, hiredAt: day(index === 6 ? "2026-09-15" : "2022-02-01"), payrollCode: code, contractWeeklyHours: hours, hourlyRate: role === "MANAGER" ? 21 : 16 },
    });
    people.push({ id: user.id, firstName });
  }
  const id = (name: string) => people.find((person) => person.firstName === name)!.id;

  // Requests: October's settled ones fill the file; November's wait for a yes.
  const wholeDays = (from: string, to: string) => ({ startsAt: day(from), endsAt: day(to, 23, 59) });
  const requests: Prisma.RequestCreateManyInput[] = [
    { barId: bar.id, employeeId: id("Andrea"), type: "VACATION", status: "APPROVED", reviewedById: owner.id, reviewedAt: day("2026-10-01", 9), ...wholeDays("2026-10-13", "2026-10-17"), reason: "Ferie" },
    { barId: bar.id, employeeId: id("Luca"), type: "PERMISSION", status: "APPROVED", reviewedById: owner.id, reviewedAt: day("2026-10-20", 9), startsAt: day("2026-10-22", 14), endsAt: day("2026-10-22", 18), reason: "Visita medica" },
    { barId: bar.id, employeeId: id("Davide"), type: "SICKNESS", status: "APPROVED", reviewedById: owner.id, reviewedAt: day("2026-10-06", 10), ...wholeDays("2026-10-06", "2026-10-08"), certificateCode: "2026-PD-48213377" },
    { barId: bar.id, employeeId: id("Matteo"), type: "OVERTIME", status: "APPROVED", reviewedById: owner.id, reviewedAt: day("2026-10-16", 9), startsAt: day("2026-10-15", 17), endsAt: day("2026-10-15", 19, 30), reason: "Consegna urgente cliente" },
    { barId: bar.id, employeeId: id("Paolo"), type: "OVERTIME", status: "APPROVED", reviewedById: owner.id, reviewedAt: day("2026-10-29", 9), startsAt: day("2026-10-28", 17), endsAt: day("2026-10-28", 20), reason: "Montaggio in cantiere" },
    { barId: bar.id, employeeId: id("Andrea"), type: "VACATION", status: "APPROVED", reviewedById: owner.id, reviewedAt: day("2026-10-25", 9), ...wholeDays("2026-11-03", "2026-11-04") },
    { barId: bar.id, employeeId: id("Simone"), type: "VACATION", status: "PENDING", ...wholeDays("2026-11-23", "2026-11-27"), reason: "Viaggio" },
    { barId: bar.id, employeeId: id("Elena"), type: "PERMISSION", status: "PENDING", startsAt: day("2026-11-05", 9), endsAt: day("2026-11-05", 13), reason: "Colloquio scuola" },
    { barId: bar.id, employeeId: id("Paolo"), type: "VACATION", status: "PENDING", ...wholeDays("2026-12-22", "2026-12-31") },
  ];
  await prisma.request.createMany({ data: requests });

  await prisma.calendarClosure.createMany({
    data: [
      { barId: bar.id, title: "Chiusura estiva", type: "VACATION", startsAt: day("2026-08-10"), endsAt: day("2026-08-21", 23, 59), createdById: owner.id },
      { barId: bar.id, title: "Ponte dell'Immacolata", type: "CLOSURE", startsAt: day("2026-12-07"), endsAt: day("2026-12-07", 23, 59), createdById: owner.id },
    ],
  });

  // Certificates: one lapsed, two about to, the rest in order.
  const certificates: Prisma.CourseCertificateCreateManyInput[] = [
    { barId: bar.id, userId: id("Davide"), kind: "FIRST_AID", title: "Primo soccorso", completedAt: utc("2023-09-30"), expiresAt: utc("2026-09-30") },
    { barId: bar.id, userId: id("Giulia"), kind: "FIRE_SAFETY", title: "Antincendio rischio medio", completedAt: utc("2021-11-20"), expiresAt: utc("2026-11-20") },
    { barId: bar.id, userId: id("Matteo"), kind: "OTHER", title: "Carrellista (muletto)", completedAt: utc("2021-12-10"), expiresAt: utc("2026-12-10") },
    ...people.map((person) => ({ barId: bar.id, userId: person.id, kind: "OTHER" as const, title: "Sicurezza generale e specifica", completedAt: utc("2024-02-15"), expiresAt: utc("2029-02-15") })),
  ];
  await prisma.courseCertificate.createMany({ data: certificates });

  await prisma.task.createMany({
    data: [
      { barId: bar.id, title: "Controllo estintori", dueDate: day("2026-11-15", 9), repeatEvery: 6, repeatUnit: "MONTH", assignedToId: id("Giulia"), createdById: owner.id },
      { barId: bar.id, title: "Aggiornare il DVR con la nuova piegatrice", dueDate: day("2026-11-10", 9), isUrgent: true, assignedToId: id("Giulia"), createdById: owner.id },
      { barId: bar.id, title: "Ordinare dischi da taglio", dueDate: day("2026-10-31", 9), assignedToId: id("Luca"), createdById: owner.id },
    ],
  });

  const csv = TEMPLATE_PRESETS.find((preset) => preset.key === "tracciato-csv")!.template;
  await prisma.payrollRecipient.create({
    data: { barId: bar.id, role: "consulente", name: "Studio Bianchi", email: "consulente@azienda.demo.workbit.invalid", sendDay: 5, template: csv as unknown as Prisma.InputJsonValue },
  });

  // Supplier invoices with their payment terms.
  for (const spec of invoices()) {
    const taxable = spec.lines.reduce((sum, line) => sum + cents(line.qty * line.price), 0);
    const vat = Math.round(taxable * 0.22);
    const supplierKey = spec.supplier.vat;
    const invoice = await prisma.supplierInvoice.create({
      data: {
        barId: bar.id,
        source: "upload",
        dedupeKey: [supplierKey, spec.number, spec.date, "TD01"].join("|"),
        docType: "TD01",
        supplierName: spec.supplier.name,
        supplierVat: spec.supplier.vat,
        number: spec.number,
        issueDate: utc(spec.date),
        totalCents: taxable + vat,
        taxableCents: taxable,
        vatCents: vat,
        xmlGz: gzipSync(Buffer.from(xmlOf(spec, taxable, vat), "utf8")),
        paymentsReadAt: new Date(),
        lines: {
          create: spec.lines.map((line, index) => ({
            barId: bar.id,
            lineNo: index + 1,
            description: line.description,
            quantity: line.qty,
            unit: line.unit,
            unitPrice: line.price,
            totalCents: cents(line.qty * line.price),
            vatRate: 22,
            category: line.category,
            categorySource: "rule",
            productKey: line.productKey,
            productLabel: line.productLabel,
            baseUnit: line.baseUnit,
            baseQty: line.baseUnit ? line.qty : null,
          })),
        },
      },
    });
    await prisma.supplierPayment.create({
      data: {
        barId: bar.id,
        invoiceId: invoice.id,
        dueDate: utc(spec.due),
        amountCents: taxable + vat,
        method: spec.method,
        iban: spec.method === "MP05" ? spec.supplier.iban ?? null : null,
        state: spec.state ?? null,
        paidAt: spec.state === "PAID" ? utc(spec.due) : null,
        // Already "asked" and "reminded": the demo must not push notifications at night.
        askedAt: new Date(),
        remindedAt: new Date(),
      },
    });
  }
  await prisma.monthlyRevenue.createMany({
    data: [
      { barId: bar.id, month: "2026-09", amountCents: 9_850_000 },
      { barId: bar.id, month: "2026-10", amountCents: 10_420_000 },
    ],
  });

  await seedMarket(bar.id);
  console.log(`Creato: ${BAR_NAME}`);
  console.log(`Titolari: ${owners.map((item) => item.email).join(", ")}`);
  console.log(`Dipendente demo: ${EMPLOYEE_EMAIL} / ${employeePassword}`);
}

/**
 * Market values for the demo only (barId set: no other venue sees them),
 * so "the market moved this much" shows tonight. Real ones are typed in
 * the console every month.
 */
async function seedMarket(barId: string) {
  const values: Record<string, number[]> = {
    "inox-304": [100, 99.6, 99.2, 98.9],
    "acciaio-carbonio": [100, 100.5, 101, 101.2],
    gasolio: [1.73, 1.76, 1.71, 1.72],
    "energia-pun": [112, 118, 121, 115],
  };
  await prisma.marketPrice.deleteMany({ where: { barId } });
  await prisma.marketPrice.createMany({
    data: Object.entries(values).flatMap(([indexKey, list]) => list.map((value, index) => ({ indexKey, month: MONTHS[index], value, barId }))),
  });
}

const mode = process.argv[2];
(mode === "--remove"
  ? remove()
  : mode === "--confirm"
    ? create()
    : mode === "--market"
      ? prisma.bar.findFirstOrThrow({ where: { name: BAR_NAME }, select: { id: true } }).then((bar) => seedMarket(bar.id))
      : Promise.reject(new Error("Usa --confirm o --remove")))
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
