-- AlterTable
ALTER TABLE "User" ADD COLUMN "tempPasswordHash" TEXT,
ADD COLUMN "tempPasswordExpiresAt" TIMESTAMP(3);
