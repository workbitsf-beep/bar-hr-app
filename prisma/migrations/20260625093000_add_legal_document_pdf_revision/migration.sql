ALTER TABLE "LegalDocument"
ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "fileName" TEXT,
ADD COLUMN IF NOT EXISTS "fileMimeType" TEXT,
ADD COLUMN IF NOT EXISTS "fileSize" INTEGER,
ADD COLUMN IF NOT EXISTS "fileContent" BYTEA;

ALTER TABLE "LegalAcceptance"
ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS "LegalAcceptance_documentId_userId_version_key";
DROP INDEX IF EXISTS "LegalAcceptance_documentId_version_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "LegalAcceptance_documentId_userId_version_revision_key"
ON "LegalAcceptance"("documentId", "userId", "version", "revision");

CREATE INDEX IF NOT EXISTS "LegalAcceptance_documentId_version_revision_idx"
ON "LegalAcceptance"("documentId", "version", "revision");
