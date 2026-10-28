import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { COST_CATEGORIES } from "./categories";

/**
 * Claude reads what the rules cannot: a cryptic invoice line ("PER.CL33X24
 * VAP") becomes a category, a product and a size; a product becomes a search
 * of the web for what it costs elsewhere. Off without ANTHROPIC_API_KEY: the
 * rules still classify, nothing is searched.
 */
const MODEL = "claude-opus-5-5";

export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

let client: Anthropic | null = null;
function anthropic() {
  client ??= new Anthropic();
  return client;
}

export type LineToClassify = {
  id: string;
  supplier: string;
  description: string;
  code: string | null;
  unit: string | null;
  unitPrice: number | null;
};

export type ClassifiedLine = {
  id: string;
  category: string;
  productKey: string;
  productLabel: string;
  baseUnit: "kg" | "l" | "pz" | "kwh" | "smc" | null;
  unitsPerItem: number | null;
};

const CATEGORY_KEYS = COST_CATEGORIES.map((category) => category.key).filter((key) => key !== "da_classificare");

const CLASSIFY_SYSTEM = `Classifichi righe di fatture di fornitori di bar, ristoranti e piccole aziende italiane.

Per ogni riga restituisci:
- category: una di ${CATEGORY_KEYS.map((key) => `"${key}"`).join(", ")}. "caffe" è solo caffè, tè, orzo e simili; i liquori al caffè sono "alcolici". Spese di trasporto, imballi, contributi CONAI e sconti vanno nella categoria della merce della fattura se è chiara, altrimenti "trasporti" o "altro".
- productKey: identità del prodotto indipendente dal fornitore, minuscolo con trattini, nella forma marca-prodotto-formato ("peroni-nastro-azzurro-33cl", "lavazza-crema-aroma-grani-1kg", "latte-intero-uht-1l"). Due fornitori che vendono lo stesso prodotto devono dare la stessa chiave. Per servizi e utenze usa la voce ("energia-elettrica", "canone-pos").
- productLabel: nome leggibile e breve in italiano ("Peroni Nastro Azzurro 33 cl").
- baseUnit: "l" per i liquidi, "kg" per i solidi venduti a peso o confezioni con peso, "pz" per pezzi, "kwh" ed "smc" per luce e gas, "none" per servizi.
- unitsPerItem: quante unità base contiene UNA unità fatturata (unità di misura della riga). Esempio: "PERONI CL33 X24" fatturato a CT = 7.92 (24 × 0,33 l); fatturato a PZ = 0.33. Usa 0 se non si capisce.

Non inventare: se la riga è illeggibile usa category "altro", productKey dalla descrizione, baseUnit "none", unitsPerItem 0.`;

const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          category: { type: "string", enum: CATEGORY_KEYS },
          productKey: { type: "string" },
          productLabel: { type: "string" },
          baseUnit: { type: "string", enum: ["kg", "l", "pz", "kwh", "smc", "none"] },
          unitsPerItem: { type: "number" },
        },
        required: ["id", "category", "productKey", "productLabel", "baseUnit", "unitsPerItem"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

function answerText(content: Anthropic.Beta.BetaContentBlock[]) {
  // The last text block holds the answer; earlier ones are notes between searches.
  const texts = content.filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text");
  return texts.at(-1)?.text.trim() ?? "";
}

/** Up to 60 lines per request; returns what Claude could classify. */
export async function classifyLines(lines: LineToClassify[]): Promise<ClassifiedLine[]> {
  if (!aiEnabled() || !lines.length) return [];
  const results: ClassifiedLine[] = [];

  for (let start = 0; start < lines.length; start += 60) {
    const batch = lines.slice(start, start + 60);
    const response = await anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: CLASSIFY_SYSTEM,
      output_config: { effort: "low", format: { type: "json_schema", schema: CLASSIFY_SCHEMA } },
      messages: [
        {
          role: "user",
          content: JSON.stringify(
            batch.map((line) => ({
              id: line.id,
              fornitore: line.supplier,
              descrizione: line.description,
              codice: line.code,
              unita: line.unit,
              prezzo_unitario: line.unitPrice,
            })),
          ),
        },
      ],
    });
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") continue;

    try {
      const parsed = JSON.parse(answerText(response.content)) as {
        items: Array<Omit<ClassifiedLine, "baseUnit" | "unitsPerItem"> & { baseUnit: string; unitsPerItem: number }>;
      };
      for (const item of parsed.items) {
        results.push({
          id: item.id,
          category: item.category,
          productKey: item.productKey.slice(0, 80),
          productLabel: item.productLabel.slice(0, 120),
          baseUnit: item.baseUnit === "none" ? null : (item.baseUnit as ClassifiedLine["baseUnit"]),
          unitsPerItem: item.unitsPerItem > 0 ? item.unitsPerItem : null,
        });
      }
    } catch (error) {
      console.error("[costs] classification answer not readable", error);
    }
  }

  return results;
}

export type PriceOffer = {
  title: string;
  seller: string;
  url: string;
  price: number;
  /** Price per base unit (€/l, €/kg, €/pz), comparable with ours. */
  unitPrice: number;
  conditions: string;
  sameProduct: boolean;
};

const SEARCH_SCHEMA = {
  type: "object",
  properties: {
    offers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          seller: { type: "string" },
          url: { type: "string" },
          price: { type: "number" },
          unitPrice: { type: "number" },
          conditions: { type: "string" },
          sameProduct: { type: "boolean" },
        },
        required: ["title", "seller", "url", "price", "unitPrice", "conditions", "sameProduct"],
        additionalProperties: false,
      },
    },
    summary: { type: "string" },
  },
  required: ["offers", "summary"],
  additionalProperties: false,
};

/**
 * Where the same product is sold for less, found on the web: wholesalers and
 * shops that sell to venues in Italy. Every offer carries its link, so the
 * owner sees for themselves whether it really is the same thing.
 */
export async function searchOnlinePrices(input: {
  productLabel: string;
  baseUnit: string | null;
  ourUnitPrice: number | null;
  examples: string[];
  city: string | null;
}): Promise<{ offers: PriceOffer[]; summary: string } | null> {
  if (!aiEnabled()) return null;
  const unit = input.baseUnit ?? "pz";
  const prompt = `Prodotto comprato da un locale in Italia: "${input.productLabel}".
Come appare sulle sue fatture: ${input.examples.map((text) => `"${text}"`).join("; ")}.
${input.ourUnitPrice ? `Lo paga ${input.ourUnitPrice.toFixed(3)} € per ${unit}, IVA esclusa.` : ""}

Cerca sul web prezzi attuali dello STESSO prodotto (stessa marca, stesso formato) da venditori che riforniscono bar e ristoranti in Italia: ingrossi online, cash & carry (Metro, Sogegross...), siti di bevande per locali, Amazon Business. Restituisci fino a 5 offerte reali con il link della pagina.
- price: il prezzo della confezione mostrata, IVA esclusa (se la pagina lo dà IVA inclusa, scorporala e dillo in conditions).
- unitPrice: il prezzo per ${unit}, IVA esclusa, calcolato dalla confezione.
- conditions: cosa cambia rispetto a un fornitore che consegna (ritiro in negozio, ordine minimo, spedizione, quantità).
- sameProduct: false se è un prodotto simile ma non identico.
Non inventare offerte né link: se non trovi niente restituisci una lista vuota. summary: una o due frasi in italiano su cosa hai trovato.`;

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt }];
  for (let round = 0; round < 3; round += 1) {
    const response = await anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      tools: [
        {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: 6,
          user_location: { type: "approximate", country: "IT", ...(input.city ? { city: input.city } : {}) },
        },
      ],
      output_config: { effort: "medium", format: { type: "json_schema", schema: SEARCH_SCHEMA } },
      messages,
    });

    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    if (response.stop_reason === "refusal") return null;

    try {
      const parsed = JSON.parse(answerText(response.content)) as { offers: PriceOffer[]; summary: string };
      return {
        offers: parsed.offers.filter((offer) => /^https?:\/\//.test(offer.url) && offer.unitPrice > 0).slice(0, 5),
        summary: parsed.summary,
      };
    } catch (error) {
      console.error("[costs] price search answer not readable", error);
      return null;
    }
  }
  return null;
}

/**
 * Business electricity offers, compared on the one part a supplier sets: the
 * price of the energy itself. Transport, system charges and excise are the
 * same whoever sells it.
 */
export async function searchEnergyOffers(input: {
  componentUnitCost: number;
  kwhPerMonth: number;
  city: string | null;
}): Promise<{ offers: PriceOffer[]; summary: string } | null> {
  return searchOnlinePrices({
    productLabel: "Energia elettrica per attività commerciale (partita IVA, bassa tensione, altri usi)",
    baseUnit: "kwh",
    ourUnitPrice: input.componentUnitCost,
    examples: [
      `consumo di circa ${Math.round(input.kwhPerMonth)} kWh al mese`,
      "confronta solo il prezzo della componente energia (fisso o PUN + spread stimato sul PUN attuale), senza trasporto, oneri e accise",
      "fonti utili: Portale Offerte ARERA (ilportaleofferte.it) e i siti dei fornitori",
    ],
    city: input.city,
  });
}
