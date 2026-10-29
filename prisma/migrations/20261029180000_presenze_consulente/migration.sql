-- AlterTable
ALTER TABLE "BarSettings" DROP COLUMN "consultantEmail",
DROP COLUMN "consultantName",
DROP COLUMN "payrollCodes",
ADD COLUMN     "payrollBreakAfterHours" DOUBLE PRECISION,
ADD COLUMN     "payrollBreakMinutes" INTEGER,
ADD COLUMN     "payrollSource" TEXT NOT NULL DEFAULT 'AUTO';

-- CreateTable
CREATE TABLE "PayrollRecipient" (
    "id" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'consulente',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cc" TEXT,
    "template" JSONB,
    "message" TEXT,
    "sendDay" INTEGER,
    "remindedMonth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollDayOverride" (
    "id" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "entries" JSONB NOT NULL,
    "note" TEXT,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollDayOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollSend" (
    "id" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "month" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "sentById" UUID,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollRecipient_barId_idx" ON "PayrollRecipient"("barId");

-- CreateIndex
CREATE INDEX "PayrollDayOverride_barId_date_idx" ON "PayrollDayOverride"("barId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollDayOverride_barId_userId_date_key" ON "PayrollDayOverride"("barId", "userId", "date");

-- CreateIndex
CREATE INDEX "PayrollSend_barId_month_idx" ON "PayrollSend"("barId", "month");

-- CreateIndex
CREATE INDEX "PayrollSend_recipientId_month_idx" ON "PayrollSend"("recipientId", "month");

-- AddForeignKey
ALTER TABLE "PayrollRecipient" ADD CONSTRAINT "PayrollRecipient_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDayOverride" ADD CONSTRAINT "PayrollDayOverride_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollSend" ADD CONSTRAINT "PayrollSend_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollSend" ADD CONSTRAINT "PayrollSend_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "PayrollRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

