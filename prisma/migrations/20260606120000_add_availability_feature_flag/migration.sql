-- Add a dedicated flag for unavailability so it can be toggled independently from requests.
ALTER TABLE "BarSettings"
ADD COLUMN IF NOT EXISTS "availabilityEnabled" BOOLEAN NOT NULL DEFAULT true;
