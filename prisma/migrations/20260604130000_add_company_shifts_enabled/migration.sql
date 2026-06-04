ALTER TABLE "BarSettings"
ADD COLUMN IF NOT EXISTS "companyShiftsEnabled" BOOLEAN;

UPDATE "BarSettings" AS bs
SET "companyShiftsEnabled" = true
FROM "Bar" AS b
WHERE b.id = bs."barId"
  AND b."activityType" = 'COMPANY';
