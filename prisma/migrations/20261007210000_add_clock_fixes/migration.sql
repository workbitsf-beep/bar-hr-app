-- Entrate e uscite dimenticate: il dipendente dice l'orario vero, il titolare approva.
CREATE TYPE "ClockFixKind" AS ENUM ('MISSED_IN', 'MISSED_OUT');
CREATE TYPE "ClockFixStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "ClockFix" (
    "id" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "shiftId" UUID,
    "clockInId" UUID,
    "kind" "ClockFixKind" NOT NULL,
    "status" "ClockFixStatus" NOT NULL DEFAULT 'PENDING',
    "requestedInAt" TIMESTAMP(3),
    "requestedOutAt" TIMESTAMP(3),
    "resolvedInAt" TIMESTAMP(3),
    "resolvedOutAt" TIMESTAMP(3),
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClockFix_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClockFix_barId_status_idx" ON "ClockFix"("barId", "status");
CREATE INDEX "ClockFix_userId_status_idx" ON "ClockFix"("userId", "status");
CREATE INDEX "ClockFix_shiftId_idx" ON "ClockFix"("shiftId");

ALTER TABLE "ClockFix" ADD CONSTRAINT "ClockFix_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClockFix" ADD CONSTRAINT "ClockFix_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClockFix" ADD CONSTRAINT "ClockFix_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClockFix" ADD CONSTRAINT "ClockFix_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
