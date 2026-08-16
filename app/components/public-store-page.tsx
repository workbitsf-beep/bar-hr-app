import type { LegalDocumentType } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { getLatestPublicLegalDocument } from "@/lib/public-legal";
import styles from "./public-store-page.module.css";

function PublicHeader() {
  return (
    <header className={styles.header}>
      <Link href="/login" className={styles.brand}>
        <Image src="/logo.png" alt="Workbit" width={42} height={42} priority />
        <span>Workbit</span>
      </Link>
      <nav className={styles.nav} aria-label="Informazioni Workbit">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Termini</Link>
        <Link href="/support">Supporto</Link>
      </nav>
    </header>
  );
}

function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <span>Workbit</span>
      <Link href="/privacy">Privacy</Link>
      <Link href="/terms">Termini</Link>
      <Link href="/account-deletion">Eliminazione account</Link>
      <Link href="/support">Supporto</Link>
    </footer>
  );
}

export async function PublicLegalPage({
  type,
  fallbackTitle,
  fallbackMessage,
  children,
}: {
  type: LegalDocumentType;
  fallbackTitle: string;
  fallbackMessage: string;
  children?: ReactNode;
}) {
  const document = await getLatestPublicLegalDocument(type);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <PublicHeader />
        <article className={styles.card}>
          <p className={styles.eyebrow}>Workbit</p>
          <h1>{document?.title || fallbackTitle}</h1>
          {document ? (
            <p className={styles.meta}>
              Versione {document.version}.{document.revision} · Aggiornata il{" "}
              {document.updatedAt.toLocaleDateString("it-IT")}
            </p>
          ) : null}
          <div className={styles.content}>
            {document?.content ? (
              document.content
            ) : (
              <div className={styles.empty}>{fallbackMessage}</div>
            )}
            {children}
          </div>
          {document?.fileContent ? (
            <div className={styles.actions}>
              <Link
                className={`${styles.button} ${styles.buttonPrimary}`}
                href={`/api/public/legal-documents/${document.type}`}
                target="_blank"
                rel="noreferrer"
              >
                Apri documento completo
              </Link>
            </div>
          ) : null}
        </article>
        <PublicFooter />
      </div>
    </main>
  );
}

export function PublicInformationPage({
  eyebrow = "Workbit",
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <PublicHeader />
        <article className={styles.card}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1>{title}</h1>
          <div className={styles.content}>{children}</div>
        </article>
        <PublicFooter />
      </div>
    </main>
  );
}

export { styles as publicStorePageStyles };
