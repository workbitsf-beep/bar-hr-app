ALTER TABLE "Note" ADD COLUMN "activityDate" TIMESTAMP(3);

CREATE INDEX "Note_barId_activityDate_idx" ON "Note"("barId", "activityDate");
