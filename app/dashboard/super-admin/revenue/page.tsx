import { BillingInterval, PlanType, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../../context";
import { EmptyState, Panel, Stack, StatusPill } from "../../ui";
import { SuperAdminForbidden, SuperAdminFrame } from "../super-admin-ui";

const MONTHLY_PRICE = 29.99;
const YEARLY_PRICE = 299;

type RevenueSubscription = {
  planType: PlanType;
  status: SubscriptionStatus;
  billingInterval: BillingInterval | null;
  monthlyDiscountPercent: number;
  currentPeriodEnd: Date | null;
  bar: {
    id: string;
    name: string;
    owner: {
      firstName: string;
      lastName: string;
    };
  };
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: Date | null) {
  if (!value) return "Nessuna scadenza";

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function getDiscountMultiplier(discountPercent: number) {
  return 1 - Math.max(0, Math.min(100, discountPercent)) / 100;
}

function canEstimateRevenue(subscription: RevenueSubscription) {
  if (subscription.planType !== PlanType.PAID) return false;

  return (
    subscription.status === SubscriptionStatus.ACTIVE ||
    subscription.status === SubscriptionStatus.TRIALING
  );
}

function getMonthlyRevenue(subscription: RevenueSubscription) {
  if (!canEstimateRevenue(subscription)) return 0;

  const multiplier = getDiscountMultiplier(subscription.monthlyDiscountPercent);

  return subscription.billingInterval === BillingInterval.YEARLY
    ? (YEARLY_PRICE * multiplier) / 12
    : MONTHLY_PRICE * multiplier;
}

function getPlanLabel(subscription: RevenueSubscription) {
  if (subscription.planType === PlanType.FREE) return "Gratuito";
  if (subscription.planType === PlanType.LIFETIME) return "Lifetime";
  if (subscription.status === SubscriptionStatus.TRIALING || subscription.planType === PlanType.TRIAL) {
    return "In prova";
  }

  return subscription.billingInterval === BillingInterval.YEARLY ? "Annuale" : "Mensile";
}

function RevenueMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="revenue-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

export default async function SuperAdminRevenuePage() {
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <SuperAdminForbidden />;
  }

  const subscriptions = await prisma.subscription.findMany({
    orderBy: [{ status: "asc" }, { currentPeriodEnd: "asc" }],
    select: {
      planType: true,
      status: true,
      billingInterval: true,
      monthlyDiscountPercent: true,
      currentPeriodEnd: true,
      bar: {
        select: {
          id: true,
          name: true,
          owner: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  const revenueRows = subscriptions
    .map((subscription) => ({
      ...subscription,
      monthlyRevenue: getMonthlyRevenue(subscription),
    }))
    .sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);
  const payingActivities = revenueRows.filter((row) => row.monthlyRevenue > 0);
  const freeActivities = revenueRows.filter(
    (row) => row.planType === PlanType.FREE || row.planType === PlanType.LIFETIME
  );
  const trialActivities = revenueRows.filter(
    (row) => row.status === SubscriptionStatus.TRIALING || row.planType === PlanType.TRIAL
  );
  const monthlyRevenue = payingActivities.reduce((sum, row) => sum + row.monthlyRevenue, 0);
  const annualRevenue = monthlyRevenue * 12;

  return (
    <SuperAdminFrame
      title="Incassi"
      description="MRR, ARR e ricavi stimati dalle attivita con abbonamento attivo."
    >
      <Stack>
        <section className="revenue-grid" aria-label="Riepilogo incassi">
          <RevenueMetric
            label="Incasso mese"
            value={formatCurrency(monthlyRevenue)}
            detail="Ricorrente stimato"
          />
          <RevenueMetric
            label="Incasso anno"
            value={formatCurrency(annualRevenue)}
            detail="Stima annualizzata"
          />
          <RevenueMetric
            label="Attivita paganti"
            value={String(payingActivities.length)}
            detail={`${trialActivities.length} in prova`}
          />
          <RevenueMetric
            label="Manuali/free"
            value={String(freeActivities.length)}
            detail="Sbloccate senza Stripe"
          />
        </section>

        <Panel title="Attivita per incasso" action={`${payingActivities.length} paganti`}>
          {revenueRows.length === 0 ? (
            <EmptyState message="Nessun abbonamento registrato." />
          ) : (
            <div className="revenue-list">
              {revenueRows.slice(0, 30).map((row) => (
                <article key={row.bar.id} className="revenue-row">
                  <div>
                    <strong>{row.bar.name}</strong>
                    <span>
                      {row.bar.owner.firstName} {row.bar.owner.lastName}
                    </span>
                  </div>
                  <div>
                    <StatusPill label={getPlanLabel(row)} tone={row.monthlyRevenue > 0 ? "success" : "neutral"} />
                    <small>{formatDate(row.currentPeriodEnd)}</small>
                  </div>
                  <b>{formatCurrency(row.monthlyRevenue)}</b>
                </article>
              ))}
            </div>
          )}
        </Panel>

        <style
          dangerouslySetInnerHTML={{
            __html: `
              .revenue-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 12px;
              }
              .revenue-metric {
                display: grid;
                gap: 7px;
                padding: 18px;
                border-radius: 26px;
                border: 1px solid rgba(124, 58, 237, .13);
                background: linear-gradient(145deg, #ffffff 0%, #f7f3ff 100%);
                box-shadow: 0 16px 38px rgba(88, 28, 135, .08);
              }
              .revenue-metric span,
              .revenue-row span,
              .revenue-row small {
                color: #64748b;
                font-size: 12px;
                font-weight: 800;
              }
              .revenue-metric strong {
                color: #0f172a;
                font-size: 30px;
                line-height: 1;
                letter-spacing: -.05em;
              }
              .revenue-list {
                display: grid;
                gap: 8px;
                max-height: 560px;
                overflow: auto;
                padding-right: 2px;
              }
              .revenue-row {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto auto;
                align-items: center;
                gap: 12px;
                padding: 12px;
                border-radius: 18px;
                border: 1px solid rgba(124, 58, 237, .10);
                background: rgba(255,255,255,.92);
              }
              .revenue-row div {
                display: grid;
                gap: 4px;
                min-width: 0;
              }
              .revenue-row strong {
                color: #0f172a;
                font-size: 14px;
              }
              .revenue-row b {
                color: #5b21b6;
                font-size: 15px;
                white-space: nowrap;
              }
              @media (max-width: 880px) {
                .revenue-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                .revenue-row { grid-template-columns: minmax(0, 1fr); }
              }
              @media (max-width: 520px) {
                .revenue-grid { grid-template-columns: 1fr; }
              }
            `,
          }}
        />
      </Stack>
    </SuperAdminFrame>
  );
}
