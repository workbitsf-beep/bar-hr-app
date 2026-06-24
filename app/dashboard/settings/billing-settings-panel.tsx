import { BillingInterval, PlanType, SubscriptionStatus } from "@prisma/client";
import type { BillingStatusResult } from "@/lib/billing";
import { BillingCheckoutClient } from "@/app/billing/billing-checkout-client";
import { Panel, StatusPill } from "../ui";

function formatPlan(planType: PlanType) {
  if (planType === PlanType.FREE) {
    return "Free";
  }

  if (planType === PlanType.TRIAL) {
    return "In prova";
  }

  if (planType === PlanType.LIFETIME) {
    return "Lifetime";
  }

  return "Paid";
}

function formatInterval(interval: BillingInterval | null) {
  if (interval === BillingInterval.MONTHLY) {
    return "Mensile";
  }

  if (interval === BillingInterval.YEARLY) {
    return "Annuale";
  }

  return "Non impostato";
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

  return {
    label: "Disattivato",
    tone: "neutral" as const,
    message: status.requiresActivation
      ? "Inserisci un metodo di pagamento per attivare il servizio."
      : "Abbonamento disattivato.",
    messageColor: status.requiresActivation ? "#92400e" : "#475569",
  };
}

export function BillingSettingsPanel({
  activeBarName,
  status,
}: {
  activeBarName: string | null;
  status: BillingStatusResult;
}) {
  const isManagedOutsideStripe =
    status.planType === PlanType.FREE || status.planType === PlanType.LIFETIME;
  const requiresTrialCardSetup =
    status.planType === PlanType.TRIAL &&
    Boolean(status.trialEndsAt) &&
    !status.stripeSubscriptionId;
  const isTrialReady =
    status.planType === PlanType.TRIAL &&
    status.status === SubscriptionStatus.TRIALING &&
    Boolean(status.stripeSubscriptionId);
  const isPaidActive =
    status.planType === PlanType.PAID &&
    (status.status === SubscriptionStatus.ACTIVE ||
      status.status === SubscriptionStatus.TRIALING);
  const canActivateCheckout =
    !isManagedOutsideStripe && !isPaidActive && !isTrialReady;
  const canCancelSubscription =
    (status.planType === PlanType.PAID || isTrialReady) &&
    status.status !== SubscriptionStatus.CANCELED &&
    (status.status !== SubscriptionStatus.INACTIVE ||
      Boolean(status.stripeSubscriptionId) ||
      Boolean(status.stripeCustomerId) ||
      Boolean(status.currentPeriodEnd));
  const billingDisplay = getBillingDisplay(status);

  return (
    <Panel
      title="Abbonamento"
      action={
        <StatusPill
          label={billingDisplay.label}
          tone={billingDisplay.tone}
        />
      }
    >
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ color: "#334155", lineHeight: 1.7 }}>
          Locale: {activeBarName ?? "Locale attivo"}
          <br />
          Piano: {formatPlan(status.planType)}
          <br />
          Intervallo: {formatInterval(status.billingInterval)}
          <br />
          Sconto mensile: {status.monthlyDiscountPercent > 0 ? `${status.monthlyDiscountPercent}%` : "Nessuno"}
          <br />
          Rinnovo / scadenza: {formatNullableDate(status.currentPeriodEnd)}
          <br />
          Fine trial: {formatNullableDate(status.trialEndsAt)}
        </div>

        <div style={{ color: billingDisplay.messageColor, lineHeight: 1.7 }}>{billingDisplay.message}</div>

        {status.monthlyDiscountPercent > 0 ? (
          <div style={{ color: "#166534", lineHeight: 1.7 }}>
            Sconto mensile attivo: {status.monthlyDiscountPercent}%.
          </div>
        ) : null}

        <BillingCheckoutClient
          canActivate={canActivateCheckout}
          canCancel={canCancelSubscription}
          trialSetupRequired={requiresTrialCardSetup}
          monthlyDiscountPercent={status.monthlyDiscountPercent}
        />
      </div>
    </Panel>
  );
}
