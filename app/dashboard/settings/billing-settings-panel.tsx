import { BillingInterval, PlanType, SubscriptionStatus } from "@prisma/client";
import type { BillingStatusResult } from "@/lib/billing";
import { BillingCheckoutClient } from "@/app/billing/billing-checkout-client";
import { Panel, StatusPill } from "../ui";

function formatPlan(planType: PlanType) {
  if (planType === PlanType.FREE) {
    return "Free";
  }

  if (planType === PlanType.TRIAL) {
    return "Trial";
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
      return "In trial";
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
          tone={status.canAccess ? "success" : "danger"}
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
          Rinnovo / scadenza: {formatNullableDate(status.currentPeriodEnd)}
          <br />
          Fine trial: {formatNullableDate(status.trialEndsAt)}
        </div>

        {isManagedOutsideStripe ? (
          <div style={{ color: "#166534", lineHeight: 1.7 }}>
            Questo locale e sbloccato da un piano gestito manualmente dal super admin.
          </div>
        ) : requiresTrialCardSetup ? (
          <div style={{ color: "#92400e", lineHeight: 1.7 }}>
            Per attivare il periodo di prova devi inserire una carta su Stripe. La prova
            dura sempre 30 giorni: non verra addebitato nulla adesso.
          </div>
        ) : isTrialReady ? (
          <div style={{ color: "#166534", lineHeight: 1.7 }}>
            Carta salvata correttamente. Il locale e in prova e il piano scelto si
            rinnovera automaticamente alla fine del periodo indicato.
          </div>
        ) : isPaidActive ? (
          <div style={{ color: "#166534", lineHeight: 1.7 }}>
            Abbonamento attivo. Il locale e sbloccato e operativo.
          </div>
        ) : status.status === SubscriptionStatus.CANCELED ? (
          <div style={{ color: "#991b1b", lineHeight: 1.7 }}>
            Abbonamento disattivato. Il locale resta bloccato finche non attivi un nuovo piano.
          </div>
        ) : status.status === SubscriptionStatus.PAST_DUE ||
          status.status === SubscriptionStatus.UNPAID ? (
          <div style={{ color: "#991b1b", lineHeight: 1.7 }}>
            Il pagamento non risulta valido. Rinnova l'abbonamento per sbloccare il locale.
          </div>
        ) : (
          <div style={{ color: "#475569", lineHeight: 1.7 }}>
            L'abbonamento non e attivo. Per usare turni, timbrature, mansioni, richieste e report serve un piano attivo.
          </div>
        )}

        <BillingCheckoutClient
          canActivate={canActivateCheckout}
          canCancel={canCancelSubscription}
          trialSetupRequired={requiresTrialCardSetup}
        />
      </div>
    </Panel>
  );
}
