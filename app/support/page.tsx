import type { Metadata } from "next";
import Link from "next/link";
import {
  PublicInformationPage,
  publicStorePageStyles as styles,
} from "@/app/components/public-store-page";
import { getSupportEmail } from "@/lib/public-legal";

export const metadata: Metadata = {
  title: "Supporto | Workbit",
  description: "Assistenza e contatti per gli utenti Workbit.",
};

export default function SupportPage() {
  const supportEmail = getSupportEmail();

  return (
    <PublicInformationPage eyebrow="Assistenza" title="Supporto Workbit">
      <p>
        Per assistenza su accesso, abbonamento, dati o utilizzo dell’app contatta il supporto
        indicando l’indirizzo del tuo account e il nome dell’attività.
      </p>
      <div className={styles.actions}>
        <a className={`${styles.button} ${styles.buttonPrimary}`} href={`mailto:${supportEmail}`}>
          {supportEmail}
        </a>
        <Link className={styles.button} href="/login">
          Torna all’accesso
        </Link>
      </div>
    </PublicInformationPage>
  );
}
