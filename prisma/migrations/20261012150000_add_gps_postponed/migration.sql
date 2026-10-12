-- "Imposto dopo" for the clock-in point during setup.
ALTER TABLE "BarSettings" ADD COLUMN "gpsPostponedAt" TIMESTAMP(3);
