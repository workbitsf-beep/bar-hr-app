import { LegalDocumentType } from "@prisma/client";
import type { Metadata } from "next";
import { PublicLegalPage } from "@/app/components/public-store-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Termini e condizioni | Workbit",
  description: "Termini e condizioni di utilizzo di Workbit.",
};

export default function TermsPage() {
  return (
    <PublicLegalPage
      type={LegalDocumentType.TERMS_AND_CONDITIONS}
      fallbackTitle="Termini e condizioni"
      fallbackMessage="I termini e le condizioni pubblici sono in fase di aggiornamento. Per informazioni contatta il supporto Workbit."
    />
  );
}
