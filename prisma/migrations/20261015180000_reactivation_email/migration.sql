-- Last reactivation email sent to an owner from the installed app.
ALTER TABLE "Subscription" ADD COLUMN "reactivationEmailAt" TIMESTAMP(3);
