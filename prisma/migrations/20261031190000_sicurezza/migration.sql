-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "userId" UUID,
    "email" TEXT,
    "barId" UUID,
    "ip" TEXT,
    "userAgent" TEXT,
    "device" TEXT,
    "detail" TEXT,
    "alertKey" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "clientNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErrorEvent" (
    "id" UUID NOT NULL,
    "signature" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "path" TEXT,
    "digest" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alertedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ErrorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityEvent_type_createdAt_idx" ON "SecurityEvent"("type", "createdAt");
CREATE INDEX "SecurityEvent_userId_createdAt_idx" ON "SecurityEvent"("userId", "createdAt");
CREATE INDEX "SecurityEvent_email_createdAt_idx" ON "SecurityEvent"("email", "createdAt");
CREATE INDEX "SecurityEvent_ip_createdAt_idx" ON "SecurityEvent"("ip", "createdAt");
CREATE INDEX "SecurityEvent_severity_createdAt_idx" ON "SecurityEvent"("severity", "createdAt");
CREATE INDEX "SecurityEvent_alertKey_createdAt_idx" ON "SecurityEvent"("alertKey", "createdAt");
CREATE UNIQUE INDEX "ErrorEvent_signature_key" ON "ErrorEvent"("signature");
CREATE INDEX "ErrorEvent_lastAt_idx" ON "ErrorEvent"("lastAt");

-- Sessions: the database keeps the hash of each cookie, never the cookie.
UPDATE "Session" SET "token" = 'h:' || encode(sha256(convert_to("token", 'UTF8')), 'hex') WHERE "token" NOT LIKE 'h:%';
