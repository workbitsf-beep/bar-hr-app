import "server-only";

import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2026-04-22.dahlia",
    })
  : null;

export function requireStripe() {
  if (!stripe) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  return stripe;
}

type StripeErrorLike = {
  code?: string;
  statusCode?: number;
  raw?: {
    code?: string;
    statusCode?: number;
    message?: string;
  };
};

export function isStripeMissingResourceError(error: unknown) {
  const stripeError = error as StripeErrorLike | null;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const code = stripeError?.code ?? stripeError?.raw?.code ?? "";

  return (
    code === "resource_missing" ||
    message.includes("no such subscription") ||
    message.includes("resource_missing")
  );
}

export async function cancelStripeSubscriptionSafely(stripeSubscriptionId: string) {
  const client = requireStripe();

  try {
    await client.subscriptions.cancel(stripeSubscriptionId);
    return { ok: true as const, skipped: false as const };
  } catch (error) {
    if (isStripeMissingResourceError(error)) {
      console.warn("[stripe] subscription not found, skipping cancel", {
        stripeSubscriptionId,
        statusCode:
          error && typeof error === "object" && "statusCode" in error
            ? Number((error as StripeErrorLike).statusCode ?? (error as StripeErrorLike).raw?.statusCode ?? 0)
            : undefined,
      });

      return { ok: true as const, skipped: true as const };
    }

    throw error;
  }
}
