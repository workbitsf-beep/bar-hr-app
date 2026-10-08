-- Aziende: le sedi, con lo stesso meccanismo dei reparti piu nome, indirizzo
-- e punto di timbratura.
ALTER TYPE "Department" ADD VALUE IF NOT EXISTS 'SEDE_1';
ALTER TYPE "Department" ADD VALUE IF NOT EXISTS 'SEDE_2';
ALTER TYPE "Department" ADD VALUE IF NOT EXISTS 'SEDE_3';
ALTER TYPE "Department" ADD VALUE IF NOT EXISTS 'SEDE_4';
ALTER TYPE "Department" ADD VALUE IF NOT EXISTS 'SEDE_5';
ALTER TYPE "Department" ADD VALUE IF NOT EXISTS 'SEDE_6';

CREATE TABLE "Site" (
    "id" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "slot" "Department" NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Site_barId_slot_key" ON "Site"("barId", "slot");
ALTER TABLE "Site" ADD CONSTRAINT "Site_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
