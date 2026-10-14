-- A restaurant on Pro that divides by sites instead of departments.
ALTER TABLE "Bar" ADD COLUMN "restaurantSites" BOOLEAN NOT NULL DEFAULT false;
