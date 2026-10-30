-- AlterTable
ALTER TABLE "SupplierInvoice" ADD COLUMN "paymentsReadAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" TEXT,
    "iban" TEXT,
    "state" TEXT,
    "paidAt" TIMESTAMP(3),
    "remindedAt" TIMESTAMP(3),
    "askedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPaymentRule" (
    "id" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "supplierKey" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPaymentRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierPayment_barId_dueDate_idx" ON "SupplierPayment"("barId", "dueDate");

-- CreateIndex
CREATE INDEX "SupplierPayment_invoiceId_idx" ON "SupplierPayment"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPaymentRule_barId_supplierKey_key" ON "SupplierPaymentRule"("barId", "supplierKey");

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPaymentRule" ADD CONSTRAINT "SupplierPaymentRule_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
