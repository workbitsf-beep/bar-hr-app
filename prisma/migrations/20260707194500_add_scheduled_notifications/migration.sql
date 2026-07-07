CREATE TABLE "ScheduledNotification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "barId" UUID,
    "shiftId" UUID,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionUrl" TEXT,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScheduledNotification_userId_type_actionUrl_key" ON "ScheduledNotification"("userId", "type", "actionUrl");
CREATE INDEX "ScheduledNotification_sendAt_sentAt_canceledAt_idx" ON "ScheduledNotification"("sendAt", "sentAt", "canceledAt");
CREATE INDEX "ScheduledNotification_userId_sendAt_idx" ON "ScheduledNotification"("userId", "sendAt");
CREATE INDEX "ScheduledNotification_barId_sendAt_idx" ON "ScheduledNotification"("barId", "sendAt");
CREATE INDEX "ScheduledNotification_shiftId_idx" ON "ScheduledNotification"("shiftId");
CREATE INDEX "ScheduledNotification_type_sendAt_idx" ON "ScheduledNotification"("type", "sendAt");

ALTER TABLE "ScheduledNotification" ADD CONSTRAINT "ScheduledNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledNotification" ADD CONSTRAINT "ScheduledNotification_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledNotification" ADD CONSTRAINT "ScheduledNotification_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
