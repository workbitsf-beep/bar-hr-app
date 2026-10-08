-- Piani: il Base con gli extra (reparti, pacchetti da +5 persone, stile del
-- locale) e il Pro che li comprende tutti. Logo e font dell'insegna.
ALTER TABLE "Bar" ADD COLUMN "departmentsAddon" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Bar" ADD COLUMN "extraSeatPacks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Bar" ADD COLUMN "brandingAddon" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Bar" ADD COLUMN "logo" BYTEA;
ALTER TABLE "Bar" ADD COLUMN "logoType" TEXT;
ALTER TABLE "Bar" ADD COLUMN "logoUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Bar" ADD COLUMN "signFont" TEXT;
