-- La sede principale dell'azienda: sempre presente, compresa, non si toglie.
ALTER TABLE "Site" ADD COLUMN "isMain" BOOLEAN NOT NULL DEFAULT false;
