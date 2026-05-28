CREATE TYPE "CalendarClosureType" AS ENUM ('CLOSURE', 'HOLIDAY', 'VACATION');

CREATE TABLE "CalendarClosure" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "barId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" "CalendarClosureType" NOT NULL DEFAULT 'CLOSURE',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarClosure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CalendarClosure_barId_startsAt_idx" ON "CalendarClosure"("barId", "startsAt");
CREATE INDEX "CalendarClosure_barId_endsAt_idx" ON "CalendarClosure"("barId", "endsAt");
CREATE INDEX "CalendarClosure_createdById_idx" ON "CalendarClosure"("createdById");

ALTER TABLE "CalendarClosure" ADD CONSTRAINT "CalendarClosure_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarClosure" ADD CONSTRAINT "CalendarClosure_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
