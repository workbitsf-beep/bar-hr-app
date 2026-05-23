CREATE TYPE "ActivityType" AS ENUM ('RESTAURANT', 'COMPANY');

ALTER TYPE "RequestType" ADD VALUE 'SICKNESS';

ALTER TABLE "Bar"
ADD COLUMN "activityType" "ActivityType" NOT NULL DEFAULT 'RESTAURANT';

ALTER TABLE "Request"
ADD COLUMN "certificateCode" TEXT;

CREATE TABLE "Course" (
  "id" UUID NOT NULL,
  "barId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "location" TEXT,
  "assignedToAll" BOOLEAN NOT NULL DEFAULT false,
  "assignedToId" UUID,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Course_barId_startsAt_idx" ON "Course"("barId", "startsAt");
CREATE INDEX "Course_barId_assignedToId_startsAt_idx" ON "Course"("barId", "assignedToId", "startsAt");
CREATE INDEX "Course_assignedToId_startsAt_idx" ON "Course"("assignedToId", "startsAt");
CREATE INDEX "Course_createdById_idx" ON "Course"("createdById");

ALTER TABLE "Course"
ADD CONSTRAINT "Course_barId_fkey"
FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Course"
ADD CONSTRAINT "Course_assignedToId_fkey"
FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Course"
ADD CONSTRAINT "Course_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
