-- Workbit's own books: costs, expenses, debts and extra income, kept in the console.
CREATE TYPE "LedgerKind" AS ENUM ('COST', 'EXPENSE', 'DEBT', 'INCOME');
CREATE TYPE "LedgerPeriod" AS ENUM ('MONTHLY', 'YEARLY', 'ONCE');

CREATE TABLE "LedgerEntry" (
    "id" UUID NOT NULL,
    "kind" "LedgerKind" NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "amountCents" INTEGER NOT NULL,
    "period" "LedgerPeriod" NOT NULL DEFAULT 'MONTHLY',
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3),
    "installmentCents" INTEGER,
    "dueOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LedgerPayment" (
    "id" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LedgerEntry_kind_idx" ON "LedgerEntry"("kind");
CREATE INDEX "LedgerPayment_entryId_idx" ON "LedgerPayment"("entryId");
CREATE INDEX "LedgerPayment_paidOn_idx" ON "LedgerPayment"("paidOn");

ALTER TABLE "LedgerPayment" ADD CONSTRAINT "LedgerPayment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "LedgerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
