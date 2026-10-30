/**
 * The guide that shows the app while it is used: the first time a page is
 * opened, the screen dims, one thing lights up and a bubble says what it does
 * ("Tocca qui per...", "Scorri a destra per..."). One short tour per page,
 * one for the owner and one for the others, each seen once.
 *
 * A step points at what is already on the page (an aria-label, a class), so
 * the pages are not touched; a step whose thing is not there (a feature off,
 * an empty week) is skipped.
 */

export type TourProfile = "owner" | "staff";
export type TourGesture = "tap" | "swipe-right" | "swipe-left";

export type TourStep = {
  /** Several selectors, comma separated: the first one visible wins. */
  target: string;
  title: string;
  body: string;
  gesture?: TourGesture;
};

export type Tour = { key: string; steps: TourStep[] };

/** Venues where the guide is on while it is being tried. */
export const TOUR_PILOT_BARS = new Set(["f139252b-b2f5-4e99-8e5e-bfe05ba70598"]);

const nav = (href: string) => `.dashboard-bottom-nav a[href="${href}"], .wb-desk-only a[href="${href}"], aside a[href="${href}"]`;

const TOURS: Record<string, Record<TourProfile, TourStep[]>> = {
  "/dashboard": {
    owner: [
      {
        target: nav("/dashboard/calendar"),
        title: "Qui fai i turni",
        body: "Tocca Turni per creare la settimana: chi è in turno lo vede sul telefono e riceve un avviso.",
        gesture: "tap",
      },
      {
        target: nav("/dashboard/tasks"),
        title: "Note e avvisi",
        body: "Le cose da fare e gli avvisi per il personale. Arrivano a chi devono arrivare, e vedi chi le ha fatte.",
        gesture: "tap",
      },
      {
        target: nav("/dashboard/requests"),
        title: "Ferie e permessi",
        body: "Le richieste del personale arrivano qui: approvi o rifiuti con un tocco.",
        gesture: "tap",
      },
      {
        target: '[aria-label="Personalizza Oggi"]',
        title: "Oggi come vuoi tu",
        body: "Tocca qui per scegliere cosa vedere su Oggi: chi lavora, le richieste, i costi, le scadenze.",
        gesture: "tap",
      },
      {
        target: ".workbit-cart-trigger",
        title: "La lista della spesa",
        body: "Chi vede che manca qualcosa lo aggiunge qui. Tu la trovi pronta quando vai a fare l'ordine.",
        gesture: "tap",
      },
      {
        target: ".dashboard-menu-button",
        title: "Tutto il resto",
        body: "Dal menu trovi persone, presenze per il consulente, documenti e impostazioni.",
        gesture: "tap",
      },
    ],
    staff: [
      {
        target: '[aria-label="Entrata e uscita"]',
        title: "Quando arrivi, timbra qui",
        body: "Tocca Timbra entrata quando inizi: Workbit controlla che sei nel locale e segna l'ora. Quando vai via, qui trovi Timbra uscita.",
        gesture: "tap",
      },
      {
        target: ".workbit-week",
        title: "La tua settimana",
        body: "I tuoi turni dei prossimi giorni. Quando il titolare li cambia ti arriva un avviso.",
      },
      {
        target: nav("/dashboard/requests"),
        title: "Ferie e permessi",
        body: "Da qui chiedi ferie, un permesso o un cambio turno. La risposta ti arriva sul telefono.",
        gesture: "tap",
      },
      {
        target: nav("/dashboard/tasks"),
        title: "Le note",
        body: "Le cose da fare e gli avvisi del locale. Quando ne finisci una la segni come fatta.",
        gesture: "tap",
      },
    ],
  },
  "/dashboard/calendar": {
    owner: [
      {
        target: '[data-tour="copy-week"]',
        title: "Una settimana in un tocco",
        body: "Copia i turni della settimana scorsa e poi cambi solo quello che serve.",
        gesture: "tap",
      },
      {
        target: '[aria-label="Aggiungi turno"]',
        title: "Aggiungi un turno",
        body: "Tocca il + per creare un turno: orario, persona e reparto.",
        gesture: "tap",
      },
      {
        target: "div:has(> .workbit-swipe-action-leading)",
        title: "Scorri un turno",
        body: "Verso destra lo modifichi, verso sinistra lo elimini.",
        gesture: "swipe-right",
      },
    ],
    staff: [
      {
        target: "[data-day-date]",
        title: "I tuoi turni",
        body: "Ogni giorno con i tuoi orari. Tocca un giorno per vedere i dettagli e chi lavora con te.",
        gesture: "tap",
      },
    ],
  },
  "/dashboard/tasks": {
    owner: [
      {
        target: '[aria-label="Aggiungi nota"]',
        title: "Scrivi una nota",
        body: "Tocca + per una cosa da fare, un avviso o un controllo che torna da solo (es. ogni 6 mesi).",
        gesture: "tap",
      },
      {
        target: '[aria-label="Tipi di nota"]',
        title: "Da fare, avvisi, controlli",
        body: "Qui passi da un tipo di nota all'altro.",
        gesture: "tap",
      },
      {
        target: '[aria-label="Segna come fatta"]',
        title: "Fatta",
        body: "Tocca la spunta quando una nota è fatta: chi l'ha scritta riceve l'avviso.",
        gesture: "tap",
      },
      {
        target: ".wb-mix-rows div:has(> .workbit-swipe-action-trailing)",
        title: "Scorri a sinistra per eliminarla",
        body: "Fai scorrere una nota verso sinistra e tocca il cestino.",
        gesture: "swipe-left",
      },
    ],
    staff: [
      {
        target: '[aria-label="Segna come fatta"]',
        title: "Quando l'hai fatta, tocca qui",
        body: "La nota risulta fatta da te e chi l'ha scritta riceve l'avviso.",
        gesture: "tap",
      },
      {
        target: '[aria-label="Tipi di nota"]',
        title: "Da fare e avvisi",
        body: "Qui trovi anche gli avvisi del locale da leggere.",
        gesture: "tap",
      },
      {
        target: '[aria-label="Aggiungi nota"]',
        title: "Un promemoria per te",
        body: "Tocca + per scriverti una cosa da ricordare.",
        gesture: "tap",
      },
    ],
  },
  "/dashboard/requests": {
    owner: [
      {
        target: '[aria-label="Aggiungi"]',
        title: "Aggiungi",
        body: "Una chiusura del locale, le ferie aziendali o un'assenza: tocca + e scegli.",
        gesture: "tap",
      },
    ],
    staff: [
      {
        target: '[aria-label="Aggiungi"]',
        title: "Chiedi ferie o permessi",
        body: "Tocca + e scegli: ferie, permesso, cambio turno o un giorno in cui non puoi.",
        gesture: "tap",
      },
    ],
  },
};

export function tourFor(pathname: string, profile: TourProfile): Tour | null {
  const steps = TOURS[pathname]?.[profile];
  return steps?.length ? { key: `${pathname}:${profile}`, steps } : null;
}

/** Where a seen tour is remembered on this device. */
export const TOUR_SEEN_PREFIX = "wb-tour-seen:";
