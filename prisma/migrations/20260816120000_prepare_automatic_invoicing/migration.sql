DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceProvider') THEN
    CREATE TYPE "InvoiceProvider" AS ENUM ('STRIPE', 'EXTERNAL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceStatus') THEN
    CREATE TYPE "InvoiceStatus" AS ENUM (
      'DRAFT',
      'OPEN',
      'PAID',
      'VOID',
      'UNCOLLECTIBLE',
      'FAILED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "BillingProfile" (
    "id" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "businessName" TEXT,
    "vatNumber" TEXT,
    "taxCode" TEXT,
    "recipientCode" TEXT,
    "certifiedEmail" TEXT,
    "billingEmail" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "countryCode" TEXT NOT NULL DEFAULT 'IT',
    "stripeTaxId" TEXT,
    "fiscalProviderRef" TEXT,
    "invoicingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "subscriptionId" UUID,
    "provider" "InvoiceProvider" NOT NULL DEFAULT 'STRIPE',
    "externalId" TEXT NOT NULL,
    "externalNumber" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "subtotalAmount" INTEGER NOT NULL DEFAULT 0,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "hostedUrl" TEXT,
    "pdfUrl" TEXT,
    "fiscalDocumentId" TEXT,
    "fiscalError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BillingProfile_barId_key" ON "BillingProfile"("barId");
CREATE INDEX IF NOT EXISTS "BillingProfile_vatNumber_idx" ON "BillingProfile"("vatNumber");
CREATE INDEX IF NOT EXISTS "BillingProfile_taxCode_idx" ON "BillingProfile"("taxCode");

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_provider_externalId_key" ON "Invoice"("provider", "externalId");
CREATE INDEX IF NOT EXISTS "Invoice_barId_issuedAt_idx" ON "Invoice"("barId", "issuedAt");
CREATE INDEX IF NOT EXISTS "Invoice_subscriptionId_idx" ON "Invoice"("subscriptionId");
CREATE INDEX IF NOT EXISTS "Invoice_status_dueAt_idx" ON "Invoice"("status", "dueAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BillingProfile_barId_fkey'
  ) THEN
    ALTER TABLE "BillingProfile"
      ADD CONSTRAINT "BillingProfile_barId_fkey"
      FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_barId_fkey'
  ) THEN
    ALTER TABLE "Invoice"
      ADD CONSTRAINT "Invoice_barId_fkey"
      FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_subscriptionId_fkey'
  ) THEN
    ALTER TABLE "Invoice"
      ADD CONSTRAINT "Invoice_subscriptionId_fkey"
      FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
