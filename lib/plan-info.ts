/**
 * What each plan and extra does, in a few lines: the text behind the small
 * "i" next to its name. The lists stay one line per item; the explanation is
 * a tap away instead of a paragraph on every card.
 */

export type PlanInfoKey = "base" | "pro" | "reparti" | "sedi" | "persone5" | "stile" | "custom";

export type PlanInfo = { title: string; text: string; who: string };

export function planInfo(key: PlanInfoKey, company: boolean): PlanInfo {
  switch (key) {
    case "base":
      return company
        ? {
            title: "Base",
            text: "Turni, timbrature, richieste, note e documenti per l'azienda, con la sede principale compresa. Fino a 12 persone, il titolare compreso.",
            who: "Per la piccola azienda con una sede.",
          }
        : {
            title: "Base",
            text: "Turni, timbrature, richieste, note e documenti per il locale. Fino a 12 persone, il titolare compreso.",
            who: "Per il bar o il ristorante che lavora tutto insieme.",
          };
    case "pro":
      return company
        ? {
            title: "Pro",
            text: "Tutto compreso: 3 sedi (la principale inclusa, fino a 6 in tutto), lo stile dell'azienda e fino a 45 persone. Pacchetti da 5 persone e sedi in più si aggiungono.",
            who: "Per l'azienda con molte sedi e tanta gente.",
          }
        : {
            title: "Pro",
            text: "Tutto compreso: reparti, 2 sedi con la stessa insegna, stile del locale e persone senza limite. Altre sedi si aggiungono, fino a 6.",
            who: "Per il ristorante con tanta gente.",
          };
    case "reparti":
      return {
        title: "Reparti",
        text: "Turni, note, checklist e carrello divisi tra banco, cucina e sala, più un reparto col nome che scegli tu. Il Jolly copre tutti i reparti e il responsabile di reparto gestisce quello che gli affidi.",
        who: "Per la pizzeria con forno e sala, o il ristorante con cucina e sala.",
      };
    case "sedi":
      if (!company) {
        return {
          title: "Sedi",
          text: "Un altro locale con la stessa insegna e gli stessi dati fiscali: calendario, reparti, persone e punto di timbratura suoi, e un abbonamento solo. Piano, Reparti e Stile valgono per tutte le sedi, le persone si contano insieme. Fino a 3 in più sul Base, 2 comprese e fino a 6 in tutto con il Pro. Un locale con un altro nome o un'altra partita IVA è un'attività a parte.",
          who: "Per il ristorante o il bar con più punti vendita.",
        };
      }
      return {
        title: "Sedi",
        text: "Ogni sede ha nome, indirizzo e punto di timbratura: si timbra solo nella propria sede. Turni, note, checklist e carrello divisi per sede, con un responsabile per ognuna. La sede principale è l'azienda stessa ed è sempre compresa; le altre si aggiungono una per una: fino a 3 sul Base, fino a 6 in tutto con il Pro.",
        who: "Per l'azienda con più uffici, negozi o magazzini.",
      };
    case "persone5":
      return {
        title: "Persone in più",
        text: company
          ? "Pacchetti da 5 persone, fino a 2: sul Base da 12 a 22 persone, sul Pro da 45 a 55."
          : "Pacchetti da 5 persone, fino a 2: il locale passa da 12 a 22 persone.",
        who: "Per chi cresce ma non ha bisogno del Pro.",
      };
    case "stile":
      return {
        title: "Il tuo stile",
        text: "Il tuo logo in alto al posto di quello di Workbit, e il font dell'insegna scelto tra otto. Compreso nel Pro.",
        who: "Per chi vuole l'app con il nome e lo stile del proprio locale.",
      };
    case "custom":
      return {
        title: "Su misura",
        text: company
          ? "Per chi ha tante sedi o tante persone: prezzo, sedi e persone li decidiamo insieme, con tutto quello che ha il Pro."
          : "Per chi ha tante persone: prezzo e persone li decidiamo insieme, con tutto quello che ha il Pro.",
        who: "Scrivi all'assistenza per parlarne.",
      };
  }
}
