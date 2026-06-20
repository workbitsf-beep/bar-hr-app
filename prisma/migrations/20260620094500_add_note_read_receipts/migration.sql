ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "NoteReadReceipt" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "noteId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NoteReadReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NoteReadReceipt_noteId_userId_key" ON "NoteReadReceipt"("noteId", "userId");
CREATE INDEX IF NOT EXISTS "NoteReadReceipt_userId_readAt_idx" ON "NoteReadReceipt"("userId", "readAt");
CREATE INDEX IF NOT EXISTS "NoteReadReceipt_noteId_readAt_idx" ON "NoteReadReceipt"("noteId", "readAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NoteReadReceipt_noteId_fkey'
  ) THEN
    ALTER TABLE "NoteReadReceipt"
      ADD CONSTRAINT "NoteReadReceipt_noteId_fkey"
      FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NoteReadReceipt_userId_fkey'
  ) THEN
    ALTER TABLE "NoteReadReceipt"
      ADD CONSTRAINT "NoteReadReceipt_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
