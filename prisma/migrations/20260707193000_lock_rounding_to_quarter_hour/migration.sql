UPDATE "Bar"
SET "roundingStepMin" = 15
WHERE "roundingStepMin" IS DISTINCT FROM 15;

UPDATE "BarSettings"
SET
  "roundingMinutes" = 15,
  "roundingMode" = 'NEAREST'
WHERE
  "roundingMinutes" IS DISTINCT FROM 15
  OR "roundingMode" IS DISTINCT FROM 'NEAREST';
