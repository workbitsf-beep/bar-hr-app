-- Piano su misura: prezzo, sedi e persone decisi con il cliente dal super admin.
ALTER TYPE "VenuePlan" ADD VALUE IF NOT EXISTS 'CUSTOM';
-- Fino a 12 sedi per i piani su misura.
ALTER TYPE "Department" ADD VALUE IF NOT EXISTS 'SEDE_7';
ALTER TYPE "Department" ADD VALUE IF NOT EXISTS 'SEDE_8';
ALTER TYPE "Department" ADD VALUE IF NOT EXISTS 'SEDE_9';
ALTER TYPE "Department" ADD VALUE IF NOT EXISTS 'SEDE_10';
ALTER TYPE "Department" ADD VALUE IF NOT EXISTS 'SEDE_11';
ALTER TYPE "Department" ADD VALUE IF NOT EXISTS 'SEDE_12';
ALTER TABLE "Bar" ADD COLUMN "customPriceCents" INTEGER;
ALTER TABLE "Bar" ADD COLUMN "customSeatLimit" INTEGER;
ALTER TABLE "Bar" ADD COLUMN "customSiteLimit" INTEGER;
ALTER TABLE "Bar" ADD COLUMN "customPlanNote" TEXT;
