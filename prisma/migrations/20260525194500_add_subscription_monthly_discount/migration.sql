ALTER TABLE "Subscription"
ADD COLUMN IF NOT EXISTS "monthlyDiscountPercent" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Subscription"
ADD COLUMN IF NOT EXISTS "stripeDiscountCouponId" TEXT;
