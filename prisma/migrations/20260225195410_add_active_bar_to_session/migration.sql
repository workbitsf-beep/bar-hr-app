-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "activeBarId" UUID;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_activeBarId_fkey" FOREIGN KEY ("activeBarId") REFERENCES "Bar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
