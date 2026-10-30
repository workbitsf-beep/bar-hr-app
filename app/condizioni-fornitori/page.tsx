import { LegalDocumentType } from "@prisma/client";
import type { Metadata } from "next";
import { PublicLegalPage } from "@/app/components/public-store-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Condizioni per i fornitori | Workbit",
  description: "Le condizioni per i fornitori che pubblicano il proprio listino su Workbit.",
};

export default function SupplierTermsPage() {
  return (
    <PublicLegalPage
      type={LegalDocumentType.SUPPLIER_TERMS}
      fallbackTitle="Condizioni per i fornitori"
      fallbackMessage="Le condizioni per i fornitori sono in fase di pubblicazione. Per informazioni scrivi a supporto@workbit.it."
    />
  );
}
