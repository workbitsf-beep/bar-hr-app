-- The Italian e-invoice made from each paid Stripe invoice.
CREATE TYPE "FiscalState" AS ENUM ('NONE', 'MISSING_DATA', 'READY', 'SENT', 'DELIVERED', 'REJECTED');

ALTER TABLE "Invoice" ADD COLUMN "fiscalState" "FiscalState" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Invoice" ADD COLUMN "fiscalYear" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN "fiscalSequence" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN "fiscalNumber" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "fiscalFileName" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "fiscalXml" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "fiscalLines" JSONB;

CREATE UNIQUE INDEX "Invoice_fiscalYear_fiscalSequence_key" ON "Invoice"("fiscalYear", "fiscalSequence");
