import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { BrandMark } from "@/components/brand-mark";
import { SignupForm } from "./signup-form";
import "./signup.css";

export const metadata: Metadata = {
  title: "Apri il tuo locale su Workbit",
  description: "Crea il tuo locale su Workbit e prova trenta giorni gratis.",
  robots: { index: false, follow: false },
};

/**
 * Qui qualcuno che non conosciamo apre il suo locale.
 *
 * Ci arriva dal sito: ogni "Prova gratis" di workbit.it porta qui (trialHref
 * in lib/site.ts di workbit-site). A Google non la facciamo indicizzare: la
 * porta d'ingresso nelle ricerche e il sito, non il modulo.
 */
export default async function RegistrationPage() {
  const session = await getSession();

  // Chi e gia dentro non ha niente da fare qui.
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="wb-signup">
      <header className="wb-signup__bar">
        <a className="wb-signup__brand" href="https://workbit.it" aria-label="Workbit, torna al sito">
          <BrandMark size={38} />
          <span>Workbit</span>
        </a>
        <a className="wb-signup__login" href="/login">
          Accedi
        </a>
      </header>

      <div className="wb-signup__inner">
        <section className="wb-signup__head">
          <span className="wb-signup__kicker">
            <i aria-hidden="true" />
            Trenta giorni gratis
          </span>
          <h1>
            Apri il tuo <span>locale.</span>
          </h1>
          <p>
            Cinque campi e ci sei. Turni, orari e squadra li imposti dopo, dentro l&apos;app, in
            una decina di minuti.
          </p>
          <ul className="wb-signup__perks">
            <li>Pronto in due minuti</li>
            <li>Inviti il team quando vuoi</li>
            <li>Poi 29,99 € al mese, disdici quando vuoi</li>
          </ul>
        </section>

        <div className="wb-signup__side">
          <SignupForm />

          <p className="wb-signup__back">
            Hai già un account? <a href="/login">Entra da qui</a>
          </p>
        </div>
      </div>
    </main>
  );
}
