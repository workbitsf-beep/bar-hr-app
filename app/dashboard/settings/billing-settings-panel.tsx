import { PlanType, SubscriptionStatus } from "@prisma/client";
import type { BillingStatusResult } from "@/lib/billing";
import type { SeatUsage, VenueEntitlements } from "@/lib/plans";
import { PlanBilling, type PlanStatus, type PurchaseProps } from "./plan-billing";
import type { PlanSelection } from "@/lib/stripe-catalog";

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(value);
}

function formatNullableDate(value: Date | null) {
  if (!value) {
    return "Non disponibile";
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
  }).format(value);
}

function isDateWithinDays(value: Date | null, days: number) {
  if (!value) {
    return false;
  }

  const diffMs = value.getTime() - Date.now();
  return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000;
}

function getBillingDisplay(status: BillingStatusResult) {
  // A charge issued and not yet paid: say how long the venue keeps working.
  if (status.planType === PlanType.PAID && status.paymentDueUntil) {
    return status.canAccess
      ? {
          label: "Pagamento in attesa",
          tone: "warning" as const,
          message: `Il pagamento non risulta ancora. Il locale resta attivo fino al ${formatNullableDate(status.paymentDueUntil)}, poi si blocca finché non arriva.`,
          messageColor: "#92400e",
        }
      : {
          label: "Bloccato",
          tone: "danger" as const,
          message: "Il pagamento non è arrivato entro 7 giorni. Il locale si riattiva appena risulta pagato.",
          messageColor: "#991b1b",
        };
  }

  const isManagedOutsideStripe =
    status.planType === PlanType.FREE || status.planType === PlanType.LIFETIME;
  const relevantEndDate =
    status.planType === PlanType.TRIAL ? status.trialEndsAt : status.currentPeriodEnd;
  const isExpiringSoon = isDateWithinDays(relevantEndDate, 7);

  if (
    isManagedOutsideStripe ||
    (status.canAccess &&
      !status.requiresActivation &&
      status.status !== SubscriptionStatus.PAST_DUE &&
      status.status !== SubscriptionStatus.UNPAID &&
      !status.isInGracePeriod &&
      !isExpiringSoon)
  ) {
    return {
      label: "Attivo",
      tone: "success" as const,
      message: isManagedOutsideStripe ? "Piano attivo gestito manualmente." : "Abbonamento attivo.",
      messageColor: "#166534",
    };
  }

  if (
    status.canAccess &&
    !status.requiresActivation &&
    (status.isInGracePeriod ||
      isExpiringSoon ||
      status.status === SubscriptionStatus.PAST_DUE ||
      status.status === SubscriptionStatus.UNPAID)
  ) {
    return {
      label: "In scadenza",
      tone: "warning" as const,
      message: status.isInGracePeriod
        ? `Periodo di tolleranza attivo fino al ${formatNullableDate(status.gracePeriodEndsAt)}.`
        : `Abbonamento in scadenza il ${formatNullableDate(relevantEndDate)}.`,
      messageColor: "#92400e",
    };
  }

  if (
    status.status === SubscriptionStatus.PAST_DUE ||
    status.status === SubscriptionStatus.UNPAID ||
    (relevantEndDate && relevantEndDate.getTime() < Date.now())
  ) {
    return {
      label: "Scaduto",
      tone: "danger" as const,
      message: "Abbonamento scaduto. Rinnova per riattivare il servizio.",
      messageColor: "#991b1b",
    };
  }

  // A new venue's trial starts once a card is on Stripe (wanted, see the
  // dashboard's route guard). It is a trial waiting for its card, not a
  // switched-off service: "Disattivato" read as if the venue were blocked.
  if (status.planType === PlanType.TRIAL && status.requiresActivation && status.trialEndsAt) {
    const until = formatNullableDate(status.trialEndsAt);
    return {
      label: "In prova",
      tone: "warning" as const,
      message: `30 giorni gratis: inserisci la carta per iniziare. Non paghi niente fino al ${until}, e puoi disdire prima.`,
      messageColor: "#92400e",
    };
  }

  return {
    label: "Disattivato",
    tone: "neutral" as const,
    message: status.requiresActivation
      ? "Inserisci un metodo di pagamento per attivare il servizio."
      : "Abbonamento disattivato.",
    messageColor: status.requiresActivation ? "#92400e" : "#475569",
  };
}

const TONE: Record<string, PlanStatus["tone"]> = { success: "ok", warning: "warn", danger: "bad", neutral: "off" };

/**
 * The venue's plan and subscription, one screen (Impostazioni → Abbonamento):
 * the state in one line, then the plan with its extras, changed in place on
 * the web. Replaces the plan summary, the extras list and the subscription
 * card that each said part of the same thing.
 */
export function BillingSettingsPanel({
  status,
  purchase = null,
  entitlements,
  seats,
  company,
  requested = null,
}: {
  status: BillingStatusResult;
  /** The plan picker's starting point; only the owner gets one. */
  purchase?: PurchaseProps | null;
  entitlements: VenueEntitlements;
  seats: SeatUsage | null;
  company: boolean;
  requested?: Partial<PlanSelection> | null;
}) {
  const isManagedOutsideStripe = status.planType === PlanType.FREE || status.planType === PlanType.LIFETIME;
  const requiresTrialCardSetup = status.planType === PlanType.TRIAL && Boolean(status.trialEndsAt) && !status.stripeSubscriptionId;
  const isTrialReady =
    status.planType === PlanType.TRIAL && status.status === SubscriptionStatus.TRIALING && Boolean(status.stripeSubscriptionId);
  const isPaidActive =
    status.planType === PlanType.PAID &&
    (status.status === SubscriptionStatus.ACTIVE || status.status === SubscriptionStatus.TRIALING);
  const canActivateCheckout = !isManagedOutsideStripe && !isPaidActive && !isTrialReady;
  const canCancelSubscription =
    !isManagedOutsideStripe &&
    (status.planType === PlanType.PAID || isTrialReady) &&
    status.status !== SubscriptionStatus.CANCELED &&
    // Something to cancel: a live status, or at least a Stripe subscription.
    (status.status !== SubscriptionStatus.INACTIVE || Boolean(status.stripeSubscriptionId));
  const display = getBillingDisplay(status);

  const when = status.currentPeriodEnd
    ? `Rinnova il ${formatShortDate(status.currentPeriodEnd)}`
    : status.planType === PlanType.TRIAL && status.trialEndsAt
      ? `Prova fino al ${formatShortDate(status.trialEndsAt)}`
      : status.planType === PlanType.LIFETIME
        ? "A vita"
        : status.planType === PlanType.FREE
          ? "Gratuito"
          : null;
  const noun = seats?.used === 1 ? "persona" : "persone";
  const people = seats ? (seats.limit === null ? `${seats.used} ${noun}` : `${seats.used} ${noun} su ${seats.limit}`) : null;
  const planStatus: PlanStatus = {
    tone: TONE[display.tone] ?? "off",
    label: display.label,
    detail: [when, people].filter(Boolean).join(" · "),
    notice: display.tone === "success" ? null : display.message,
  };

  return (
    <PlanBilling
      status={planStatus}
      company={company}
      owned={{
        plan: entitlements.custom ? "CUSTOM" : entitlements.pro ? "PRO" : "BASE",
        departments: entitlements.departments,
        seatPacks: entitlements.seatPacks,
        branding: entitlements.branding,
        extraSites: entitlements.paidSites,
        siteLimit: entitlements.siteLimit,
      }}
      purchase={purchase}
      canActivate={canActivateCheckout}
      canCancel={canCancelSubscription}
      trialSetupRequired={requiresTrialCardSetup}
      monthlyDiscountPercent={status.monthlyDiscountPercent}
      requested={requested}
    />
  );
}
