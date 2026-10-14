/**
 * A stamp made on the phone without network (see app/dashboard/offline-clock.tsx
 * and capacitor-web/index.html): it carries the moment the person pressed the
 * button, and is sent when the network comes back.
 *
 * The position was checked on the phone and is checked again on the server,
 * as for any stamp. The time is the phone's, so it is held to a window: not in
 * the future, and no older than OFFLINE_MAX_HOURS. Beyond that the person uses
 * "Entrata/Uscita dimenticata", which the owner approves.
 */

export const OFFLINE_MAX_HOURS = 12;
const FUTURE_TOLERANCE_MS = 2 * 60 * 1000;

export type ClockMoment = { at: Date; offline: boolean } | { error: string };

export function clockMomentOf(offlineAt: unknown, now = new Date()): ClockMoment {
  if (offlineAt === undefined || offlineAt === null || offlineAt === "") {
    return { at: now, offline: false };
  }
  const at = new Date(typeof offlineAt === "number" ? offlineAt : String(offlineAt));
  if (Number.isNaN(at.getTime())) {
    return { error: "Ora della timbratura senza rete non valida." };
  }
  if (at.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    return { error: "L'ora del telefono è avanti: controlla data e ora nelle impostazioni del telefono." };
  }
  if (now.getTime() - at.getTime() > OFFLINE_MAX_HOURS * 60 * 60 * 1000) {
    return {
      error: `La timbratura senza rete è più vecchia di ${OFFLINE_MAX_HOURS} ore: segnalala come dimenticata nella pagina Oggi.`,
    };
  }
  // A few seconds late is just the network: not marked.
  return { at, offline: now.getTime() - at.getTime() > 60 * 1000 };
}
