import { formatDateInTimeZone } from "@/lib/time-zone";

export type OwnerOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type BarItem = {
  id: string;
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  postalCode: string | null;
  activityType: "RESTAURANT" | "COMPANY";
  owner: OwnerOption;
  memberships: {
    user: OwnerOption;
  }[];
  subscription: {
    planType: "FREE" | "TRIAL" | "PAID" | "LIFETIME";
    status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "UNPAID" | "INACTIVE";
    billingInterval: "MONTHLY" | "YEARLY" | null;
    monthlyDiscountPercent: number;
    currentPeriodEnd: Date | null;
    trialEndsAt: Date | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
  } | null;
};

export type ActivityFilter = "ALL" | "COMPANY" | "RESTAURANT";

const MONTHLY_PRICE = 29.99;
const YEARLY_PRICE = 299;

export function formatDateLabel(value: Date | string | null) {
  if (!value) {
    return "Nessuna data";
  }

  return formatDateInTimeZone(value);
}

export function getActivityLabel(activityType: BarItem["activityType"]) {
  return activityType === "COMPANY" ? "Azienda" : "Ristorazione";
}

export function getSubscriptionLabel(subscription: NonNullable<BarItem["subscription"]>) {
  if (subscription.planType === "FREE") {
    return "Free";
  }

  if (subscription.planType === "LIFETIME") {
    return "Lifetime";
  }

  if (subscription.planType === "TRIAL") {
    return "In prova";
  }

  if (subscription.status === "PAST_DUE" || subscription.status === "UNPAID") {
    return "Da recuperare";
  }

  if (subscription.status === "CANCELED" || subscription.status === "INACTIVE") {
    return "Inattivo";
  }

  return "Attivo";
}

export function getSubscriptionTone(subscription: NonNullable<BarItem["subscription"]>) {
  if (subscription.planType === "FREE" || subscription.planType === "LIFETIME") {
    return "success" as const;
  }

  if (subscription.planType === "TRIAL") {
    return "warning" as const;
  }

  if (subscription.status === "ACTIVE" || subscription.status === "TRIALING") {
    return "success" as const;
  }

  if (subscription.status === "PAST_DUE" || subscription.status === "UNPAID") {
    return "danger" as const;
  }

  return "neutral" as const;
}

export function getSubscriptionDetail(subscription: NonNullable<BarItem["subscription"]>) {
  if (subscription.planType === "TRIAL") {
    return `Fine prova: ${formatDateLabel(subscription.trialEndsAt)}`;
  }

  if (subscription.planType === "FREE" || subscription.planType === "LIFETIME") {
    return "Piano gestito manualmente";
  }

  return `Scadenza: ${formatDateLabel(subscription.currentPeriodEnd)}`;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

function getDiscountMultiplier(discountPercent: number) {
  const normalizedDiscount = Math.max(0, Math.min(100, discountPercent));
  return 1 - normalizedDiscount / 100;
}

export function isRevenueEligible(subscription: NonNullable<BarItem["subscription"]>) {
  return subscription.planType === "PAID" && (subscription.status === "ACTIVE" || subscription.status === "TRIALING");
}

export function getEstimatedMonthlyRevenue(subscription: NonNullable<BarItem["subscription"]>) {
  if (!isRevenueEligible(subscription)) {
    return 0;
  }

  const multiplier = getDiscountMultiplier(subscription.monthlyDiscountPercent ?? 0);

  if (subscription.billingInterval === "YEARLY") {
    return (YEARLY_PRICE * multiplier) / 12;
  }

  return MONTHLY_PRICE * multiplier;
}

export function getEstimatedAnnualRevenue(subscription: NonNullable<BarItem["subscription"]>) {
  if (!isRevenueEligible(subscription)) {
    return 0;
  }

  const multiplier = getDiscountMultiplier(subscription.monthlyDiscountPercent ?? 0);

  if (subscription.billingInterval === "YEARLY") {
    return YEARLY_PRICE * multiplier;
  }

  return MONTHLY_PRICE * 12 * multiplier;
}

export function getRevenueSummary(subscription: BarItem["subscription"]) {
  if (!subscription) {
    return {
      title: "Ricavo",
      value: "Nessun piano collegato",
      detail: "Aggiungi un abbonamento per vedere il valore economico.",
    };
  }

  if (subscription.planType === "FREE" || subscription.planType === "LIFETIME") {
    return {
      title: "Ricavo",
      value: "Gestione manuale",
      detail: "Il piano non genera un canone automatico.",
    };
  }

  const monthlyRevenue = getEstimatedMonthlyRevenue(subscription);
  const annualRevenue = getEstimatedAnnualRevenue(subscription);

  return {
    title: subscription.planType === "TRIAL" ? "Ricavo potenziale" : "Ricavo stimato",
    value: `${formatCurrency(monthlyRevenue)}/mese`,
    detail: `${formatCurrency(annualRevenue)}/anno`,
  };
}

export function getAdditionalOwnersForBar(bar: Pick<BarItem, "owner" | "memberships">) {
  return bar.memberships
    .map((membership) => membership.user)
    .filter((owner) => owner.id !== bar.owner.id);
}

export function getOwnerSummaryLabel(primary: OwnerOption, additionalOwners: OwnerOption[]) {
  if (additionalOwners.length === 0) {
    return `${primary.firstName} ${primary.lastName}`;
  }

  return `${primary.firstName} ${primary.lastName} + ${additionalOwners.length} titolari`;
}
