-- La dichiarazione di attivita fatta alla registrazione pubblica.
ALTER TABLE "Bar" ADD COLUMN "businessDeclaredAt" TIMESTAMP(3);
ALTER TABLE "Bar" ADD COLUMN "businessDeclaredIp" TEXT;
