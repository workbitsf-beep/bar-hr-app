CREATE TABLE IF NOT EXISTS "Notification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "barId" UUID,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "actionUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_barId_fkey"
    FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_barId_createdAt_idx" ON "Notification"("barId", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_type_createdAt_idx" ON "Notification"("type", "createdAt");

CREATE TABLE IF NOT EXISTS "PushToken" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    ALTER TABLE "PushToken"
    ADD CONSTRAINT "PushToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "PushToken_token_key" ON "PushToken"("token");
CREATE INDEX IF NOT EXISTS "PushToken_userId_idx" ON "PushToken"("userId");
CREATE INDEX IF NOT EXISTS "PushToken_platform_idx" ON "PushToken"("platform");
