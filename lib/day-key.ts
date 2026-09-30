/**
 * La chiave di un giorno, e come viaggia fino al telefono.
 *
 * Il calendario manda al client una giornata come stringa ISO, e il client
 * ne ricava la chiave prendendo i primi dieci caratteri - `slice(0, 10)` -
 * in una ventina di punti: il popup, il compositore, il controllo su quali
 * giorni accettano turni, la griglia delle settimane.
 *
 * Quel taglio legge la data **in UTC**. Finche il server pensava in UTC
 * andava bene per caso; il 29 settembre 2026 gli abbiamo detto di pensare in
 * Europe/Rome - per un altro bug, l'app che restava indietro di un giorno tra
 * mezzanotte e le due - e da quel momento `setHours(0,0,0,0)` ha prodotto le
 * 22:00Z del giorno prima. Il titolo restava giusto, perche passa da Intl con
 * il fuso di Roma; la chiave tornava indietro di un giorno, e ogni turno
 * inserito finiva sulla giornata precedente a quella aperta.
 *
 * E rimasto invisibile per un giorno intero perche la lettura e raggruppata
 * lato server sull'orario vero: il calendario mostrava tutto al posto giusto,
 * sbagliava solo a scrivere.
 *
 * Quindi la regola sta qui, in due funzioni, con dei test sotto tests/:
 * quello che il client taglia deve essere ancorato a mezzanotte UTC, sempre,
 * qualunque fuso abbia il server.
 */

/** La data come la legge una persona in quel fuso: "2026-10-11". */
export function toDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * La stessa giornata pronta da mandare al client: ancorata a mezzanotte UTC,
 * cosi i primi dieci caratteri sono la giornata giusta e non quella prima.
 */
export function serializeDay(date: Date) {
  return `${toDayKey(date)}T00:00:00.000Z`;
}
