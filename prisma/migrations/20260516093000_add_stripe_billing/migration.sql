-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'TRIAL', 'PAID', 'LIFETIME');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- AlterEnum
BEGIN;
CREATE TYPE "SubscriptionStatus_new" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'UNPAID', 'INACTIVE');
ALTER TABLE "public"."Bar" ALTER COLUMN "subscriptionStatus" DROP DEFAULT;
ALTER TABLE "Subscription" ALTER COLUMN "status" TYPE "SubscriptionStatus_new" USING ("status"::text::"SubscriptionStatus_new");
ALTER TYPE "SubscriptionStatus" RENAME TO "SubscriptionStatus_old";
ALTER TYPE "SubscriptionStatus_new" RENAME TO "SubscriptionStatus";
DROP TYPE "public"."SubscriptionStatus_old";
COMMIT;

-- AlterTable
ALTER TABLE "Bar" DROP COLUMN "subscriptionEndsAt",
DROP COLUMN "subscriptionNotes",
DROP COLUMN "subscriptionPlan",
DROP COLUMN "subscriptionStatus";

-- DropEnum
DROP TYPE "SubscriptionPlan";

-- CreateTable
CREATE TABLE "Subscription" (
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

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_barId_key" ON "Subscription"("barId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");

-- CreateIndex
CREATE INDEX "Subscription_trialEndsAt_idx" ON "Subscription"("trialEndsAt");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

