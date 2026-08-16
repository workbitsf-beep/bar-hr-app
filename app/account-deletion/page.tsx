import { LegalDocumentType } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import {
  PublicLegalPage,
  publicStorePageStyles as styles,
} from "@/app/components/public-store-page";
import { getSupportEmail } from "@/lib/public-legal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eliminazione account | Workbit",
  description: "Come richiedere l’eliminazione di un account Workbit e dei dati associati.",
};

export default function AccountDeletionPage() {
  const supportEmail = getSupportEmail();

  return (
    <PublicLegalPage
      type={LegalDocumentType.ACCOUNT_DELETION}
      fallbackTitle="Eliminazione account"
      fallbackMessage="Puoi avviare l’eliminazione dalle impostazioni dell’app oppure contattare il supporto Workbit."
    >
      <p>
        Per avviare la procedura accedi a Workbit, apri <strong>Altro</strong>, quindi{" "}
        <strong>Impostazioni</strong> e seleziona l’opzione di eliminazione disponibile per il tuo
        profilo. Ti verrà richiesta una conferma esplicita.
      </p>
      <p>
        Se non riesci ad accedere o l’opzione non è disponibile, scrivi a{" "}
        <a href={`mailto:${supportEmail}`}>{supportEmail}</a> usando l’indirizzo associato al tuo
        account. Il supporto verificherà l’identità prima di procedere.
      </p>
      <div className={styles.actions}>
        <Link className={`${styles.button} ${styles.buttonPrimary}`} href="/login">
          Accedi a Workbit
        </Link>
        <a className={styles.button} href={`mailto:${supportEmail}`}>
          Contatta il supporto
        </a>
      </div>
    </PublicLegalPage>
  );
}
