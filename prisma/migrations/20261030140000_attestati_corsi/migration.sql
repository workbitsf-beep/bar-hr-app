-- AlterTable
ALTER TABLE "BarSettings" ADD COLUMN     "courseReminderDays" INTEGER NOT NULL DEFAULT 60;

-- CreateTable
CREATE TABLE "CourseCertificate" (
    "id" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "CourseKind" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "courseId" UUID,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "content" BYTEA,
    "addedById" UUID,
    "reminderStage" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseCertificate_barId_expiresAt_idx" ON "CourseCertificate"("barId", "expiresAt");

-- CreateIndex
CREATE INDEX "CourseCertificate_barId_userId_kind_idx" ON "CourseCertificate"("barId", "userId", "kind");

-- CreateIndex
CREATE INDEX "CourseCertificate_courseId_idx" ON "CourseCertificate"("courseId");

-- AddForeignKey
ALTER TABLE "CourseCertificate" ADD CONSTRAINT "CourseCertificate_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCertificate" ADD CONSTRAINT "CourseCertificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCertificate" ADD CONSTRAINT "CourseCertificate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCertificate" ADD CONSTRAINT "CourseCertificate_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

