/**
 * What the app says after something was saved, by the code an action puts in
 * the address (?success=task-created). One list for the whole app, shown as
 * the toast above the bottom bar: before, each page wrote its own line at the
 * top, where nobody scrolled down a long page saw it, and several codes were
 * shown nowhere at all.
 */
export const FLASH_MESSAGES: Record<string, string> = {
  "availability-created": "Indisponibilità salvata.",
  "bar-deleted": "Locale eliminato.",
  "board-created": "Avviso pubblicato.",
  "board-deleted": "Avviso eliminato.",
  "board-read": "Segnato come letto.",
  "board-updated": "Avviso aggiornato.",
  "closure-created": "Chiusura salvata.",
  "closure-deleted": "Chiusura eliminata.",
  "closure-updated": "Chiusura aggiornata.",
  "course-created": "Corso salvato.",
  "destinatario": "Destinatario salvato.",
  "employee-created": "Persona aggiunta. Le credenziali sono partite per email.",
  "employee-linked": "Persona collegata a questo locale: aveva già un account.",
  "employee-removed": "Persona tolta da questo locale.",
  "request-created": "Richiesta inviata.",
  "request-reviewed": "Richiesta gestita.",
  "shift-change-created": "Cambio turno richiesto.",
  "task-completed": "Nota completata.",
  "task-created": "Nota salvata.",
  "timelog-created": "Timbratura manuale salvata.",
};
