import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { aiEnabled } from "./ai";
import { MARKET_INDEXES, type MarketIndex } from "./market";

/**
 * Last month's market values, looked up on the web from each index's own
 * source and saved as "proposed": they count only once a super admin has
 * looked and confirmed them in the console. A value without the page it was
 * read on is not kept.
 */

const MODEL = process.env.COSTS_AI_MODEL?.trim() || "claude-haiku-5-5";
let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

const SCHEMA = {
  type: "object",
  properties: {
    found: { type: "boolean" },
    value: { type: "number" },
    url: { type: "string" },
    note: { type: "string" },
  },
  required: ["found", "value", "url", "note"],
  additionalProperties: false,
};

function monthName(month: string) {
  return new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}

/** One index, one month: the value as the source gives it, and where. */
export async function searchMarketValue(index: MarketIndex, month: string, previousValue: number | null) {
  const prompt = `Cerca sul web il valore di "${index.label}" per il mese di ${monthName(month)}, in ${index.unit}.
Fonte da usare: ${index.source} (${index.sourceUrl}). Dove si trova: ${index.hint}
${previousValue ? `Il mese prima valeva ${previousValue} ${index.unit}: usa la stessa voce e la stessa unità, così il confronto regge.` : ""}
Se la fonte dà una forchetta (minimo - massimo) usa il valore medio. Se la fonte indicata non lo pubblica ancora, puoi usare una fonte ufficiale equivalente e dirlo nella nota.
Scrivi il valore trovato, il link completo della pagina o del PDF dove l'hai letto e una nota di una riga su cosa hai letto. Non stimare e non inventare: se non lo trovi, dillo.`;

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt }];
  const notes: string[] = [];
  const seen = new Set<string>();
  for (let round = 0; round < 3; round += 1) {
    const response = await anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 6000,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5, user_location: { type: "approximate", country: "IT" } }],
      messages,
    });
    if (response.stop_reason === "refusal") return null;
    for (const block of response.content) {
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const result of block.content) if (result.type === "web_search_result") seen.add(result.url);
      }
      if (block.type === "text") {
        notes.push(block.text);
        for (const citation of block.citations ?? []) if (citation.type === "web_search_result_location") seen.add(citation.url);
      }
    }
    if (response.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: response.content });
  }
  const text = notes.join("\n").trim();
  if (!text) return null;

  const structured = await anthropic().beta.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system: "Trasformi in JSON il valore descritto nel testo, senza aggiungere niente. found=false se il testo dice che non l'ha trovato.",
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: `${prompt}\n\nRisultato della ricerca:\n${text}\n\nLink aperti:\n${[...seen].join("\n")}` }],
  });
  const block = structured.content.find((item): item is Anthropic.Beta.BetaTextBlock => item.type === "text");
  try {
    const parsed = JSON.parse(block?.text ?? "") as { found: boolean; value: number; url: string; note: string };
    if (!parsed.found || !(parsed.value > 0) || !/^https?:\/\//.test(parsed.url)) return null;
    // Only a page the search actually opened.
    const opened = [...seen].some((url) => {
      try {
        return new URL(url).host === new URL(parsed.url).host;
      } catch {
        return false;
      }
    });
    if (!opened) return null;
    // A value ten times off the month before is a misread unit, not a market.
    if (previousValue && (parsed.value > previousValue * 3 || parsed.value < previousValue / 3)) return null;
    return { value: parsed.value, url: parsed.url, note: parsed.note.slice(0, 300) };
  } catch {
    return null;
  }
}

/** Every index still without a value for the month: searched and proposed. */
export async function proposeMarketValues(month: string, keys?: string[]) {
  if (!aiEnabled()) return { proposed: 0, missing: 0 };
  const existing = await prisma.marketPrice.findMany({ where: { barId: null, month }, select: { indexKey: true } });
  const done = new Set(existing.map((row) => row.indexKey));
  const [year, mon] = month.split("-").map(Number);
  const before = `${new Date(Date.UTC(year, mon - 2, 1)).getUTCFullYear()}-${String(new Date(Date.UTC(year, mon - 2, 1)).getUTCMonth() + 1).padStart(2, "0")}`;
  let proposed = 0;
  let missing = 0;
  for (const index of MARKET_INDEXES) {
    if (done.has(index.key) || (keys && !keys.includes(index.key))) continue;
    const previous = await prisma.marketPrice.findFirst({ where: { barId: null, indexKey: index.key, month: before, status: "confirmed" }, select: { value: true } });
    const found = await searchMarketValue(index, month, previous?.value ?? null).catch((error) => {
      console.error("[market] search failed", index.key, error instanceof Error ? error.message : error);
      return null;
    });
    if (!found) {
      missing += 1;
      continue;
    }
    await prisma.marketPrice.create({ data: { indexKey: index.key, month, value: found.value, status: "proposed", foundUrl: found.url, note: found.note } });
    proposed += 1;
  }
  return { proposed, missing };
}
