-- AlterTable
ALTER TABLE "Bar" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MarketPrice" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'confirmed',
ADD COLUMN "foundUrl" TEXT,
ADD COLUMN "note" TEXT;

-- CreateTable
CREATE TABLE "SupplierListPrice" (
    "id" UUID NOT NULL,
    "supplierName" TEXT NOT NULL,
    "zone" TEXT,
    "productKey" TEXT NOT NULL,
    "productLabel" TEXT NOT NULL,
    "baseUnit" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'listino',
    "url" TEXT,
    "barId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierListPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierListPrice_productKey_baseUnit_idx" ON "SupplierListPrice"("productKey", "baseUnit");

-- CreateIndex
CREATE INDEX "SupplierListPrice_barId_idx" ON "SupplierListPrice"("barId");

-- AddForeignKey
ALTER TABLE "SupplierListPrice" ADD CONSTRAINT "SupplierListPrice_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
