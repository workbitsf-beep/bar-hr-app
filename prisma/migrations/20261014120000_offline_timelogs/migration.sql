-- A stamp made on the phone without network, sent when it came back.
ALTER TABLE "TimeLog" ADD COLUMN "offline" BOOLEAN NOT NULL DEFAULT false;
