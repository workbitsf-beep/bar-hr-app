-- AlterEnum
ALTER TYPE "LegalDocumentType" ADD VALUE 'SUPPLIER_TERMS';

-- AlterTable
ALTER TABLE "SupplierListPrice" ADD COLUMN "supplierId" UUID;

-- CreateTable
CREATE TABLE "Supplier" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "companyName" TEXT,
    "vatNumber" TEXT,
    "zone" TEXT,
    "categories" TEXT,
    "phone" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "termsVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalLoginCode" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalLoginCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalSession" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilotFeedback" (
    "id" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "strengths" TEXT,
    "problems" TEXT,
    "missing" TEXT,
    "wouldPay" INTEGER,
    "payNote" TEXT,
    "recommend" INTEGER,
    "mostUsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PilotFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierListPrice_supplierId_idx" ON "SupplierListPrice"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_email_key" ON "Supplier"("email");

-- CreateIndex
CREATE INDEX "PortalLoginCode_kind_email_createdAt_idx" ON "PortalLoginCode"("kind", "email", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PortalSession_tokenHash_key" ON "PortalSession"("tokenHash");

-- CreateIndex
CREATE INDEX "PortalSession_kind_email_idx" ON "PortalSession"("kind", "email");

-- CreateIndex
CREATE INDEX "PilotFeedback_barId_createdAt_idx" ON "PilotFeedback"("barId", "createdAt");

-- AddForeignKey
ALTER TABLE "SupplierListPrice" ADD CONSTRAINT "SupplierListPrice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
