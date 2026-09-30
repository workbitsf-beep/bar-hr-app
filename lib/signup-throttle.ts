/**
 * Il freno sulla registrazione pubblica.
 *
 * Fino a oggi un account nasceva solo se lo apriva il titolare o il super
 * admin: nessuno da fuori poteva crearne. Da adesso la porta e aperta, e una
 * porta aperta va sorvegliata, altrimenti in una notte ti ritrovi mille
 * locali finti creati da uno script.
 *
 * Tre difese, in ordine di quanto costano:
 *
 * 1. Il campo trappola. Il modulo ne ha uno invisibile che una persona non
 *    vede e non compila mai. I riempitori automatici invece riempiono tutto:
 *    se arriva pieno, la richiesta e finta.
 * 2. Questo freno, che conta le richieste per indirizzo.
 * 3. E la piu forte, che non e codice: la password arriva solo per email.
 *    Con un indirizzo inventato l'account nasce e resta inutilizzabile,
 *    perche nessuno sa come entrarci.
 *
 * I conteggi stanno in memoria, quindi si azzerano a ogni riavvio e non sono
 * condivisi fra istanze. Per fermare uno script va benissimo; per fermare un
 * attacco vero servirebbe altro, ma con nove locali non e il problema di
 * oggi - e quando lo sara, si cambia solo questo file.
 */

type Bucket = { count: number; resetAt: number };

const attempts = new Map<string, Bucket>();

/** Un'ora, e tre locali. Chi ne apre di piu non sta aprendo un locale. */
const WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 3;

export function checkSignupThrottle(key: string) {
  const now = Date.now();
  const bucket = attempts.get(key);

  if (!bucket || bucket.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Chiamato a ogni tentativo: tiene la mappa dalla dimensione di una mappa. */
export function forgetExpiredSignupAttempts() {
  const now = Date.now();

  for (const [key, bucket] of attempts.entries()) {
    if (bucket.resetAt <= now) {
      attempts.delete(key);
    }
  }
}

/** L'indirizzo di chi chiede, dietro il proxy di Railway. */
export function callerKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");

  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "sconosciuto";
}
