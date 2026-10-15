-- When an e-invoice was handed to the SDI through Openapi.
ALTER TABLE "Invoice" ADD COLUMN "fiscalSentAt" TIMESTAMP(3);
