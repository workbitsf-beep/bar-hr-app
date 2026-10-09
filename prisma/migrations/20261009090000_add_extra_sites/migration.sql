-- Aziende: le sedi si pagano una per una (7,99 l'una), fino a 3 sul Base; il Pro
-- ne comprende 3 e ne aggiunge fino a 6. Chi aveva l'extra Sedi tiene le sue 3.
ALTER TABLE "Bar" ADD COLUMN "extraSites" INTEGER NOT NULL DEFAULT 0;
UPDATE "Bar" SET "extraSites" = 3 WHERE "activityType" = 'COMPANY' AND "departmentsAddon" = true AND "plan" = 'BASE';
