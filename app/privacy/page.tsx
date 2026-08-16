import { LegalDocumentType } from "@prisma/client";
import type { Metadata } from "next";
import { PublicLegalPage } from "@/app/components/public-store-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy Policy | Workbit",
  description: "Informativa sulla privacy di Workbit.",
};

export default function PrivacyPage() {
  return (
    <PublicLegalPage
      type={LegalDocumentType.PRIVACY_POLICY}
      fallbackTitle="Privacy Policy"
      fallbackMessage="La Privacy Policy pubblica è in fase di aggiornamento. Per informazioni contatta il supporto Workbit."
    />
  );
}
