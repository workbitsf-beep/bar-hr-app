-- Whether a legal document PDF was generated from its text.
ALTER TABLE "LegalDocument" ADD COLUMN "fileGenerated" BOOLEAN NOT NULL DEFAULT false;
