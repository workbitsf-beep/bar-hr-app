/*
  Warnings:

  - The values [DEVICE] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - The primary key for the `Bar` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `punchRadius` on the `Bar` table. All the data in the column will be lost.
  - The primary key for the `Note` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `author` on the `Note` table. All the data in the column will be lost.
  - You are about to drop the column `message` on the `Note` table. All the data in the column will be lost.
  - The primary key for the `Request` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Shift` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `date` on the `Shift` table. All the data in the column will be lost.
  - You are about to drop the column `endTime` on the `Shift` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `Shift` table. All the data in the column will be lost.
  - The primary key for the `Task` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `completed` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `completedBy` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `employeeId` on the `Task` table. All the data in the column will be lost.
  - The primary key for the `TimeLog` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `TimeLog` table. All the data in the column will be lost.
  - You are about to drop the column `viaDevice` on the `TimeLog` table. All the data in the column will be lost.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Device` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Employee` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `Bar` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `Bar` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `ownerId` on the `Bar` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `authorId` to the `Note` table without a default value. This is not possible if the table is not empty.
  - Added the required column `content` to the `Note` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Note` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `Note` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `barId` on the `Note` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `barId` to the `Request` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Request` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `Request` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `employeeId` on the `Request` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `endsAt` to the `Shift` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startsAt` to the `Shift` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Shift` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `Shift` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `barId` on the `Shift` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `employeeId` on the `Shift` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `createdById` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `Task` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `barId` on the `Task` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `TimeLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `barId` on the `TimeLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `employeeId` on the `TimeLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `firstName` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `passwordHash` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('OWNER', 'EMPLOYEE');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Bar" DROP CONSTRAINT "Bar_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "Device" DROP CONSTRAINT "Device_barId_fkey";

-- DropForeignKey
ALTER TABLE "Device" DROP CONSTRAINT "Device_userId_fkey";

-- DropForeignKey
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_barId_fkey";

-- DropForeignKey
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_userId_fkey";

-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_barId_fkey";

-- DropForeignKey
ALTER TABLE "Request" DROP CONSTRAINT "Request_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "Shift" DROP CONSTRAINT "Shift_barId_fkey";

-- DropForeignKey
ALTER TABLE "Shift" DROP CONSTRAINT "Shift_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_barId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "TimeLog" DROP CONSTRAINT "TimeLog_barId_fkey";

-- DropForeignKey
ALTER TABLE "TimeLog" DROP CONSTRAINT "TimeLog_employeeId_fkey";

-- AlterTable
ALTER TABLE "Bar" DROP CONSTRAINT "Bar_pkey",
DROP COLUMN "punchRadius",
ADD COLUMN     "entryToleranceMin" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "exitToleranceMin" INTEGER NOT NULL DEFAULT 13,
ADD COLUMN     "radiusMeters" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "roundingStepMin" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "roundingEnabled" SET DEFAULT false,
DROP COLUMN "ownerId",
ADD COLUMN     "ownerId" UUID NOT NULL,
ADD CONSTRAINT "Bar_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Note" DROP CONSTRAINT "Note_pkey",
DROP COLUMN "author",
DROP COLUMN "message",
ADD COLUMN     "authorId" UUID NOT NULL,
ADD COLUMN     "content" TEXT NOT NULL,
ADD COLUMN     "employeeId" UUID,
ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "barId",
ADD COLUMN     "barId" UUID NOT NULL,
ADD CONSTRAINT "Note_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Request" DROP CONSTRAINT "Request_pkey",
ADD COLUMN     "barId" UUID NOT NULL,
ADD COLUMN     "endsAt" TIMESTAMP(3),
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" UUID,
ADD COLUMN     "shiftId" UUID,
ADD COLUMN     "startsAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "employeeId",
ADD COLUMN     "employeeId" UUID NOT NULL,
ADD CONSTRAINT "Request_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Shift" DROP CONSTRAINT "Shift_pkey",
DROP COLUMN "date",
DROP COLUMN "endTime",
DROP COLUMN "startTime",
ADD COLUMN     "endsAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "roleLabel" TEXT,
ADD COLUMN     "startsAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "barId",
ADD COLUMN     "barId" UUID NOT NULL,
DROP COLUMN "employeeId",
ADD COLUMN     "employeeId" UUID NOT NULL,
ADD CONSTRAINT "Shift_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Task" DROP CONSTRAINT "Task_pkey",
DROP COLUMN "completed",
DROP COLUMN "completedBy",
DROP COLUMN "date",
DROP COLUMN "employeeId",
ADD COLUMN     "assignedToId" UUID,
ADD COLUMN     "createdById" UUID NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "barId",
ADD COLUMN     "barId" UUID NOT NULL,
ADD CONSTRAINT "Task_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "TimeLog" DROP CONSTRAINT "TimeLog_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "viaDevice",
ADD COLUMN     "createdById" UUID,
ADD COLUMN     "fromKiosk" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "shiftId" UUID,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "barId",
ADD COLUMN     "barId" UUID NOT NULL,
DROP COLUMN "employeeId",
ADD COLUMN     "employeeId" UUID NOT NULL,
ADD CONSTRAINT "TimeLog_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "password",
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "lastName" TEXT NOT NULL,
ADD COLUMN     "passwordHash" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "role" SET DEFAULT 'EMPLOYEE',
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "Device";

-- DropTable
DROP TABLE "Employee";

-- CreateTable
CREATE TABLE "EmployeeBar" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "hourlyRate" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "EmployeeBar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskCompletion" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "TaskCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeBar_userId_idx" ON "EmployeeBar"("userId");

-- CreateIndex
CREATE INDEX "EmployeeBar_barId_idx" ON "EmployeeBar"("barId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeBar_userId_barId_key" ON "EmployeeBar"("userId", "barId");

-- CreateIndex
CREATE INDEX "TaskCompletion_userId_idx" ON "TaskCompletion"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskCompletion_taskId_userId_key" ON "TaskCompletion"("taskId", "userId");

-- CreateIndex
CREATE INDEX "Bar_ownerId_idx" ON "Bar"("ownerId");

-- CreateIndex
CREATE INDEX "Note_barId_createdAt_idx" ON "Note"("barId", "createdAt");

-- CreateIndex
CREATE INDEX "Note_employeeId_idx" ON "Note"("employeeId");

-- CreateIndex
CREATE INDEX "Request_barId_status_idx" ON "Request"("barId", "status");

-- CreateIndex
CREATE INDEX "Request_employeeId_createdAt_idx" ON "Request"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "Shift_barId_employeeId_idx" ON "Shift"("barId", "employeeId");

-- CreateIndex
CREATE INDEX "Shift_startsAt_idx" ON "Shift"("startsAt");

-- CreateIndex
CREATE INDEX "Task_barId_dueAt_idx" ON "Task"("barId", "dueAt");

-- CreateIndex
CREATE INDEX "Task_assignedToId_idx" ON "Task"("assignedToId");

-- CreateIndex
CREATE INDEX "TimeLog_barId_employeeId_timestamp_idx" ON "TimeLog"("barId", "employeeId", "timestamp");

-- CreateIndex
CREATE INDEX "TimeLog_createdById_idx" ON "TimeLog"("createdById");

-- CreateIndex
CREATE INDEX "TimeLog_shiftId_idx" ON "TimeLog"("shiftId");

-- AddForeignKey
ALTER TABLE "Bar" ADD CONSTRAINT "Bar_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeBar" ADD CONSTRAINT "EmployeeBar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeBar" ADD CONSTRAINT "EmployeeBar_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeLog" ADD CONSTRAINT "TimeLog_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeLog" ADD CONSTRAINT "TimeLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeLog" ADD CONSTRAINT "TimeLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeLog" ADD CONSTRAINT "TimeLog_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCompletion" ADD CONSTRAINT "TaskCompletion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCompletion" ADD CONSTRAINT "TaskCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
