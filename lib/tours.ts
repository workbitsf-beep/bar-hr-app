/**
 * The guide that shows the app while it is used: the first time a page is
 * opened, the screen dims, one thing lights up and a bubble says what it does
 * ("Tocca qui per...", "Scorri a destra per..."). One short tour per page,
 * one for the owner and one for the others, each seen once.
 *
 * A step points at what is already on the page (an aria-label, a class, the
 * data-swipe a swiping row carries, the data-card of a card), so the pages
 * are barely touched; a step whose thing is not there (a feature off, an
 * empty list, a row the person may not delete) is skipped.
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

const nav = (href: string) => `.dashboard-bottom-nav a[href="${href}"], .wb-desk-only a[href="${href}"], aside a[href="${href}"]`;
const card = (title: string) => `[data-card="${title}"]`;
/** A row that opens to both sides, or to the left only (lib: swipe-reveal-action). */
const swipeBoth = (scope = "") => `${scope} [data-swipe="both"]`.trim();
const swipeLeft = (scope = "") => `${scope} [data-swipe="left"]`.trim();

const SWIPE_DELETE = "Fai scorrere la riga verso sinistra e tocca il cestino. Se non lo tocchi, la riga torna a posto da sola.";

const TOURS: Record<string, Partial<Record<TourProfile, TourStep[]>>> = {
  "/dashboard": {
    owner: [
      {
        target: nav("/dashboard/calendar"),
        title: "Qui fai i turni",
        body: "Tocca Turni per creare la settimana: chi è in turno lo vede sul telefono e riceve un avviso.",
        gesture: "tap",
      },
      {
        target: `${swipeBoth()}:has(.wbtc-swipe--time)`,
        title: "Chi lavora oggi",
        body: "Scorri una persona verso destra per cambiarle l'orario di oggi, verso sinistra per toglierla dal turno.",
        gesture: "swipe-right",
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
        target: '[aria-label="Scorri il contenitore per cambiare locale"]',
        title: "Più locali",
        body: "Scorri il logo a destra o a sinistra per passare da un locale all'altro.",
        gesture: "swipe-left",
      },
      {
        target: ".dashboard-menu-button",
        title: "Tutto il resto",
        body: "Dal menu trovi persone, presenze per il consulente, documenti, costi e impostazioni.",
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
        target: ".workbit-cart-trigger",
        title: "Manca qualcosa?",
        body: "Aggiungilo alla lista della spesa: il titolare la trova pronta quando fa l'ordine.",
        gesture: "tap",
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
      {
        target: ".dashboard-menu-button",
        title: "Il resto è nel menu",
        body: "Le tue ore, i documenti, i corsi e le impostazioni.",
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
        target: swipeBoth(),
        title: "Scorri a destra per modificare",
        body: "Fai scorrere un turno verso destra e tocca la matita: cambi orario o persona.",
        gesture: "swipe-right",
      },
      {
        target: swipeBoth(),
        title: "Scorri a sinistra per eliminare",
        body: "Verso sinistra compare il cestino: toccalo e il turno sparisce. Se non lo tocchi, torna a posto da solo.",
        gesture: "swipe-left",
      },
    ],
    staff: [
      {
        target: "[data-day-date]",
        title: "I tuoi turni",
        body: "Ogni giorno con i tuoi orari. Tocca un giorno per vedere i dettagli e chi lavora con te.",
        gesture: "tap",
      },
      {
        target: swipeBoth(),
        title: "Scorri un turno",
        body: "Verso destra lo modifichi, verso sinistra lo elimini.",
        gesture: "swipe-right",
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
        target: swipeLeft(".wb-mix-rows"),
        title: "Scorri a sinistra per eliminarla",
        body: SWIPE_DELETE,
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
      {
        target: swipeLeft(".wb-mix-rows"),
        title: "Scorri a sinistra per eliminarla",
        body: SWIPE_DELETE,
        gesture: "swipe-left",
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
      {
        target: ".dashboard-list-button",
        title: "Approva o rifiuta",
        body: "Tocca una richiesta per vederla e rispondere: la persona riceve subito la risposta.",
        gesture: "tap",
      },
      {
        target: swipeBoth(),
        title: "Le chiusure",
        body: "Scorri una chiusura verso destra per cambiarla, verso sinistra per eliminarla.",
        gesture: "swipe-right",
      },
      {
        target: swipeLeft(),
        title: "Scorri a sinistra per eliminare",
        body: SWIPE_DELETE,
        gesture: "swipe-left",
      },
    ],
    staff: [
      {
        target: '[aria-label="Aggiungi"]',
        title: "Chiedi ferie o permessi",
        body: "Tocca + e scegli: ferie, permesso, cambio turno o un giorno in cui non puoi.",
        gesture: "tap",
      },
      {
        target: swipeLeft(),
        title: "Hai cambiato idea?",
        body: "Scorri la richiesta verso sinistra e tocca il cestino per ritirarla.",
        gesture: "swipe-left",
      },
    ],
  },
  "/dashboard/documents": {
    owner: [
      {
        target: '[aria-label="Carica documento"]',
        title: "Carica un documento",
        body: "Buste paga, contratti, regolamenti: tocca + e scegli a chi va. La persona riceve l'avviso e lo trova qui.",
        gesture: "tap",
      },
      {
        target: swipeLeft(),
        title: "Scorri a sinistra per eliminarlo",
        body: SWIPE_DELETE,
        gesture: "swipe-left",
      },
    ],
    staff: [
      {
        target: `${card("I tuoi documenti")}, ${card("Documenti")}`,
        title: "I tuoi documenti",
        body: "Buste paga e documenti che il locale ti manda. Tocca per aprirli, e se serve confermi di averli letti.",
      },
    ],
  },
  "/dashboard/courses": {
    owner: [
      {
        target: '[aria-label="Programma un corso"]',
        title: "I corsi del personale",
        body: "HACCP, sicurezza, antincendio: tocca + per programmarne uno. Workbit ti avvisa quando gli attestati scadono.",
        gesture: "tap",
      },
    ],
    staff: [
      {
        target: card("I tuoi attestati"),
        title: "I tuoi attestati",
        body: "I corsi che hai fatto e quando scadono. Ti avvisiamo prima che serva rifarli.",
      },
    ],
  },
  "/dashboard/presenze": {
    owner: [
      {
        target: '[data-tour="month"]',
        title: "Scegli il mese",
        body: "Con le frecce passi al mese prima o dopo; tocca il nome per saltare a un mese.",
        gesture: "tap",
      },
      {
        target: card("Da sistemare oggi"),
        title: "Da sistemare",
        body: "Chi ha dimenticato di timbrare o è uscito fuori orario: tocca per correggere.",
        gesture: "tap",
      },
      {
        target: '[data-tour="send"] > *',
        title: "Al consulente in un tocco",
        body: "A fine mese mandi il file delle presenze al consulente, già nel suo formato.",
        gesture: "tap",
      },
      {
        target: '[aria-label="Impostazioni delle presenze"]',
        title: "Impostazioni",
        body: "Il consulente, il formato del file, arrotondamenti e straordinari.",
        gesture: "tap",
      },
    ],
    staff: [
      {
        target: '[data-tour="month"]',
        title: "Le tue ore",
        body: "Qui vedi le tue ore giorno per giorno. Con le frecce cambi mese.",
        gesture: "tap",
      },
    ],
  },
  "/dashboard/people": {
    owner: [
      {
        target: '[aria-label="Aggiungi una persona"], [aria-label="Aggiungi persona"]',
        title: "Aggiungi una persona",
        body: "Nome, cognome ed email: riceve una mail con la password e scarica l'app.",
        gesture: "tap",
      },
      {
        target: 'a[aria-label^="Apri la scheda di"]',
        title: "La scheda della persona",
        body: "Tocca una persona per paga, reparto, permessi, documenti e corsi.",
        gesture: "tap",
      },
    ],
  },
  "/dashboard/costi": {
    owner: [
      {
        target: '[data-tour="upload"] > *',
        title: "Carica le fatture",
        body: "Lo zip del cassetto fiscale o le fatture XML: Workbit legge prodotti e prezzi da solo.",
        gesture: "tap",
      },
      {
        target: card("Dove puoi risparmiare"),
        title: "Dove risparmi",
        body: "Gli stessi prodotti a meno, da altri fornitori della tua zona.",
      },
    ],
  },
  "/dashboard/shopping-list": {
    owner: [
      {
        target: '[aria-label="Aggiungi articolo"]',
        title: "Aggiungi alla lista",
        body: "Tocca + per aggiungere quello che manca, anche con la quantità.",
        gesture: "tap",
      },
    ],
    staff: [
      {
        target: '[aria-label="Aggiungi articolo"]',
        title: "Manca qualcosa?",
        body: "Tocca + e scrivilo: il titolare lo trova nella lista quando fa l'ordine.",
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
