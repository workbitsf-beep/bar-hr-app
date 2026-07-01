import Link from "next/link";
import { ActivityType, BillingInterval, PlanType, Role, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SuperAdminHomeCreateActions } from "./home-create-actions";

const MONTHLY_PRICE = 29.99;
const YEARLY_PRICE = 299;

type RevenueActivity = {
  name: string;
  activityType: ActivityType;
  owner: {
    firstName: string;
    lastName: string;
  };
  subscription: {
    planType: PlanType;
    status: SubscriptionStatus;
    billingInterval: BillingInterval | null;
    monthlyDiscountPercent: number;
    currentPeriodEnd: Date | null;
  } | null;
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

function getActivityLabel(activityType: ActivityType) {
  return activityType === ActivityType.COMPANY ? "Azienda" : "Ristorazione";
}

function getDiscountMultiplier(discountPercent: number) {
  return 1 - Math.max(0, Math.min(100, discountPercent)) / 100;
}

function isPaidActive(activity: RevenueActivity) {
  return (
    activity.subscription?.planType === PlanType.PAID &&
    (activity.subscription.status === SubscriptionStatus.ACTIVE ||
      activity.subscription.status === SubscriptionStatus.TRIALING)
  );
}

function getEstimatedMonthlyRevenue(activity: RevenueActivity) {
  if (!isPaidActive(activity)) return 0;

  const multiplier = getDiscountMultiplier(activity.subscription?.monthlyDiscountPercent ?? 0);

  return activity.subscription?.billingInterval === BillingInterval.YEARLY
    ? (YEARLY_PRICE * multiplier) / 12
    : MONTHLY_PRICE * multiplier;
}

function getEstimatedAnnualRevenue(activity: RevenueActivity) {
  if (!isPaidActive(activity)) return 0;

  const multiplier = getDiscountMultiplier(activity.subscription?.monthlyDiscountPercent ?? 0);

  return activity.subscription?.billingInterval === BillingInterval.YEARLY
    ? YEARLY_PRICE * multiplier
    : MONTHLY_PRICE * 12 * multiplier;
}

function statusLabel(planType: PlanType, status: SubscriptionStatus) {
  if (planType === PlanType.FREE) return "Free";
  if (planType === PlanType.LIFETIME) return "Lifetime";
  if (planType === PlanType.TRIAL || status === SubscriptionStatus.TRIALING) return "In prova";
  if (status === SubscriptionStatus.ACTIVE) return "Attivo";
  if (status === SubscriptionStatus.PAST_DUE) return "In scadenza";
  if (status === SubscriptionStatus.UNPAID) return "Scaduto";
  return "Disattivato";
}

function AdminMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="sa-lite-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

export async function SuperAdminHomeHub() {
  const [
    activityCounts,
    ownerCount,
    staffCount,
    subscriptions,
    ownerOptions,
    recentActivities,
    billingStatusCounts,
  ] = await Promise.all([
    prisma.bar.groupBy({ by: ["activityType"], _count: { _all: true } }),
    prisma.user.count({ where: { role: Role.OWNER } }),
    prisma.user.count({ where: { role: { in: [Role.MANAGER, Role.AMMINISTRAZIONE, Role.EMPLOYEE] } } }),
    prisma.subscription.findMany({
      where: {
        OR: [
          { planType: PlanType.PAID, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] } },
          { planType: PlanType.TRIAL },
        ],
      },
      select: {
        planType: true,
        status: true,
        billingInterval: true,
        monthlyDiscountPercent: true,
        currentPeriodEnd: true,
        bar: {
          select: {
            name: true,
            activityType: true,
            owner: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: Role.OWNER },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 200,
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    prisma.bar.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        name: true,
        activityType: true,
        owner: { select: { firstName: true, lastName: true } },
        subscription: {
          select: {
            planType: true,
            status: true,
            currentPeriodEnd: true,
          },
        },
      },
    }),
    prisma.subscription.groupBy({
      by: ["planType", "status"],
      _count: { _all: true },
    }),
  ]);

  const companyCount = activityCounts.find((entry) => entry.activityType === ActivityType.COMPANY)?._count._all ?? 0;
  const restaurantCount =
    activityCounts.find((entry) => entry.activityType === ActivityType.RESTAURANT)?._count._all ?? 0;
  const totalActivities = companyCount + restaurantCount;
  const revenueActivities: RevenueActivity[] = subscriptions.map((subscription) => ({
    ...subscription.bar,
    subscription: {
      planType: subscription.planType,
      status: subscription.status,
      billingInterval: subscription.billingInterval,
      monthlyDiscountPercent: subscription.monthlyDiscountPercent,
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
  }));
  const monthlyRevenue = revenueActivities.reduce((sum, activity) => sum + getEstimatedMonthlyRevenue(activity), 0);
  const annualRevenue = revenueActivities.reduce((sum, activity) => sum + getEstimatedAnnualRevenue(activity), 0);
  const activeBillingCount = billingStatusCounts.reduce(
    (sum, bucket) =>
      sum +
      (bucket.status === SubscriptionStatus.ACTIVE || bucket.status === SubscriptionStatus.TRIALING
        ? bucket._count._all
        : 0),
    0
  );
  const riskBillingCount = billingStatusCounts.reduce(
    (sum, bucket) =>
      sum +
      (bucket.status === SubscriptionStatus.PAST_DUE ||
      bucket.status === SubscriptionStatus.UNPAID ||
      bucket.status === SubscriptionStatus.CANCELED ||
      bucket.status === SubscriptionStatus.INACTIVE
        ? bucket._count._all
        : 0),
    0
  );
  const topRevenueActivities = revenueActivities
    .map((activity) => ({
      ...activity,
      monthlyRevenue: getEstimatedMonthlyRevenue(activity),
    }))
    .filter((activity) => activity.monthlyRevenue > 0)
    .sort((a, b) => b.monthlyRevenue - a.monthlyRevenue)
    .slice(0, 5);

  return (
    <div className="sa-lite">
      <section className="sa-lite-hero">
        <div>
          <span className="sa-lite-eyebrow">Controllo rapido</span>
          <h2>{formatCurrency(annualRevenue)} / anno</h2>
          <p>
            Vista sintetica su attività, titolari e abbonamenti. I dettagli operativi sono separati
            nelle sezioni sotto, senza doppioni.
          </p>
        </div>
        <SuperAdminHomeCreateActions owners={ownerOptions} />
      </section>

      <section className="sa-lite-metrics" aria-label="Metriche principali">
        <AdminMetric
          label="Attività"
          value={String(totalActivities)}
          detail={`${restaurantCount} ristorazione · ${companyCount} aziende`}
        />
        <AdminMetric
          label="Ricavi"
          value={formatCurrency(monthlyRevenue)}
          detail={`${formatCurrency(annualRevenue)} stimati all'anno`}
        />
        <AdminMetric
          label="Persone"
          value={String(ownerCount + staffCount)}
          detail={`${ownerCount} titolari · ${staffCount} staff`}
        />
        <AdminMetric
          label="Abbonamenti"
          value={String(activeBillingCount)}
          detail={riskBillingCount > 0 ? `${riskBillingCount} da verificare` : "tutto regolare"}
        />
      </section>

      <section className="sa-lite-grid">
        <article className="sa-lite-card">
          <div className="sa-lite-card-head">
            <div>
              <span className="sa-lite-eyebrow">Azioni</span>
              <h3>Cosa gestire</h3>
            </div>
          </div>
          <div className="sa-lite-actions">
            <Link href="/dashboard/super-admin/bars">Attività</Link>
            <Link href="/dashboard/super-admin/owners">Titolari</Link>
            <Link href="/dashboard/super-admin/billing">Abbonamenti</Link>
            <Link href="/dashboard/super-admin/system">Sistema</Link>
          </div>
        </article>

        <article className="sa-lite-card">
          <div className="sa-lite-card-head">
            <div>
              <span className="sa-lite-eyebrow">Ricavi</span>
              <h3>Attività più redditizie</h3>
            </div>
            <Link href="/dashboard/super-admin/billing">Apri</Link>
          </div>
          <div className="sa-lite-list">
            {topRevenueActivities.length > 0 ? (
              topRevenueActivities.map((activity) => (
                <div key={activity.name} className="sa-lite-row">
                  <div>
                    <strong>{activity.name}</strong>
                    <small>
                      {getActivityLabel(activity.activityType)} · {activity.owner.firstName}{" "}
                      {activity.owner.lastName}
                    </small>
                  </div>
                  <span>{formatCurrency(activity.monthlyRevenue)}</span>
                </div>
              ))
            ) : (
              <p>Nessun abbonamento attivo da conteggiare.</p>
            )}
          </div>
        </article>

        <article className="sa-lite-card">
          <div className="sa-lite-card-head">
            <div>
              <span className="sa-lite-eyebrow">Clienti</span>
              <h3>Ultime attività</h3>
            </div>
            <Link href="/dashboard/super-admin/bars">Cerca</Link>
          </div>
          <div className="sa-lite-list">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="sa-lite-row">
                <div>
                  <strong>{activity.name}</strong>
                  <small>
                    {getActivityLabel(activity.activityType)} · {activity.owner.firstName}{" "}
                    {activity.owner.lastName}
                  </small>
                </div>
                <span>
                  {activity.subscription
                    ? statusLabel(activity.subscription.planType, activity.subscription.status)
                    : "Da attivare"}
                  <small>{formatDate(activity.subscription?.currentPeriodEnd ?? null)}</small>
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .sa-lite {
              display: grid;
              gap: 14px;
              min-width: 0;
            }
            .sa-lite-hero,
            .sa-lite-card,
            .sa-lite-metric {
              border: 1px solid rgba(124, 58, 237, 0.12);
              background: rgba(255, 255, 255, 0.92);
              box-shadow: 0 16px 38px rgba(88, 28, 135, 0.08);
              backdrop-filter: blur(16px);
            }
            .sa-lite-hero {
              display: flex;
              align-items: flex-end;
              justify-content: space-between;
              gap: 18px;
              padding: 26px;
              border-radius: 32px;
              background:
                radial-gradient(circle at 86% 12%, rgba(168, 85, 247, 0.20), transparent 26%),
                linear-gradient(135deg, #ffffff 0%, #f7f3ff 52%, #eef2ff 100%);
            }
            .sa-lite-eyebrow {
              color: #6d28d9;
              font-size: 11px;
              font-weight: 950;
              letter-spacing: .12em;
              text-transform: uppercase;
            }
            .sa-lite-hero h2 {
              margin: 7px 0 8px;
              color: #0f172a;
              font-size: clamp(34px, 6vw, 64px);
              line-height: .96;
              letter-spacing: -.06em;
            }
            .sa-lite-hero p {
              margin: 0;
              max-width: 650px;
              color: #64748b;
              line-height: 1.58;
              font-size: 14px;
            }
            .sa-quick-actions {
              display: flex;
              gap: 8px;
              flex-wrap: wrap;
              justify-content: flex-end;
            }
            .sa-quick-actions button,
            .sa-lite-card-head a,
            .sa-lite-actions a {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              min-height: 38px;
              padding: 0 14px;
              border: 1px solid rgba(124, 58, 237, 0.16);
              border-radius: 999px;
              background: linear-gradient(180deg, #ffffff 0%, #f7f3ff 100%);
              color: #5b21b6;
              text-decoration: none;
              font-size: 12px;
              font-weight: 900;
              cursor: pointer;
            }
            .sa-lite-metrics {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 10px;
            }
            .sa-lite-metric {
              display: grid;
              gap: 6px;
              padding: 16px;
              border-radius: 24px;
            }
            .sa-lite-metric span {
              color: #64748b;
              font-size: 12px;
              font-weight: 850;
            }
            .sa-lite-metric strong {
              color: #0f172a;
              font-size: 29px;
              line-height: 1;
              letter-spacing: -.05em;
            }
            .sa-lite-metric small {
              color: #64748b;
              font-size: 12px;
              line-height: 1.35;
            }
            .sa-lite-grid {
              display: grid;
              grid-template-columns: minmax(0, .8fr) minmax(0, 1.15fr) minmax(0, 1.15fr);
              gap: 12px;
              align-items: start;
            }
            .sa-lite-card {
              display: grid;
              gap: 14px;
              padding: 18px;
              border-radius: 28px;
              min-width: 0;
            }
            .sa-lite-card-head {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 12px;
            }
            .sa-lite-card h3 {
              margin: 4px 0 0;
              color: #0f172a;
              font-size: 19px;
              letter-spacing: -.035em;
            }
            .sa-lite-actions {
              display: grid;
              gap: 8px;
            }
            .sa-lite-actions a {
              width: 100%;
              min-height: 44px;
              justify-content: flex-start;
              padding: 0 16px;
            }
            .sa-lite-list {
              display: grid;
              gap: 8px;
            }
            .sa-lite-list p {
              margin: 0;
              padding: 16px;
              border-radius: 18px;
              background: #f8fafc;
              color: #64748b;
              font-size: 13px;
              font-weight: 750;
            }
            .sa-lite-row {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              padding: 12px;
              border-radius: 18px;
              background: linear-gradient(180deg, #ffffff 0%, #fbf8ff 100%);
              border: 1px solid rgba(124, 58, 237, 0.08);
            }
            .sa-lite-row strong {
              display: block;
              color: #0f172a;
              font-size: 14px;
            }
            .sa-lite-row small {
              display: block;
              color: #64748b;
              font-size: 12px;
              line-height: 1.35;
            }
            .sa-lite-row > span {
              color: #5b21b6;
              font-size: 13px;
              font-weight: 900;
              text-align: right;
              white-space: nowrap;
            }
            @media (max-width: 1020px) {
              .sa-lite-hero { align-items: flex-start; flex-direction: column; }
              .sa-quick-actions { justify-content: flex-start; }
              .sa-lite-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
              .sa-lite-grid { grid-template-columns: 1fr; }
            }
            @media (max-width: 560px) {
              .sa-lite-hero { padding: 20px; border-radius: 26px; }
              .sa-lite-hero h2 { font-size: 40px; }
              .sa-lite-metrics { grid-template-columns: 1fr 1fr; }
              .sa-lite-metric { padding: 13px; border-radius: 20px; }
              .sa-lite-metric strong { font-size: 24px; }
              .sa-lite-row { align-items: flex-start; flex-direction: column; }
              .sa-lite-row > span { text-align: left; }
            }
          `,
        }}
      />
    </div>
  );
}
