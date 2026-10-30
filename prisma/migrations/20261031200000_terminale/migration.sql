-- Terminale del locale: dispositivo condiviso con note, lista della spesa e timbratura col PIN.
ALTER TABLE "BarSettings" ADD COLUMN "terminalPinForTasks" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "EmployeeBar" ADD COLUMN "terminalPin" TEXT, ADD COLUMN "terminalPinKey" TEXT;
CREATE UNIQUE INDEX "EmployeeBar_barId_terminalPinKey_key" ON "EmployeeBar"("barId", "terminalPinKey");
ALTER TABLE "TimeLog" ADD COLUMN "viaTerminal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Task" ADD COLUMN "completedOnTerminal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShoppingListItem" ALTER COLUMN "createdById" DROP NOT NULL, ADD COLUMN "addedOnTerminal" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Terminal" (
    "id" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT,
    "pairingCodeHash" TEXT,
    "pairingExpiresAt" TIMESTAMP(3),
    "pairedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "failedPins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Terminal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Terminal_tokenHash_key" ON "Terminal"("tokenHash");
CREATE UNIQUE INDEX "Terminal_pairingCodeHash_key" ON "Terminal"("pairingCodeHash");
CREATE INDEX "Terminal_barId_idx" ON "Terminal"("barId");
ALTER TABLE "Terminal" ADD CONSTRAINT "Terminal_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
