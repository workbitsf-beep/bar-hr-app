-- AlterTable
ALTER TABLE "User" ADD COLUMN     "retiredAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_retiredAt_idx" ON "User"("retiredAt");
