-- CreateTable
CREATE TABLE "PayrollMonthAdjustment" (
    "id" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "month" TEXT NOT NULL,
    "totals" JSONB NOT NULL,
    "note" TEXT,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollMonthAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollMonthAdjustment_barId_userId_month_key" ON "PayrollMonthAdjustment"("barId", "userId", "month");

-- CreateIndex
CREATE INDEX "PayrollMonthAdjustment_barId_month_idx" ON "PayrollMonthAdjustment"("barId", "month");

-- AddForeignKey
ALTER TABLE "PayrollMonthAdjustment" ADD CONSTRAINT "PayrollMonthAdjustment_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
