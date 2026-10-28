-- AlterTable
ALTER TABLE "BarSettings" ADD COLUMN     "consultantEmail" TEXT,
ADD COLUMN     "consultantName" TEXT,
ADD COLUMN     "invoiceInboxFiscalId" TEXT,
ADD COLUMN     "invoiceInboxSince" TIMESTAMP(3),
ADD COLUMN     "invoiceInboxStatus" TEXT NOT NULL DEFAULT 'OFF',
ADD COLUMN     "invoiceInboxSyncedAt" TIMESTAMP(3),
ADD COLUMN     "payrollCodes" JSONB;

-- AlterTable
ALTER TABLE "EmployeeBar" ADD COLUMN     "contractWeeklyHours" DOUBLE PRECISION,
ADD COLUMN     "payrollCode" TEXT;

-- CreateTable
CREATE TABLE "SupplierInvoice" (
    "id" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "uploadId" UUID,
    "openapiUuid" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierVat" TEXT,
    "supplierTaxCode" TEXT,
    "number" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "totalCents" INTEGER NOT NULL,
    "taxableCents" INTEGER NOT NULL,
    "vatCents" INTEGER NOT NULL,
    "xmlGz" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoiceLine" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "code" TEXT,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "unitPrice" DOUBLE PRECISION,
    "totalCents" INTEGER NOT NULL,
    "vatRate" DOUBLE PRECISION,
    "category" TEXT NOT NULL DEFAULT 'da_classificare',
    "categorySource" TEXT,
    "productKey" TEXT,
    "productLabel" TEXT,
    "baseUnit" TEXT,
    "baseQty" DOUBLE PRECISION,

    CONSTRAINT "SupplierInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceUpload" (
    "id" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedById" UUID,
    "found" INTEGER NOT NULL DEFAULT 0,
    "imported" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "notes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierProductMap" (
    "id" UUID NOT NULL,
    "scope" TEXT NOT NULL DEFAULT '',
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "productKey" TEXT,
    "productLabel" TEXT,
    "baseUnit" TEXT,
    "unitsPerItem" DOUBLE PRECISION,
    "source" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierProductMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCategory" (
    "id" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "supplierKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceCheck" (
    "id" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "productKey" TEXT NOT NULL,
    "productLabel" TEXT NOT NULL,
    "baseUnit" TEXT,
    "ourUnitPrice" DOUBLE PRECISION,
    "offers" JSONB NOT NULL,
    "bestUnitPrice" DOUBLE PRECISION,
    "summary" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyRevenue" (
    "id" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "month" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierInvoice_barId_issueDate_idx" ON "SupplierInvoice"("barId", "issueDate");

-- CreateIndex
CREATE INDEX "SupplierInvoice_barId_supplierVat_idx" ON "SupplierInvoice"("barId", "supplierVat");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvoice_barId_dedupeKey_key" ON "SupplierInvoice"("barId", "dedupeKey");

-- CreateIndex
CREATE INDEX "SupplierInvoiceLine_invoiceId_idx" ON "SupplierInvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "SupplierInvoiceLine_barId_category_idx" ON "SupplierInvoiceLine"("barId", "category");

-- CreateIndex
CREATE INDEX "SupplierInvoiceLine_barId_productKey_idx" ON "SupplierInvoiceLine"("barId", "productKey");

-- CreateIndex
CREATE INDEX "InvoiceUpload_barId_createdAt_idx" ON "InvoiceUpload"("barId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierProductMap_scope_key_key" ON "SupplierProductMap"("scope", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCategory_barId_supplierKey_key" ON "SupplierCategory"("barId", "supplierKey");

-- CreateIndex
CREATE INDEX "PriceCheck_barId_productKey_checkedAt_idx" ON "PriceCheck"("barId", "productKey", "checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyRevenue_barId_month_key" ON "MonthlyRevenue"("barId", "month");

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "InvoiceUpload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoiceLine" ADD CONSTRAINT "SupplierInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceUpload" ADD CONSTRAINT "InvoiceUpload_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCategory" ADD CONSTRAINT "SupplierCategory_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceCheck" ADD CONSTRAINT "PriceCheck_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyRevenue" ADD CONSTRAINT "MonthlyRevenue_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

