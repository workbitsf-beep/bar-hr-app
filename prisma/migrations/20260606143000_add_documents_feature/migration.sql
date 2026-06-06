ALTER TABLE "BarSettings"
ADD COLUMN IF NOT EXISTS "documentsEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "Document" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "barId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "assignedToAll" BOOLEAN NOT NULL DEFAULT true,
    "assignedToId" UUID,
    "createdById" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    ALTER TABLE "Document"
    ADD CONSTRAINT "Document_barId_fkey"
    FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "Document"
    ADD CONSTRAINT "Document_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "Document"
    ADD CONSTRAINT "Document_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "Document"
    ADD CONSTRAINT "Document_deactivatedById_fkey"
    FOREIGN KEY ("deactivatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Document_barId_createdAt_idx" ON "Document"("barId", "createdAt");
CREATE INDEX IF NOT EXISTS "Document_barId_isActive_createdAt_idx" ON "Document"("barId", "isActive", "createdAt");
CREATE INDEX IF NOT EXISTS "Document_assignedToId_isActive_idx" ON "Document"("assignedToId", "isActive");
CREATE INDEX IF NOT EXISTS "Document_deactivatedById_idx" ON "Document"("deactivatedById");
