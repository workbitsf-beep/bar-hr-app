/**
 * How a consultant wants the month's attendance: which rows, which columns
 * under which names, the codes of their payroll software, the formats of
 * dates and hours, the kind of file. Pure, so the settings page previews the
 * file in the browser while it is being set up, with the same code that
 * writes it on the server.
 */

export type PayrollCodeKey = "ordinary" | "overtime" | "holiday" | "leave" | "sickness" | "closure" | "publicHoliday" | "training";

export const PAYROLL_KINDS: PayrollCodeKey[] = ["ordinary", "overtime", "holiday", "leave", "sickness", "publicHoliday", "closure", "training"];

export const PAYROLL_CODE_LABELS: Record<PayrollCodeKey, string> = {
  ordinary: "Ore ordinarie",
  overtime: "Straordinari",
  holiday: "Ferie",
  leave: "Permessi",
  sickness: "Malattia",
  closure: "Chiusura del locale",
  publicHoliday: "Festività",
  training: "Formazione",
};

export const DEFAULT_PAYROLL_CODES: Record<PayrollCodeKey, string> = {
  ordinary: "ORD",
  overtime: "STR",
  holiday: "FER",
  leave: "PER",
  sickness: "MAL",
  closure: "CHI",
  publicHoliday: "FES",
  training: "FOR",
};

/** Whole days away: counted in days, and in hours only with the contract's. */
export const DAY_KINDS: PayrollCodeKey[] = ["holiday", "sickness", "closure", "publicHoliday"];

export type PayrollEntry = {
  /** YYYY-MM-DD */
  date: string;
  kind: PayrollCodeKey;
  hours: number;
  /** 1 for a whole day away (holiday, sickness, closure), 0 for hours. */
  days: number;
};

export type PayrollPersonData = {
  userId: string;
  firstName: string;
  lastName: string;
  payrollCode: string | null;
  contractWeeklyHours: number | null;
  entries: PayrollEntry[];
};

export type PayrollMonthData = {
  month: number;
  year: number;
  venueName: string;
  legalName: string | null;
  vatNumber: string | null;
  people: PayrollPersonData[];
};

export type PayrollLayout = "rows" | "perCode" | "perPerson" | "calendar";

export const LAYOUT_LABELS: Record<PayrollLayout, { title: string; hint: string }> = {
  rows: { title: "Una riga per giorno", hint: "Persona, data, causale e ore: il tracciato che i programmi paghe importano." },
  perCode: { title: "Una riga per causale", hint: "Il totale del mese di ogni causale, persona per persona." },
  perPerson: { title: "Una riga per persona", hint: "Il riepilogo del mese, una colonna per causale." },
  calendar: { title: "Calendario del mese", hint: "Le persone in riga e i giorni in colonna, come un foglio presenze." },
};

export type PayrollField =
  | "matricola"
  | "cognome"
  | "nome"
  | "nominativo"
  | "data"
  | "giorno"
  | "causale"
  | "descrizione"
  | "ore"
  | "giorni"
  | "oreContratto"
  | "mese"
  | "anno"
  | "periodo"
  | "azienda"
  | "piva"
  | "fisso";

export const FIELD_LABELS: Record<PayrollField, string> = {
  matricola: "Matricola o codice fiscale",
  cognome: "Cognome",
  nome: "Nome",
  nominativo: "Cognome e nome",
  data: "Data",
  giorno: "Giorno del mese",
  causale: "Codice causale",
  descrizione: "Descrizione causale",
  ore: "Ore",
  giorni: "Giorni",
  oreContratto: "Ore di contratto a settimana",
  mese: "Mese (numero)",
  anno: "Anno",
  periodo: "Periodo (mese/anno)",
  azienda: "Ragione sociale",
  piva: "Partita IVA",
  fisso: "Valore fisso",
};

/** The fields that make sense in each layout; the calendar has its own columns. */
export const LAYOUT_FIELDS: Record<Exclude<PayrollLayout, "calendar">, PayrollField[]> = {
  rows: ["matricola", "cognome", "nome", "nominativo", "data", "giorno", "causale", "descrizione", "ore", "giorni", "oreContratto", "mese", "anno", "periodo", "azienda", "piva", "fisso"],
  perCode: ["matricola", "cognome", "nome", "nominativo", "causale", "descrizione", "ore", "giorni", "oreContratto", "mese", "anno", "periodo", "azienda", "piva", "fisso"],
  perPerson: ["matricola", "cognome", "nome", "nominativo", "oreContratto", "mese", "anno", "periodo", "azienda", "piva", "fisso"],
};

export type PayrollColumn = { field: PayrollField; header: string; value?: string };

export type DateFormat = "dd/mm/yyyy" | "dd-mm-yyyy" | "dd.mm.yyyy" | "dd/mm/yy" | "yyyy-mm-dd" | "ddmmyyyy" | "yyyymmdd";
export const DATE_FORMATS: DateFormat[] = ["dd/mm/yyyy", "dd-mm-yyyy", "dd.mm.yyyy", "dd/mm/yy", "yyyy-mm-dd", "ddmmyyyy", "yyyymmdd"];

export type PayrollTemplate = {
  version: 1;
  layout: PayrollLayout;
  /** rows, perCode and perPerson: the columns, in order. */
  columns: PayrollColumn[];
  /** perPerson: one column per kind, in this order, headed by code or by name. */
  personKinds: PayrollCodeKey[];
  personHeader: "code" | "label";
  /** perPerson: whole days away in days or in hours. */
  personDayUnit: "days" | "hours";
  /** calendar: what a day's cell says. */
  calendarCell: "hours" | "codeHours";
  calendarTotals: boolean;
  /** The consultant's code for each kind; an empty one leaves that kind out of the file. */
  codes: Record<PayrollCodeKey, string>;
  fileType: "xlsx" | "csv";
  csvSeparator: ";" | "," | "\t" | "|";
  encoding: "utf8bom" | "utf8" | "latin1";
  headerRow: boolean;
  dateFormat: DateFormat;
  decimal: "comma" | "dot";
  hoursFormat: "decimal" | "hhmm";
  /** Rows with zero hours and zero days are left out. */
  skipEmpty: boolean;
  /** With {azienda}, {anno}, {mese} (2 cifre), {nomemese}. */
  fileName: string;
  sheetName: string;
  /** xlsx: a second sheet with the month's summary per person. */
  summarySheet: boolean;
};

const ROWS_COLUMNS: PayrollColumn[] = [
  { field: "matricola", header: "Matricola" },
  { field: "cognome", header: "Cognome" },
  { field: "nome", header: "Nome" },
  { field: "data", header: "Data" },
  { field: "causale", header: "Causale" },
  { field: "descrizione", header: "Descrizione" },
  { field: "ore", header: "Ore" },
  { field: "giorni", header: "Giorni" },
];

function base(): PayrollTemplate {
  return {
    version: 1,
    layout: "rows",
    columns: ROWS_COLUMNS,
    personKinds: [...PAYROLL_KINDS],
    personHeader: "label",
    personDayUnit: "days",
    calendarCell: "codeHours",
    calendarTotals: true,
    codes: { ...DEFAULT_PAYROLL_CODES },
    fileType: "xlsx",
    csvSeparator: ";",
    encoding: "utf8bom",
    headerRow: true,
    dateFormat: "dd/mm/yyyy",
    decimal: "comma",
    hoursFormat: "decimal",
    skipEmpty: true,
    fileName: "presenze-{azienda}-{anno}-{mese}",
    sheetName: "Presenze",
    summarySheet: true,
  };
}

export const TEMPLATE_PRESETS: Array<{ key: string; title: string; hint: string; template: PayrollTemplate }> = [
  {
    key: "tracciato",
    title: "Tracciato giornaliero (Excel)",
    hint: "Una riga per persona, giorno e causale, più un foglio di riepilogo.",
    template: base(),
  },
  {
    key: "tracciato-csv",
    title: "Tracciato da importare (CSV)",
    hint: "Le stesse righe in un CSV con il punto e virgola, per l'import nel programma paghe.",
    template: { ...base(), fileType: "csv", summarySheet: false },
  },
  {
    key: "calendario",
    title: "Foglio presenze del mese",
    hint: "Persone in riga, giorni in colonna, con le causali nelle caselle.",
    template: {
      ...base(),
      layout: "calendar",
      columns: [
        { field: "matricola", header: "Matricola" },
        { field: "nominativo", header: "Dipendente" },
      ],
      sheetName: "Foglio presenze",
    },
  },
  {
    key: "riepilogo",
    title: "Riepilogo per persona",
    hint: "Una riga per persona con i totali del mese di ogni causale.",
    template: {
      ...base(),
      layout: "perPerson",
      columns: [
        { field: "matricola", header: "Matricola" },
        { field: "cognome", header: "Cognome" },
        { field: "nome", header: "Nome" },
      ],
      sheetName: "Riepilogo",
      summarySheet: false,
    },
  },
  {
    key: "causali",
    title: "Totali per causale",
    hint: "Una riga per persona e causale con le ore e i giorni del mese.",
    template: {
      ...base(),
      layout: "perCode",
      columns: [
        { field: "matricola", header: "Matricola" },
        { field: "nominativo", header: "Dipendente" },
        { field: "periodo", header: "Periodo" },
        { field: "causale", header: "Causale" },
        { field: "ore", header: "Ore" },
        { field: "giorni", header: "Giorni" },
      ],
      summarySheet: false,
    },
  },
];

export function defaultTemplate() {
  return base();
}

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

/** Whatever is stored, or comes back from Claude, made into a template that works. */
export function templateOf(value: unknown): PayrollTemplate {
  const fallback = base();
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const stored = value as Record<string, unknown>;
  const layout = pick(stored.layout, ["rows", "perCode", "perPerson", "calendar"] as const, fallback.layout);
  const allowedFields: readonly PayrollField[] = layout === "calendar" ? LAYOUT_FIELDS.perPerson : LAYOUT_FIELDS[layout];

  const columns = Array.isArray(stored.columns)
    ? stored.columns
        .map((column) => {
          if (!column || typeof column !== "object") return null;
          const item = column as Record<string, unknown>;
          const field = pick(item.field, allowedFields, "fisso");
          if (field === "fisso" && item.field !== "fisso") return null;
          const header = typeof item.header === "string" ? item.header.slice(0, 60) : FIELD_LABELS[field];
          return { field, header, ...(field === "fisso" ? { value: typeof item.value === "string" ? item.value.slice(0, 60) : "" } : {}) };
        })
        .filter((column): column is PayrollColumn => column !== null)
        .slice(0, 30)
    : fallback.columns;

  const storedCodes = stored.codes && typeof stored.codes === "object" ? (stored.codes as Record<string, unknown>) : {};
  const codes = { ...DEFAULT_PAYROLL_CODES };
  for (const kind of PAYROLL_KINDS) {
    if (typeof storedCodes[kind] === "string") codes[kind] = (storedCodes[kind] as string).trim().slice(0, 16);
  }
  const personKinds = Array.isArray(stored.personKinds)
    ? stored.personKinds.filter((kind): kind is PayrollCodeKey => PAYROLL_KINDS.includes(kind as PayrollCodeKey))
    : fallback.personKinds;

  const text = (key: string, max: number, otherwise: string) =>
    typeof stored[key] === "string" && (stored[key] as string).trim() ? (stored[key] as string).trim().slice(0, max) : otherwise;
  const flag = (key: string, otherwise: boolean) => (typeof stored[key] === "boolean" ? (stored[key] as boolean) : otherwise);

  return {
    version: 1,
    layout,
    columns: columns.length || layout === "calendar" ? columns : fallback.columns,
    personKinds: personKinds.length ? Array.from(new Set(personKinds)) : fallback.personKinds,
    personHeader: pick(stored.personHeader, ["code", "label"] as const, fallback.personHeader),
    personDayUnit: pick(stored.personDayUnit, ["days", "hours"] as const, fallback.personDayUnit),
    calendarCell: pick(stored.calendarCell, ["hours", "codeHours"] as const, fallback.calendarCell),
    calendarTotals: flag("calendarTotals", fallback.calendarTotals),
    codes,
    fileType: pick(stored.fileType, ["xlsx", "csv"] as const, fallback.fileType),
    csvSeparator: pick(stored.csvSeparator, [";", ",", "\t", "|"] as const, fallback.csvSeparator),
    encoding: pick(stored.encoding, ["utf8bom", "utf8", "latin1"] as const, fallback.encoding),
    headerRow: flag("headerRow", fallback.headerRow),
    dateFormat: pick(stored.dateFormat, DATE_FORMATS, fallback.dateFormat),
    decimal: pick(stored.decimal, ["comma", "dot"] as const, fallback.decimal),
    hoursFormat: pick(stored.hoursFormat, ["decimal", "hhmm"] as const, fallback.hoursFormat),
    skipEmpty: flag("skipEmpty", fallback.skipEmpty),
    fileName: text("fileName", 80, fallback.fileName).replace(/[\\/:*?"<>|]+/g, "-"),
    sheetName: text("sheetName", 31, fallback.sheetName).replace(/[\\/?*[\]:]+/g, " "),
    summarySheet: flag("summarySheet", fallback.summarySheet),
  };
}

/* ---------- Rendering ---------- */

export type Cell = string | number;
/** What a row of the file stands for: a person, and for some layouts a day and an item. */
export type RowRef = { userId: string; date?: string; kind?: PayrollCodeKey };
export type PayrollTable = { header: string[] | null; rows: Cell[][]; legend: string | null; refs: RowRef[] };

const round2 = (value: number) => Math.round(value * 100) / 100;

export function formatDate(dayKey: string, format: DateFormat) {
  const [year, month, day] = dayKey.split("-");
  switch (format) {
    case "dd-mm-yyyy":
      return `${day}-${month}-${year}`;
    case "dd.mm.yyyy":
      return `${day}.${month}.${year}`;
    case "dd/mm/yy":
      return `${day}/${month}/${year.slice(2)}`;
    case "yyyy-mm-dd":
      return dayKey;
    case "ddmmyyyy":
      return `${day}${month}${year}`;
    case "yyyymmdd":
      return `${year}${month}${day}`;
    default:
      return `${day}/${month}/${year}`;
  }
}

/** Hours as the template wants them: a number for Excel, or text ("8:30", "7,5"). */
function hoursCell(value: number, template: PayrollTemplate): Cell {
  if (template.hoursFormat === "hhmm") {
    const minutes = Math.round(value * 60);
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
  }
  return round2(value);
}

const monthNames = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

function personValue(column: PayrollColumn, person: PayrollPersonData, data: PayrollMonthData): Cell {
  switch (column.field) {
    case "matricola":
      return person.payrollCode ?? "";
    case "cognome":
      return person.lastName;
    case "nome":
      return person.firstName;
    case "nominativo":
      return `${person.lastName} ${person.firstName}`.trim();
    case "oreContratto":
      return person.contractWeeklyHours ?? "";
    case "mese":
      return String(data.month).padStart(2, "0");
    case "anno":
      return data.year;
    case "periodo":
      return `${String(data.month).padStart(2, "0")}/${data.year}`;
    case "azienda":
      return data.legalName || data.venueName;
    case "piva":
      return data.vatNumber ?? "";
    case "fisso":
      return column.value ?? "";
    default:
      return "";
  }
}

function entryValue(
  column: PayrollColumn,
  person: PayrollPersonData,
  data: PayrollMonthData,
  entry: { date?: string; kind: PayrollCodeKey; hours: number; days: number },
  template: PayrollTemplate,
): Cell {
  switch (column.field) {
    case "data":
      return entry.date ? formatDate(entry.date, template.dateFormat) : "";
    case "giorno":
      return entry.date ? Number(entry.date.slice(8, 10)) : "";
    case "causale":
      return template.codes[entry.kind];
    case "descrizione":
      return PAYROLL_CODE_LABELS[entry.kind];
    case "ore":
      return hoursCell(entry.hours, template);
    case "giorni":
      return entry.days;
    default:
      return personValue(column, person, data);
  }
}

function totalsOf(person: PayrollPersonData) {
  const totals = new Map<PayrollCodeKey, { hours: number; days: number }>();
  for (const entry of person.entries) {
    const total = totals.get(entry.kind) ?? { hours: 0, days: 0 };
    total.hours = round2(total.hours + entry.hours);
    total.days += entry.days;
    totals.set(entry.kind, total);
  }
  return totals;
}

const exported = (template: PayrollTemplate, kind: PayrollCodeKey) => Boolean(template.codes[kind]);

/** The month as the template's table: header, rows and, for the calendar, a legend. */
export function renderPayrollTable(data: PayrollMonthData, template: PayrollTemplate): PayrollTable {
  const header = template.headerRow ? template.columns.map((column) => column.header) : null;

  if (template.layout === "rows") {
    const rows: Cell[][] = [];
    const refs: RowRef[] = [];
    for (const person of data.people) {
      for (const entry of person.entries) {
        if (!exported(template, entry.kind)) continue;
        if (template.skipEmpty && !entry.hours && !entry.days) continue;
        rows.push(template.columns.map((column) => entryValue(column, person, data, entry, template)));
        refs.push({ userId: person.userId, date: entry.date, kind: entry.kind });
      }
    }
    return { header, rows, legend: null, refs };
  }

  if (template.layout === "perCode") {
    const rows: Cell[][] = [];
    const refs: RowRef[] = [];
    for (const person of data.people) {
      const totals = totalsOf(person);
      for (const kind of PAYROLL_KINDS) {
        const total = totals.get(kind);
        if (!exported(template, kind) || !total) continue;
        if (template.skipEmpty && !total.hours && !total.days) continue;
        rows.push(template.columns.map((column) => entryValue(column, person, data, { kind, ...total }, template)));
        refs.push({ userId: person.userId, kind });
      }
    }
    return { header, rows, legend: null, refs };
  }

  if (template.layout === "perPerson") {
    const kinds = template.personKinds.filter((kind) => exported(template, kind));
    const kindHeader = (kind: PayrollCodeKey) => {
      const unit = DAY_KINDS.includes(kind) && template.personDayUnit === "days" ? "gg" : "ore";
      return template.personHeader === "code" ? template.codes[kind] : `${PAYROLL_CODE_LABELS[kind]} (${unit})`;
    };
    const rows = data.people.map((person) => {
      const totals = totalsOf(person);
      return [
        ...template.columns.map((column) => personValue(column, person, data)),
        ...kinds.map((kind) => {
          const total = totals.get(kind);
          if (!total) return "";
          return DAY_KINDS.includes(kind) && template.personDayUnit === "days" ? total.days || "" : total.hours ? hoursCell(total.hours, template) : "";
        }),
      ];
    });
    return {
      header: template.headerRow ? [...template.columns.map((column) => column.header), ...kinds.map(kindHeader)] : null,
      rows,
      legend: null,
      refs: data.people.map((person) => ({ userId: person.userId })),
    };
  }

  // Calendar: people down, days across.
  const days = new Date(Date.UTC(data.year, data.month, 0)).getUTCDate();
  const weekday = ["do", "lu", "ma", "me", "gi", "ve", "sa"];
  const dayHeaders = Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.UTC(data.year, data.month - 1, index + 1));
    return `${index + 1} ${weekday[date.getUTCDay()]}`;
  });
  const rows = data.people.map((person) => {
    const cells: Cell[] = Array.from({ length: days }, () => "");
    let total = 0;
    for (const entry of person.entries) {
      if (!exported(template, entry.kind)) continue;
      const index = Number(entry.date.slice(8, 10)) - 1;
      const worked = entry.kind === "ordinary" || entry.kind === "overtime";
      if (worked) total += entry.hours;
      // Hours alone for ordinary hours (and overtime, if the cell holds hours only);
      // the code otherwise, with its hours when it is not a whole day.
      const piece: Cell =
        entry.kind === "ordinary" || (worked && template.calendarCell === "hours")
          ? hoursCell(entry.hours, template)
          : `${template.codes[entry.kind]}${entry.days ? "" : ` ${cellText(hoursCell(entry.hours, template), template)}`}`;
      const previous = cells[index];
      cells[index] =
        previous === ""
          ? piece
          : typeof previous === "number" && typeof piece === "number"
            ? round2(previous + piece)
            : `${previous} ${piece}`;
    }
    return [
      ...template.columns.map((column) => personValue(column, person, data)),
      ...cells,
      ...(template.calendarTotals ? [hoursCell(total, template)] : []),
    ];
  });
  const legend = `Legenda: numero = ore ordinarie; ${PAYROLL_KINDS.filter((kind) => kind !== "ordinary" && exported(template, kind))
    .map((kind) => `${template.codes[kind]} = ${PAYROLL_CODE_LABELS[kind]}`)
    .join(", ")}`;
  return {
    header: template.headerRow
      ? [...template.columns.map((column) => column.header), ...dayHeaders, ...(template.calendarTotals ? ["Totale ore"] : [])]
      : null,
    rows,
    legend,
    refs: data.people.map((person) => ({ userId: person.userId })),
  };
}

/** A cell as text in the template's formats: for the CSV and for the preview. */
export function cellText(cell: Cell, template: PayrollTemplate) {
  if (typeof cell === "number") {
    const text = Number.isInteger(cell) ? String(cell) : cell.toFixed(2).replace(/0$/, "");
    return template.decimal === "comma" ? text.replace(".", ",") : text;
  }
  return cell;
}

export function payrollCsvText(table: PayrollTable, template: PayrollTemplate) {
  const separator = template.csvSeparator;
  const line = (cells: Cell[]) =>
    cells
      .map((cell) => {
        const text = cellText(cell, template);
        return text.includes(separator) || /["\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
      })
      .join(separator);
  const lines = [...(table.header ? [line(table.header)] : []), ...table.rows.map(line)];
  return `${lines.join("\r\n")}\r\n`;
}

export function payrollFileBaseName(data: PayrollMonthData, template: PayrollTemplate) {
  const venue = (data.legalName || data.venueName).replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "locale";
  return (
    template.fileName
      .replace(/\{azienda\}/g, venue)
      .replace(/\{anno\}/g, String(data.year))
      .replace(/\{mese\}/g, String(data.month).padStart(2, "0"))
      .replace(/\{nomemese\}/g, monthNames[data.month - 1])
      .replace(/[\\/:*?"<>|\s]+/g, "-") || "presenze"
  );
}

export function monthName(month: number, year: number) {
  return `${monthNames[month - 1]} ${year}`;
}

/* ---------- The email ---------- */

export const DEFAULT_MESSAGE = `Ciao {nome},
ti mando le presenze di {mese} di {locale}: {persone}, in allegato.
Fammi sapere se manca qualcosa.

{firma}`;

export function composeMessage(
  text: string | null | undefined,
  values: { name: string; month: string; venue: string; people: number; signature: string },
) {
  const firstName = values.name.trim().split(/\s+/)[0] ?? "";
  return (text?.trim() ? text : DEFAULT_MESSAGE)
    .replace(/\{nome\}/g, /^(studio|dott|rag|avv)/i.test(firstName) ? values.name.trim() : firstName)
    .replace(/\{mese\}/g, values.month)
    .replace(/\{locale\}/g, values.venue)
    .replace(/\{persone\}/g, `${values.people} ${values.people === 1 ? "persona" : "persone"}`)
    .replace(/\{firma\}/g, values.signature)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
