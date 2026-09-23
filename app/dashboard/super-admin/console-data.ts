import type { Tone } from "./console-ui";

export const MONTHLY_PRICE = 29.99;
export const YEARLY_PRICE = 299;

export type PlanType = "FREE" | "TRIAL" | "PAID" | "LIFETIME";
export type BillingStatus = "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "UNPAID" | "INACTIVE";
export type BillingInterval = "MONTHLY" | "YEARLY";

export type SubscriptionShape = {
  planType: PlanType;
  status: BillingStatus;
  billingInterval: BillingInterval | null;
  monthlyDiscountPercent: number;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
} | null;

export type PersonShape = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export function fullName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`.trim();
}

export function formatCurrency(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits,
  }).format(value);
}

export function formatDate(value: Date | string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function toDateInput(value: Date | string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

export function relativeTime(value: Date) {
  const diffMs = Date.now() - new Date(value).getTime();
  const days = Math.floor(diffMs / 86_400_000);

  if (days <= 0) return "oggi";
  if (days === 1) return "ieri";
  if (days < 30) return `${days} giorni fa`;

  const months = Math.floor(days / 30);

  if (months < 12) return `${months} ${months === 1 ? "mese" : "mesi"} fa`;

  const years = Math.floor(months / 12);

  return `${years} ${years === 1 ? "anno" : "anni"} fa`;
}

export function activityLabel(activityType: "RESTAURANT" | "COMPANY") {
  return activityType === "COMPANY" ? "Azienda" : "Ristorazione";
}

export function planLabel(subscription: SubscriptionShape) {
  if (!subscription) return "Nessun piano";
  if (subscription.planType === "FREE") return "Gratuito";
  if (subscription.planType === "LIFETIME") return "A vita";
  if (subscription.planType === "TRIAL") return "In prova";
  if (subscription.status === "PAST_DUE" || subscription.status === "UNPAID") return "Da recuperare";
  if (subscription.status === "CANCELED" || subscription.status === "INACTIVE") return "Inattivo";

  return subscription.billingInterval === "YEARLY" ? "Annuale" : "Mensile";
}

export function planTone(subscription: SubscriptionShape): Tone {
  if (!subscription) return "neutral";
  if (subscription.planType === "FREE" || subscription.planType === "LIFETIME") return "positive";
  if (subscription.planType === "TRIAL") return "warning";
  if (subscription.status === "ACTIVE" || subscription.status === "TRIALING") return "positive";
  if (subscription.status === "PAST_DUE" || subscription.status === "UNPAID") return "negative";

  return "neutral";
}

export function planDeadline(subscription: SubscriptionShape) {
  if (!subscription) return "Nessun abbonamento";
  if (subscription.planType === "TRIAL") return `Prova fino al ${formatDate(subscription.trialEndsAt)}`;
  if (subscription.planType === "FREE" || subscription.planType === "LIFETIME") return "Gestito manualmente";

  return `Scade il ${formatDate(subscription.currentPeriodEnd)}`;
}

/** Mirrors the status the server derives for non-PAID plans. */
export function defaultStatusFor(plan: PlanType): BillingStatus {
  if (plan === "TRIAL") return "TRIALING";
  if (plan === "FREE" || plan === "LIFETIME") return "ACTIVE";

  return "INACTIVE";
}

function discountMultiplier(discountPercent: number) {
  return 1 - Math.max(0, Math.min(100, discountPercent)) / 100;
}

export function billsRevenue(subscription: SubscriptionShape) {
  return Boolean(
    subscription &&
      subscription.planType === "PAID" &&
      (subscription.status === "ACTIVE" || subscription.status === "TRIALING")
  );
}

export function monthlyRevenue(subscription: SubscriptionShape) {
  if (!subscription || !billsRevenue(subscription)) {
    return 0;
  }

  const multiplier = discountMultiplier(subscription.monthlyDiscountPercent ?? 0);

  return subscription.billingInterval === "YEARLY" ? (YEARLY_PRICE * multiplier) / 12 : MONTHLY_PRICE * multiplier;
}

export function annualRevenue(subscription: SubscriptionShape) {
  if (!subscription || !billsRevenue(subscription)) {
    return 0;
  }

  const multiplier = discountMultiplier(subscription.monthlyDiscountPercent ?? 0);

  return subscription.billingInterval === "YEARLY" ? YEARLY_PRICE * multiplier : MONTHLY_PRICE * 12 * multiplier;
}

/** True when the venue can actually be used right now, whatever the plan is. */
export function accessUnlocked(subscription: SubscriptionShape, now = Date.now()) {
  if (!subscription) return false;
  if (subscription.planType === "FREE" || subscription.planType === "LIFETIME") return true;

  if (subscription.planType === "TRIAL") {
    return Boolean(subscription.trialEndsAt && new Date(subscription.trialEndsAt).getTime() > now);
  }

  return subscription.status === "ACTIVE" || subscription.status === "TRIALING";
}

export function roleLabel(role: "OWNER" | "MANAGER" | "EMPLOYEE" | "AMMINISTRAZIONE" | "SUPER_ADMIN") {
  if (role === "OWNER") return "Titolare";
  if (role === "MANAGER") return "Responsabile";
  if (role === "AMMINISTRAZIONE") return "Amministrazione";
  if (role === "SUPER_ADMIN") return "Super admin";

  return "Dipendente";
}

export function readParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}
