import { BillingInterval, PlanType, Role, SubscriptionStatus } from "@prisma/client";
import { getBillingStatus } from "@/lib/billing";
import { getDashboardContext } from "@/app/dashboard/context";
import {
  EmptyState,
  Panel,
  Stack,
  StatusPill,
} from "@/app/dashboard/ui";
import { BillingCheckoutClient } from "./billing-checkout-client";

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

function formatDate(value: Date | null) {
  if (!value) {
    return "Non disponibile";
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
  }).format(value);
}

export default async function BillingPage() {
  const { role, activeBarId, activeBarName, billingStatus } = await getDashboardContext(true);

  if (String(role) === "SUPER_ADMIN") {
    return (
      <Panel title="Billing">
        <EmptyState message="Il super admin gestisce i piani dalla console dedicata." />
      </Panel>
    );
  }

  if (!activeBarId) {
    return (
      <Panel title="Billing">
        <EmptyState message="Seleziona un locale attivo per gestire l'abbonamento." />
      </Panel>
    );
  }

  if (role !== Role.OWNER) {
    return (
      <Panel title="Billing">
        <EmptyState message="Solo il titolare puo gestire l'abbonamento del locale." />
      </Panel>
    );
  }

  const status = billingStatus ?? (await getBillingStatus(activeBarId));
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
    <Stack columns="repeat(auto-fit, minmax(320px, 1fr))">
      <Panel title="Stato abbonamento" action={<StatusPill label={formatStatus(status.status)} tone={status.canAccess ? "success" : "danger"} />}>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ color: "#334155", lineHeight: 1.7 }}>
            Locale: {activeBarName ?? "Locale attivo"}
            <br />
            Piano: {formatPlan(status.planType)}
            <br />
            Intervallo: {formatInterval(status.billingInterval)}
            <br />
            Rinnovo / scadenza: {formatDate(status.currentPeriodEnd)}
            <br />
            Fine trial: {formatDate(status.trialEndsAt)}
          </div>

          {isManagedOutsideStripe ? (
            <div style={{ color: "#166534", lineHeight: 1.7 }}>
              Questo locale e sbloccato da un piano gestito manualmente dal super admin.
            </div>
          ) : requiresTrialCardSetup ? (
            <div style={{ color: "#92400e", lineHeight: 1.7 }}>
              Per attivare il periodo di prova devi inserire una carta su Stripe. La prova
              dura sempre 30 giorni: non verra addebitato nulla adesso e, alla fine dei
              30 giorni, il piano scelto si rinnovera automaticamente.
            </div>
          ) : null}

          {requiresTrialCardSetup ? (
            <div
              style={{
                display: "grid",
                gap: 10,
                padding: 16,
                borderRadius: 20,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                color: "#334155",
                lineHeight: 1.7,
              }}
            >
              <div>
                <strong>Avvia la prova e poi rinnovo mensile</strong>
                <br />
                Dopo i 30 giorni di prova partira l'abbonamento mensile da 29,99 EUR.
              </div>
              <div>
                <strong>Avvia la prova e poi rinnovo annuale</strong>
                <br />
                Dopo i 30 giorni di prova partira l'abbonamento annuale da 299 EUR.
              </div>
            </div>
          ) : isTrialReady ? (
            <div style={{ color: "#166534", lineHeight: 1.7 }}>
              Carta salvata correttamente. Il locale e in prova per 30 giorni e il piano
              scelto si rinnovera automaticamente alla fine del periodo indicato.
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
    </Stack>
  );
}
