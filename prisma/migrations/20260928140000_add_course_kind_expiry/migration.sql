-- CreateEnum
CREATE TYPE "CourseKind" AS ENUM ('HACCP', 'FIRE_SAFETY', 'FIRST_AID', 'OTHER');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "kind" "CourseKind" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Course_barId_expiresAt_idx" ON "Course"("barId", "expiresAt");
