-- Quando e partito l'avviso "la prova scade fra tre giorni".
-- Serve solo a non mandarlo due volte.
ALTER TABLE "Subscription" ADD COLUMN "trialEndingNoticeAt" TIMESTAMP(3);
