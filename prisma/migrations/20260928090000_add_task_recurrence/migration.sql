-- CreateEnum
CREATE TYPE "TaskRepeatUnit" AS ENUM ('DAY', 'WEEK', 'MONTH');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "repeatEvery" INTEGER,
ADD COLUMN     "repeatUnit" "TaskRepeatUnit";
