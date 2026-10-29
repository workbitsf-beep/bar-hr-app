/**
 * The blocks of Oggi. Each person keeps the ones they want, in their order;
 * with nothing saved they get the base, which is Oggi as it always was.
 *
 * The owner and the staff have different blocks: the owner runs the venue,
 * the others work in it (and managers see what they run on top).
 */

export type HomeProfile = "owner" | "staff";

export type HomeBlockKey =
  | "crew"
  | "checklists"
  | "nextWeek"
  | "requests"
  | "team"
  | "costs"
  | "absences"
  | "prices"
  | "staffMonth"
  | "deadlines"
  | "clock"
  | "myHours"
  | "myWeek"
  | "inbox";

export type HomeBlock = { key: HomeBlockKey; emoji: string; label: string; hint: string };

export const HOME_BLOCKS: Record<HomeBlockKey, HomeBlock> = {
  crew: { key: "crew", emoji: "👥", label: "In servizio oggi", hint: "Chi lavora oggi, con i reparti" },
  checklists: { key: "checklists", emoji: "✅", label: "Apertura e chiusura", hint: "Le checklist di oggi" },
  nextWeek: { key: "nextWeek", emoji: "📅", label: "Prossima settimana", hint: "Se tutti i giorni sono coperti" },
  requests: { key: "requests", emoji: "📨", label: "Richieste da approvare", hint: "Ferie, permessi e cambi turno" },
  team: { key: "team", emoji: "📊", label: "Andamento team", hint: "I turni e i numeri della settimana" },
  costs: { key: "costs", emoji: "💶", label: "Analisi costi", hint: "Il resoconto del mese, dalle fatture e dalle ore" },
  absences: { key: "absences", emoji: "📨", label: "Richieste e assenze", hint: "Approvi da qui e vedi chi manca" },
  prices: { key: "prices", emoji: "📈", label: "Prezzi che salgono", hint: "I prodotti che costano di più" },
  staffMonth: { key: "staffMonth", emoji: "⏱", label: "Personale del mese", hint: "Ore, straordinari e paga" },
  deadlines: { key: "deadlines", emoji: "⏰", label: "Scadenze", hint: "Corsi, attestati e note con la data" },
  clock: { key: "clock", emoji: "📍", label: "Timbra", hint: "Entrata e uscita" },
  myHours: { key: "myHours", emoji: "⏱", label: "Le tue ore", hint: "Oggi e nel mese" },
  myWeek: { key: "myWeek", emoji: "📅", label: "La tua settimana", hint: "I tuoi turni" },
  inbox: { key: "inbox", emoji: "📬", label: "Da leggere e da fare", hint: "Note, bacheca, risposte, corsi" },
};

/** The base, in its order: Oggi as it was before it could be changed. */
export const HOME_BASE: Record<HomeProfile, HomeBlockKey[]> = {
  owner: ["crew", "checklists", "nextWeek", "requests", "team"],
  staff: ["clock", "myHours", "myWeek", "inbox", "crew", "checklists", "requests", "team"],
};

/** The widgets each profile can add: things the base does not already show. */
export const HOME_EXTRA: Record<HomeProfile, HomeBlockKey[]> = {
  owner: ["costs", "absences", "prices", "staffMonth", "deadlines"],
  staff: [],
};

/** Two blocks that say the same thing: adding one takes the other off. */
export const HOME_REPLACES: Partial<Record<HomeBlockKey, HomeBlockKey>> = { absences: "requests" };

export function homeChoices(profile: HomeProfile): HomeBlockKey[] {
  return [...HOME_BASE[profile], ...HOME_EXTRA[profile]];
}

/** The saved blocks, cleaned of any that do not belong to this profile; the base when nothing is saved. */
export function resolveHomeBlocks(saved: string[] | null | undefined, profile: HomeProfile): HomeBlockKey[] {
  if (!saved) return HOME_BASE[profile];
  const allowed = new Set<string>(homeChoices(profile));
  return Array.from(new Set(saved.filter((key) => allowed.has(key)))) as HomeBlockKey[];
}
