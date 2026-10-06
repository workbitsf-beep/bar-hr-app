"use client";

import { useState } from "react";

/**
 * Il modulo per aprire un locale.
 *
 * Cinque campi, non dodici. Indirizzo, numero di persone, orari e GPS si
 * chiedono dopo, nell'onboarding, quando la persona e gia dentro e ha visto
 * che l'app esiste: un modulo lungo davanti alla porta e un modulo che si
 * abbandona a meta.
 */
export function SignupForm() {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setState("sending");

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });

      const payload = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !payload.ok) {
        setError(payload.message ?? "Non ha funzionato. Riprova.");
        setState("idle");
        return;
      }

      setState("done");
    } catch {
      setError("Connessione non riuscita. Controlla la rete e riprova.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="wb-signup__done">
        <span className="wb-signup__tick" aria-hidden="true">
          ✓
        </span>
        <h2>Il tuo locale è pronto.</h2>
        <p>
          Ti abbiamo mandato un&apos;email con la password per entrare la prima volta. Se non la
          vedi entro qualche minuto, guarda nella posta indesiderata.
        </p>
        <a className="wb-signup__go" href="/login">
          Vai all&apos;accesso
        </a>
      </div>
    );
  }

  return (
    <form className="wb-signup__form" onSubmit={handleSubmit} noValidate>
      <div className="wb-signup__pair">
        <label>
          <span>Nome</span>
          <input name="firstName" autoComplete="given-name" required maxLength={80} />
        </label>
        <label>
          <span>Cognome</span>
          <input name="lastName" autoComplete="family-name" required maxLength={80} />
        </label>
      </div>

      <label>
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required maxLength={160} />
        <small>Qui ti arriva la password per entrare, quindi dev&apos;essere quella vera.</small>
      </label>

      <label>
        <span>Come si chiama il locale</span>
        <input name="barName" required maxLength={140} />
      </label>

      <fieldset className="wb-signup__kind">
        <legend>Che cosa gestisci</legend>
        <label>
          <input type="radio" name="activityType" value="RESTAURANT" defaultChecked />
          <span>Bar, ristorante, locale</span>
        </label>
        <label>
          <input type="radio" name="activityType" value="COMPANY" />
          <span>Azienda o ufficio</span>
        </label>
      </fieldset>

      {/* Invisibile a una persona, irresistibile per un riempitore automatico. */}
      <input
        name="companyWebsite"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="wb-signup__trap"
      />

      {error ? (
        <p className="wb-signup__error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Un attimo…" : "Apri il locale"}
      </button>

      <p className="wb-signup__fine">
        Trenta giorni gratis. Alla scadenza l&apos;abbonamento parte da solo a 29,99 € al mese: ti
        avvisiamo tre giorni prima, e puoi disdire quando vuoi dalle impostazioni.
      </p>
    </form>
  );
}
