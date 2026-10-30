/**
 * What a venue spends on, in the words a bar owner uses. "merce" is what is
 * sold over the counter or cooked - the food and drink cost read against
 * takings; the rest are running costs.
 */
export type CostCategory = {
  key: string;
  label: string;
  color: string;
  kind: "merce" | "spese";
};

export const COST_CATEGORIES: CostCategory[] = [
  { key: "caffe", label: "Caffè", color: "#7c4a2d", kind: "merce" },
  { key: "bibite", label: "Bibite e acqua", color: "#0ea5e9", kind: "merce" },
  { key: "birra", label: "Birra", color: "#d97706", kind: "merce" },
  { key: "vini", label: "Vini e spumanti", color: "#9f1239", kind: "merce" },
  { key: "alcolici", label: "Superalcolici e liquori", color: "#7e22ce", kind: "merce" },
  { key: "latte", label: "Latte e latticini", color: "#60a5fa", kind: "merce" },
  { key: "alimentari", label: "Alimentari", color: "#16a34a", kind: "merce" },
  { key: "fresco", label: "Pane, dolci e fresco", color: "#ca8a04", kind: "merce" },
  { key: "frutta_verdura", label: "Frutta e verdura", color: "#65a30d", kind: "merce" },
  { key: "carne_pesce", label: "Carne e pesce", color: "#dc2626", kind: "merce" },
  // A company's purchases: what goes into what it makes or sells.
  { key: "materie_prime", label: "Materie prime e semilavorati", color: "#0f766e", kind: "merce" },
  { key: "componenti", label: "Componenti e minuteria", color: "#2563eb", kind: "merce" },
  { key: "lavorazioni", label: "Lavorazioni esterne", color: "#9333ea", kind: "merce" },
  { key: "carburante", label: "Carburante e mezzi", color: "#b45309", kind: "spese" },
  { key: "monouso", label: "Monouso e confezioni", color: "#94a3b8", kind: "spese" },
  { key: "pulizia", label: "Pulizia e igiene", color: "#14b8a6", kind: "spese" },
  { key: "energia", label: "Luce e gas", color: "#f59e0b", kind: "spese" },
  { key: "utenze", label: "Acqua e rifiuti", color: "#0284c7", kind: "spese" },
  { key: "telefonia", label: "Telefono e internet", color: "#6366f1", kind: "spese" },
  { key: "affitto", label: "Affitto", color: "#64748b", kind: "spese" },
  { key: "manutenzione", label: "Manutenzioni e attrezzature", color: "#78716c", kind: "spese" },
  { key: "servizi", label: "Consulenze e software", color: "#8b5cf6", kind: "spese" },
  { key: "pos_banca", label: "POS, banca e commissioni", color: "#0f766e", kind: "spese" },
  { key: "assicurazioni", label: "Assicurazioni", color: "#475569", kind: "spese" },
  { key: "marketing", label: "Pubblicità", color: "#ec4899", kind: "spese" },
  { key: "trasporti", label: "Trasporti e consegne", color: "#a16207", kind: "spese" },
  { key: "altro", label: "Altro", color: "#a3a3a3", kind: "spese" },
  { key: "da_classificare", label: "Da classificare", color: "#d4d4d8", kind: "spese" },
];

export const CATEGORY_BY_KEY = new Map(COST_CATEGORIES.map((category) => [category.key, category]));

export function categoryOf(key: string | null | undefined) {
  return CATEGORY_BY_KEY.get(key ?? "") ?? CATEGORY_BY_KEY.get("da_classificare")!;
}

export function isCategoryKey(key: string) {
  return CATEGORY_BY_KEY.has(key) && key !== "da_classificare";
}

export function normalizeText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9.,%/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Order matters: the first match wins, so the narrow words come first
// ("CAFFE" inside "LIQUORE AL CAFFE" is a liquor).
const LINE_RULES: Array<[RegExp, string]> = [
  [/\b(KWH|ENERGIA ATTIVA|SPREAD|PUN|ONERI DI SISTEMA|TRASPORTO E GESTIONE CONTATORE|DISPACCIAMENTO|SMC|GAS NATURALE|ACCISA (SU|ENERGIA|GAS)|POTENZA IMPEGNATA)\b/, "energia"],
  [/\b(CANONE (FIBRA|ADSL|TELEFON|MOBILE)|FIBRA|ADSL|TRAFFICO (VOCE|DATI)|SIM\b|LINEA TELEFONICA)/, "telefonia"],
  [/\b(COMMISSION[EI]|TRANSATO|CANONE POS|NOLEGGIO POS|PAGOBANCOMAT|SPESE (TENUTA )?CONTO)\b/, "pos_banca"],
  [/\b(CANONE (DI )?LOCAZIONE|AFFITTO|PIGIONE)\b/, "affitto"],
  [/\b(PREMIO ASSICURATIVO|POLIZZA|RCT)\b/, "assicurazioni"],
  [/\b(TARI|SERVIZIO IDRICO|DEPURAZIONE|FOGNATURA|RIFIUTI)\b/, "utenze"],
  [/\b(ONORARI|COMPENSO PROFESSIONALE|ELABORAZIONE (PAGHE|CEDOLINI|BUSTE)|CONSULENZA|ABBONAMENTO SOFTWARE|LICENZA|CANONE SOFTWARE|TENUTA CONTABILITA)\b/, "servizi"],
  [/\b(SPONSORIZZAT|PUBBLICITA|VOLANTINI|STAMPA MANIFESTI|INSERZIONE)\b/, "marketing"],
  [/\b(TRASPORTO|SPESE (DI )?(SPEDIZIONE|CONSEGNA|INCASSO)|CONTRIBUTO CONSEGNA)\b/, "trasporti"],
  [/\b(RIPARAZIONE|MANUTENZIONE|INTERVENTO TECNICO|ASSISTENZA TECNICA|MANODOPERA|RICAMBI?)\b/, "manutenzione"],
  [/\b(AMARO|LIMONCELLO|GRAPPA|VODKA|GIN|RUM|WHISK(E)?Y|TEQUILA|BRANDY|COGNAC|APEROL|CAMPARI|MARTINI|VERMOUTH|BITTER|JAGERMEISTER|SAMBUCA|LIQUORE|AMARETTO|BAILEYS|SELECT|ROSOLIO)\b/, "alcolici"],
  [/\b(BIRRA|BEER|PERONI|MORETTI|HEINEKEN|NASTRO AZZURRO|MENABREA|ICHNUSA|CORONA|BECKS|TENNENT|FORST|POMPEII?|FUSTO|KEG|IPA|LAGER|WEISS)\b/, "birra"],
  [/\b(VINO|PROSECCO|SPUMANTE|CHAMPAGNE|FRANCIACORTA|DOCG|IGT|CABERNET|MERLOT|PINOT|CHARDONNAY|SANGIOVESE|CHIANTI|LAMBRUSCO|MOSCATO|BRUT)\b/, "vini"],
  [/\b(CAFFE|CAFFE'|COFFEE|ESPRESSO|MISCELA|GRANI|CIALDE|CAPSULE|DECAFFEINATO|DEK|ORZO|GINSENG|CIOCCOLATA CALDA|TE |THE |TISANA|INFUSO)\b/, "caffe"],
  [/\b(LATTE|PANNA|YOGURT|MOZZARELLA|FORMAGGIO|PARMIGIANO|GRANA|BURRO|RICOTTA|MASCARPONE|BEVANDA (DI )?(SOIA|AVENA|MANDORLA|RISO))\b/, "latte"],
  [/\b(ACQUA|MINERALE|FRIZZANTE|NATURALE|COCA|COLA|FANTA|SPRITE|SCHWEPPES|TONICA|TONIC|ARANCIATA|CHINOTTO|GASSOSA|SUCCO|SUCCHI|ESTATHE|ESTA THE|RED BULL|ENERGY|LEMONSODA|CEDRATA|GINGER|BITTER ANALCOLICO|SAN PELLEGRINO|SANPELLEGRINO|LEVISSIMA|SAN BENEDETTO|NESTEA|BIBITA|SCIROPPO|PEPSI)\b/, "bibite"],
  [/\b(CORNETT[OI]|BRIOCHE|CROISSANT|PANE|PANINI|FOCACCIA|PIZZETT|TRAMEZZIN|PASTICCERIA|TORTA|DOLC[EI]|BISCOTT[OI]|MIGNON|GELATO)\b/, "fresco"],
  [/\b(FRUTTA|VERDURA|LIMON[EI]|ARANC[EI]|MELE|BANANE|INSALATA|POMODOR[OI]|ZUCCHIN|PATATE|CIPOLL|MENTA|LIME|BASILICO|FRAGOLE)\b/, "frutta_verdura"],
  [/\b(CARNE|POLLO|MANZO|SUINO|VITELLO|PROSCIUTTO|SALAME|MORTADELLA|SPECK|BRESAOLA|SALSICCIA|PESCE|TONNO|SALMONE|GAMBERI|ACCIUGHE)\b/, "carne_pesce"],
  [/\b(FARINA|ZUCCHERO|OLIO|PASTA|RISO|SALE|ACETO|SPEZIE|MAIONESE|KETCHUP|SALSA|PATATINE|NOCCIOLINE|OLIVE|SNACK|CRACKER|CREMA|NUTELLA|MIELE|MARMELLATA|CONFETTURA|UOVA|SURGELAT)\b/, "alimentari"],
  [/\b(BICCHIER[EI]|CANNUCC|TOVAGLIOL|PIATTI|POSATE|PALETTE|COPERCHI|VASCHETT|SACCHETT|SHOPPER|BUSTE|CARTA FORNO|PELLICOLA|ALLUMINIO|MONOUSO|COPPETTE|CONTENITORI|ROTOLI|SCONTRINI|CARTA TERMICA)\b/, "monouso"],
  [/\b(DETERSIVO|DETERGENTE|SGRASSATORE|IGIENIZZANTE|DISINFETTANTE|CANDEGGINA|BRILLANTANTE|ANTICALCARE|SAPONE|GUANTI|SPUGN|PANNO|STRACCI|CARTA IGIENICA|ASCIUGAMANI|SACCHI (NERI|IMMONDIZIA)|PULIZIA)\b/, "pulizia"],
];

// A supplier's name says what it sells when its lines are cryptic.
const SUPPLIER_RULES: Array<[RegExp, string]> = [
  [/\b(ENEL|A2A|EDISON|HERA|IREN|ENI PLENITUDE|PLENITUDE|SORGENIA|ACEA ENERGIA|ENGIE|E\.?ON|ILLUMIA|DOLOMITI ENERGIA|AGSM|ESTRA|ENERGIA|POWER|LUCE E GAS)\b/, "energia"],
  [/\b(TIM|TELECOM|VODAFONE|WIND|FASTWEB|ILIAD|TISCALI|EOLO|OPEN FIBER|LINKEM)\b/, "telefonia"],
  [/\b(NEXI|SUMUP|SATISPAY|WORLDLINE|AXERVE|STRIPE|BANCA|BANCO|INTESA|UNICREDIT|BPER|CREDIT AGRICOLE|MPS|POSTE ITALIANE|ZETTLE|PAYPAL)\b/, "pos_banca"],
  [/\b(ASSICURAZION[EI]|GENERALI|ALLIANZ|UNIPOL|AXA|REALE MUTUA|CATTOLICA|ZURICH|GROUPAMA)\b/, "assicurazioni"],
  [/\b(ACQUEDOTTO|ACQUE|ABBANOA|ACEA ATO|SERVIZI IDRICI|IGIENE URBANA|AMBIENTE)\b/, "utenze"],
  [/\b(LAVAZZA|ILLY|KIMBO|SEGAFREDO|VERGNANO|BORBONE|PELLINI|HAUSBRANDT|DIEMME|BIALETTI|TORREFAZIONE|CAFFE|COFFEE)\b/, "caffe"],
  [/\b(META PLATFORMS|FACEBOOK|GOOGLE|THEFORK|DELIVEROO|GLOVO|JUST EAT|TRIPADVISOR)\b/, "marketing"],
  [/\b(STUDIO|COMMERCIALIST|CONSULEN|SOFTWARE|INFORMATICA|SISTEMI|WORKBIT)\b/, "servizi"],
  [/\b(METRO ITALIA|METRO CASH|SOGEGROSS|CARREFOUR|EUROSPIN|ESSELUNGA|COOP|CONAD|LIDL)\b/, "alimentari"],
];

export function categorizeByRules(description: string, supplierName: string, unit: string | null) {
  const text = normalizeText(description);
  const unitText = normalizeText(unit ?? "");
  if (unitText === "KWH" || unitText === "SMC") return "energia";
  for (const [pattern, category] of LINE_RULES) if (pattern.test(` ${text} `)) return category;
  const supplier = normalizeText(supplierName);
  for (const [pattern, category] of SUPPLIER_RULES) if (pattern.test(` ${supplier} `)) return category;
  return null;
}

export function categoryFromSupplier(supplierName: string) {
  const supplier = normalizeText(supplierName);
  for (const [pattern, category] of SUPPLIER_RULES) if (pattern.test(` ${supplier} `)) return category;
  return null;
}

const BOX_UNITS = /^(CT|CRT|CTN|CF|CONF|CS|CASSA|CASSE|FD|FARD|FARDELLO|PK|PACK|SC|SCAT|SCATOLA|CART|CARTONE|COLLO|COLLI|BOX)$/;
const PIECE_UNITS = /^(PZ|PZI|PEZZI|NR|N|NUM|BT|BOT|BOTT|BOTTIGLIA|LATT|LATTINA|UN|UNITA|PC|BAR|FUSTO|FS)$/;

function parseNumber(text: string) {
  return Number(text.replace(",", "."));
}

/**
 * How much of a base unit one invoiced unit holds, read from the words: a
 * "PERONI CL33 X24" sold by the "CT" is 24 × 0,33 l. A guess the AI pass
 * replaces where it can; null when the words do not say.
 */
export function unitsFromDescription(description: string, unit: string | null): { baseUnit: string; unitsPerItem: number } | null {
  const text = normalizeText(description);
  const invoiced = normalizeText(unit ?? "").replace(/\./g, "");

  if (/^(KG|KGS|KILO|KILOGRAMMI)$/.test(invoiced)) return { baseUnit: "kg", unitsPerItem: 1 };
  if (/^(GR|G|GRAMMI)$/.test(invoiced)) return { baseUnit: "kg", unitsPerItem: 0.001 };
  if (/^(L|LT|LTR|LITRI|LITRO)$/.test(invoiced)) return { baseUnit: "l", unitsPerItem: 1 };
  if (invoiced === "KWH") return { baseUnit: "kwh", unitsPerItem: 1 };
  if (invoiced === "SMC" || invoiced === "MC") return { baseUnit: "smc", unitsPerItem: 1 };

  let size: { baseUnit: string; amount: number } | null = null;
  // "33CL", "0,33 L" or "CL33", "CL.33": the number on either side.
  const sized = (units: string) => {
    const after = text.match(new RegExp(String.raw`(\d+(?:[.,]\d+)?)\s*(${units})\b`));
    if (after) return { amount: parseNumber(after[1]), unit: after[2] };
    const before = text.match(new RegExp(String.raw`\b(${units})\s*\.?\s*(\d+(?:[.,]\d+)?)`));
    return before ? { amount: parseNumber(before[2]), unit: before[1] } : null;
  };
  const volume = sized("CL|ML|LT|L");
  if (volume && volume.amount > 0) {
    const factor = volume.unit === "CL" ? 0.01 : volume.unit === "ML" ? 0.001 : 1;
    size = { baseUnit: "l", amount: volume.amount * factor };
  }
  if (!size) {
    const weight = sized("KG|GR|G");
    if (weight && weight.amount > 0) size = { baseUnit: "kg", amount: weight.unit === "KG" ? weight.amount : weight.amount / 1000 };
  }

  const count = Number(text.match(/\bX\s*(\d{1,3})\b/)?.[1] ?? text.match(/\b(\d{1,3})\s*X\s*\d/)?.[1] ?? text.match(/\b(?:CONF|PZ|CF)\.?\s*(\d{1,3})\b/)?.[1] ?? 0);

  if (size) {
    // Sold by the box: the box holds `count` of them. Sold by the piece, or
    // with no unit: one of them.
    const perItem = BOX_UNITS.test(invoiced) && count > 1 ? size.amount * count : size.amount;
    return { baseUnit: size.baseUnit, unitsPerItem: perItem };
  }
  if (PIECE_UNITS.test(invoiced)) return { baseUnit: "pz", unitsPerItem: 1 };
  if (BOX_UNITS.test(invoiced) && count > 1) return { baseUnit: "pz", unitsPerItem: count };
  return null;
}

/** A product's identity across invoices, from its words when nothing better is known. */
export function productKeyFromDescription(description: string) {
  return normalizeText(description)
    .toLowerCase()
    .replace(/\b(lotto|lot|scad|scadenza|ddt|del|n)\b.*$/, "")
    .replace(/[.,/%]/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 6)
    .join("-")
    .slice(0, 80);
}

export const BASE_UNIT_LABEL: Record<string, string> = {
  kg: "kg",
  l: "litro",
  pz: "pezzo",
  kwh: "kWh",
  smc: "Smc",
};
