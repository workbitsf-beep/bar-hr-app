import { ActivityType, Role, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Panel, Stack } from "../ui";
import { SuperAdminMenuGrid } from "./super-admin-ui";

const MONTHLY_PRICE = 29.99;
const YEARLY_PRICE = 299;

function StatCard({
  emoji,
  value,
  label,
  detail,
}: {
  emoji: string;
  value: string;
  label: string;
  detail: string;
}) {
  return (
    <div
      style={{
        borderRadius: 24,
        border: "1px solid #e2e8f0",
        background: "#ffffff",
        padding: 18,
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
        display: "grid",
        gap: 10,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span
          aria-hidden="true"
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(124, 58, 237, 0.12)",
            color: "#6d28d9",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {emoji}
        </span>
      </div>
      <strong style={{ fontSize: 28, lineHeight: 1, color: "#0f172a" }}>{value}</strong>
      <span style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{detail}</span>
    </div>
  );
}

function getActivityCount(
  counts: {
    activityType: ActivityType;
    _count: {
      _all: number;
    };
  }[],
  activityType: ActivityType
) {
  return counts.find((entry) => entry.activityType === activityType)?._count._all ?? 0;
}

function formatCurrency(value: number) {
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

type RevenueBar = {
  subscription: {
    planType: "FREE" | "TRIAL" | "PAID" | "LIFETIME";
    status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "UNPAID" | "INACTIVE";
    billingInterval: "MONTHLY" | "YEARLY" | null;
    monthlyDiscountPercent: number;
  } | null;
};

function isRevenueActive(bar: RevenueBar) {
  return (
    bar.subscription?.planType === "PAID" &&
    (bar.subscription.status === "ACTIVE" || bar.subscription.status === "TRIALING")
  );
}

function isTrialPending(bar: RevenueBar) {
  return bar.subscription?.planType === "TRIAL";
}

function getEstimatedMonthlyRevenue(bar: RevenueBar) {
  if (!isRevenueActive(bar)) {
    return 0;
  }

  const multiplier = getDiscountMultiplier(bar.subscription?.monthlyDiscountPercent ?? 0);

  if (bar.subscription?.billingInterval === "YEARLY") {
    return (YEARLY_PRICE * multiplier) / 12;
  }

  return MONTHLY_PRICE * multiplier;
}

function getEstimatedAnnualRevenue(bar: RevenueBar) {
  if (!isRevenueActive(bar)) {
    return 0;
  }

  const multiplier = getDiscountMultiplier(bar.subscription?.monthlyDiscountPercent ?? 0);

  if (bar.subscription?.billingInterval === "YEARLY") {
    return YEARLY_PRICE * multiplier;
  }

  return MONTHLY_PRICE * 12 * multiplier;
}

function getTrialPipelineMonthly(bar: RevenueBar) {
  if (!isTrialPending(bar)) {
    return 0;
  }

  const multiplier = getDiscountMultiplier(bar.subscription?.monthlyDiscountPercent ?? 0);

  if (bar.subscription?.billingInterval === "YEARLY") {
    return (YEARLY_PRICE * multiplier) / 12;
  }

  return MONTHLY_PRICE * multiplier;
}

export async function SuperAdminHomeHub() {
  const [activityCounts, activeBillingCount, ownerCount, staffCount, revenueBars] = await Promise.all([
    prisma.bar.groupBy({
      by: ["activityType"],
      _count: {
        _all: true,
      },
    }),
    prisma.subscription.count({
      where: {
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
        },
      },
    }),
    prisma.user.count({
      where: {
        role: Role.OWNER,
      },
    }),
    prisma.user.count({
      where: {
        role: {
          in: [Role.MANAGER, Role.EMPLOYEE],
        },
      },
    }),
    prisma.bar.findMany({
      select: {
        subscription: {
          select: {
            planType: true,
            status: true,
            billingInterval: true,
            monthlyDiscountPercent: true,
          },
        },
      },
    }),
  ]);

  const companyCount = getActivityCount(activityCounts, ActivityType.COMPANY);
  const restaurantCount = getActivityCount(activityCounts, ActivityType.RESTAURANT);
  const totalBars = companyCount + restaurantCount;
  const totalUsers = ownerCount + staffCount;
  const activeMonthly = revenueBars.reduce((sum, bar) => sum + getEstimatedMonthlyRevenue(bar), 0);
  const activeAnnual = revenueBars.reduce((sum, bar) => sum + getEstimatedAnnualRevenue(bar), 0);
  const trialPipeline = revenueBars.reduce((sum, bar) => sum + getTrialPipelineMonthly(bar), 0);

  return (
    <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
      <Stack columns="repeat(auto-fit, minmax(220px, 1fr))">
        <StatCard
          emoji="🏢"
          value={String(totalBars)}
          label="Attività"
          detail={`${companyCount} aziende · ${restaurantCount} ristorazione`}
        />
        <StatCard
          emoji="👤"
          value={String(ownerCount)}
          label="Titolari"
          detail="Responsabili attivi nel sistema"
        />
        <StatCard
          emoji="👥"
          value={String(staffCount)}
          label="Staff"
          detail={`Totale utenti collegati: ${totalUsers}`}
        />
        <StatCard
          emoji="💳"
          value={String(activeBillingCount)}
          label="Abbonamenti attivi"
          detail="Clienti operativi e sbloccati"
        />
        <StatCard
          emoji="💰"
          value={formatCurrency(activeMonthly)}
          label="Ricavi stimati"
          detail={`Annuale ${formatCurrency(activeAnnual)} · Trial ${formatCurrency(trialPipeline)}`}
        />
      </Stack>

      <Panel title="Accessi rapidi" action="Apri le sezioni">
        <SuperAdminMenuGrid />
        <p style={{ margin: "12px 0 0", color: "#64748b", lineHeight: 1.6 }}>
          Tieni a portata solo ciò che serve: titolari, attività, pagamenti e GPS globale.
        </p>
      </Panel>
    </div>
  );
}
