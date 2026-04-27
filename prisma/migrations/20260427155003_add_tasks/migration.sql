/*
  Warnings:

  - You are about to drop the column `dueAt` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `isArchived` on the `Task` table. All the data in the column will be lost.
  - Added the required column `dueDate` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- DropIndex
DROP INDEX "Task_barId_dueAt_idx";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "dueAt",
DROP COLUMN "isArchived",
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completedById" UUID,
ADD COLUMN     "dueDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "isUrgent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "TaskStatus" NOT NULL DEFAULT 'TODO';

-- CreateIndex
CREATE INDEX "Task_barId_dueDate_idx" ON "Task"("barId", "dueDate");

-- CreateIndex
CREATE INDEX "Task_completedById_idx" ON "Task"("completedById");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
