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
