-- CreateEnum
CREATE TYPE "LegalDocumentType" AS ENUM (
  'PRIVACY_POLICY',
  'TERMS_AND_CONDITIONS',
  'COOKIE_POLICY',
  'ACCOUNT_DELETION',
  'GEOLOCATION_NOTICE',
  'DPA',
  'SAAS_CONTRACT',
  'OTHER'
);

-- CreateTable
CREATE TABLE "LegalDocument" (
  "id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "type" "LegalDocumentType" NOT NULL,
  "version" TEXT NOT NULL,
  "content" TEXT,
  "fileUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalAcceptance" (
  "id" UUID NOT NULL,
  "documentId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "barId" UUID,
  "version" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalDocument_type_isActive_idx" ON "LegalDocument"("type", "isActive");

-- CreateIndex
CREATE INDEX "LegalDocument_isActive_isRequired_idx" ON "LegalDocument"("isActive", "isRequired");

-- CreateIndex
CREATE INDEX "LegalDocument_updatedAt_idx" ON "LegalDocument"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegalAcceptance_documentId_userId_version_key" ON "LegalAcceptance"("documentId", "userId", "version");

-- CreateIndex
CREATE INDEX "LegalAcceptance_userId_acceptedAt_idx" ON "LegalAcceptance"("userId", "acceptedAt");

-- CreateIndex
CREATE INDEX "LegalAcceptance_barId_acceptedAt_idx" ON "LegalAcceptance"("barId", "acceptedAt");

-- CreateIndex
CREATE INDEX "LegalAcceptance_documentId_version_idx" ON "LegalAcceptance"("documentId", "version");

-- AddForeignKey
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LegalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
