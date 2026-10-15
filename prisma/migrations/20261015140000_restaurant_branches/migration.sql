-- A restaurant's branch (sede): a venue of its own, billed with its main venue.
ALTER TABLE "Bar" ADD COLUMN "mainBarId" UUID;
ALTER TABLE "Bar" ADD CONSTRAINT "Bar_mainBarId_fkey" FOREIGN KEY ("mainBarId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Bar_mainBarId_idx" ON "Bar"("mainBarId");
