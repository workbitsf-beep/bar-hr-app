DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlanType') THEN
    CREATE TYPE "PlanType" AS ENUM ('FREE', 'TRIAL', 'PAID', 'LIFETIME');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BillingInterval') THEN
    CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionStatus') THEN
    CREATE TYPE "SubscriptionStatus" AS ENUM (
      'ACTIVE',
      'TRIALING',
      'PAST_DUE',
      'CANCELED',
      'UNPAID',
      'INACTIVE'
    );
  END IF;
END $$;

ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'ACTIVE';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'TRIALING';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'PAST_DUE';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'CANCELED';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'UNPAID';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'INACTIVE';

ALTER TABLE "Bar"
DROP COLUMN IF EXISTS "subscriptionEndsAt",
DROP COLUMN IF EXISTS "subscriptionNotes",
DROP COLUMN IF EXISTS "subscriptionPlan",
DROP COLUMN IF EXISTS "subscriptionStatus";

DROP TYPE IF EXISTS "SubscriptionPlan";

CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" UUID NOT NULL,
    "barId" UUID NOT NULL,
    "planType" "PlanType" NOT NULL DEFAULT 'PAID',
    "billingInterval" "BillingInterval",
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_barId_key" ON "Subscription"("barId");
CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "Subscription"("status");
CREATE INDEX IF NOT EXISTS "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");
CREATE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX IF NOT EXISTS "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");
CREATE INDEX IF NOT EXISTS "Subscription_trialEndsAt_idx" ON "Subscription"("trialEndsAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Subscription_barId_fkey'
  ) THEN
    ALTER TABLE "Subscription"
    ADD CONSTRAINT "Subscription_barId_fkey"
    FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
