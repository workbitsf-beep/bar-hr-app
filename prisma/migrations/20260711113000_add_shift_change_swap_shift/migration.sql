ALTER TABLE "Request" ADD COLUMN "swapShiftId" UUID;

CREATE INDEX "Request_swapShiftId_idx" ON "Request"("swapShiftId");

ALTER TABLE "Request"
  ADD CONSTRAINT "Request_swapShiftId_fkey"
  FOREIGN KEY ("swapShiftId") REFERENCES "Shift"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
