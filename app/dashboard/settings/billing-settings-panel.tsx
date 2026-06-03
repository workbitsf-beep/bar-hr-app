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

function formatStatus(status: SubscriptionStatus) {
  switch (status) {
    case SubscriptionStatus.ACTIVE:
      return "Attivo";
    case SubscriptionStatus.TRIALING:
      return "In prova";
    case SubscriptionStatus.PAST_DUE:
      return "Pagamento fallito";
    case SubscriptionStatus.CANCELED:
      return "Cancellato";
    case SubscriptionStatus.UNPAID:
      return "Non pagato";
    default:
      return "Inattivo";
  }
}

function formatNullableDate(value: Date | null) {
  if (!value) {
    return "Non disponibile";
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
  }).format(value);
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

  return (
    <Panel
      title="Abbonamento"
      action={
        <StatusPill
          label={formatStatus(status.status)}
          tone={status.canAccess && !status.requiresActivation ? "success" : "danger"}
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

        {isManagedOutsideStripe ? (
          <div style={{ color: "#166534", lineHeight: 1.7 }}>Piano gestito manualmente.</div>
        ) : requiresTrialCardSetup ? (
          <div style={{ color: "#92400e", lineHeight: 1.7 }}>Serve una carta per avviare la prova.</div>
        ) : isTrialReady ? (
          <div style={{ color: "#166534", lineHeight: 1.7 }}>Prova attiva.</div>
        ) : isPaidActive ? (
          <div style={{ color: "#166534", lineHeight: 1.7 }}>Abbonamento attivo.</div>
        ) : status.status === SubscriptionStatus.CANCELED ? (
          <div style={{ color: "#991b1b", lineHeight: 1.7 }}>Abbonamento disattivato.</div>
        ) : status.status === SubscriptionStatus.PAST_DUE ||
          status.status === SubscriptionStatus.UNPAID ? (
          <div style={{ color: "#991b1b", lineHeight: 1.7 }}>Pagamento non valido.</div>
        ) : (
          <div style={{ color: "#475569", lineHeight: 1.7 }}>Piano non attivo.</div>
        )}

        {status.isInGracePeriod ? (
          <div style={{ color: "#166534", lineHeight: 1.7 }}>
            Tolleranza attiva fino al {formatNullableDate(status.gracePeriodEndsAt)}.
          </div>
        ) : null}

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
