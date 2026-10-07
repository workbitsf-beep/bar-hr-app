-- CreateEnum
CREATE TYPE "ChecklistMoment" AS ENUM ('OPENING', 'CLOSING');

-- CreateTable
CREATE TABLE "Checklist" (
    "id" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "department" "Department" NOT NULL,
    "moment" "ChecklistMoment" NOT NULL,
    "items" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistRun" (
    "id" UUID NOT NULL,
    "checklistId" UUID NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "doneItems" TEXT[],
    "completedById" UUID,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Checklist_barId_department_moment_key" ON "Checklist"("barId", "department", "moment");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistRun_checklistId_day_key" ON "ChecklistRun"("checklistId", "day");

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistRun" ADD CONSTRAINT "ChecklistRun_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistRun" ADD CONSTRAINT "ChecklistRun_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

