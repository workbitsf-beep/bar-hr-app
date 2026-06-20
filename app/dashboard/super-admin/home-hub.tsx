import { ActivityType, Role, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Panel } from "../ui";
import { SuperAdminMenuGrid } from "./super-admin-ui";

const MONTHLY_PRICE = 29.99;
const YEARLY_PRICE = 299;

function StatCard({
  code,
  value,
  label,
  detail,
  color,
  tint,
}: {
  code: string;
  value: string;
  label: string;
  detail: string;
  color: string;
  tint: string;
}) {
  return (
    <div
      style={{
        borderRadius: 26,
        border: `1px solid ${color}18`,
        background: `linear-gradient(145deg, #ffffff 25%, ${tint})`,
        padding: 20,
        boxShadow: "0 14px 34px rgba(15, 23, 42, 0.055)",
        display: "grid",
        gap: 9,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span
          aria-hidden="true"
          style={{
            width: 38,
            height: 38,
            borderRadius: 14,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#ffffff",
            color,
            boxShadow: `0 8px 20px ${color}18`,
            fontSize: 12,
            fontWeight: 900,
            flexShrink: 0,
          }}
        >
          {code}
        </span>
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 99, background: color }} />
      </div>
      <strong style={{ fontSize: 31, lineHeight: 1, color: "#172033", letterSpacing: "-0.04em" }}>
        {value}
      </strong>
      <span style={{ fontSize: 14, fontWeight: 800, color: "#344054" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#667085", lineHeight: 1.5 }}>{detail}</span>
    </div>
  );
}

function getActivityCount(
  counts: { activityType: ActivityType; _count: { _all: number } }[],
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
  return 1 - Math.max(0, Math.min(100, discountPercent)) / 100;
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

function getEstimatedMonthlyRevenue(bar: RevenueBar) {
  if (!isRevenueActive(bar)) return 0;
  const multiplier = getDiscountMultiplier(bar.subscription?.monthlyDiscountPercent ?? 0);
  return bar.subscription?.billingInterval === "YEARLY"
    ? (YEARLY_PRICE * multiplier) / 12
    : MONTHLY_PRICE * multiplier;
}

function getEstimatedAnnualRevenue(bar: RevenueBar) {
  if (!isRevenueActive(bar)) return 0;
  const multiplier = getDiscountMultiplier(bar.subscription?.monthlyDiscountPercent ?? 0);
  return bar.subscription?.billingInterval === "YEARLY"
    ? YEARLY_PRICE * multiplier
    : MONTHLY_PRICE * 12 * multiplier;
}

function getTrialPipelineMonthly(bar: RevenueBar) {
  if (bar.subscription?.planType !== "TRIAL") return 0;
  const multiplier = getDiscountMultiplier(bar.subscription.monthlyDiscountPercent);
  return bar.subscription.billingInterval === "YEARLY"
    ? (YEARLY_PRICE * multiplier) / 12
    : MONTHLY_PRICE * multiplier;
}

export async function SuperAdminHomeHub() {
  const [activityCounts, activeBillingCount, ownerCount, staffCount, revenueBars] = await Promise.all([
    prisma.bar.groupBy({ by: ["activityType"], _count: { _all: true } }),
    prisma.subscription.count({
      where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] } },
    }),
    prisma.user.count({ where: { role: Role.OWNER } }),
    prisma.user.count({ where: { role: { in: [Role.MANAGER, Role.EMPLOYEE] } } }),
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
  const activeMonthly = revenueBars.reduce((sum, bar) => sum + getEstimatedMonthlyRevenue(bar), 0);
  const activeAnnual = revenueBars.reduce((sum, bar) => sum + getEstimatedAnnualRevenue(bar), 0);
  const trialPipeline = revenueBars.reduce((sum, bar) => sum + getTrialPipelineMonthly(bar), 0);

  return (
    <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
      <div className="super-admin-stat-grid">
        <StatCard
          code="AT"
          value={String(totalBars)}
          label="Attivita"
          detail={`${companyCount} aziende / ${restaurantCount} ristorazione`}
          color="#7c3aed"
          tint="#f5f3ff"
        />
        <StatCard
          code="OW"
          value={String(ownerCount)}
          label="Titolari"
          detail="Responsabili attivi nel sistema"
          color="#2563eb"
          tint="#eff6ff"
        />
        <StatCard
          code="HR"
          value={String(staffCount)}
          label="Staff"
          detail="Manager e dipendenti collegati"
          color="#0891b2"
          tint="#ecfeff"
        />
        <StatCard
          code="OK"
          value={String(activeBillingCount)}
          label="Abbonamenti attivi"
          detail="Clienti operativi e sbloccati"
          color="#059669"
          tint="#ecfdf5"
        />
      </div>

      <section className="super-admin-revenue-card">
        <div style={{ display: "grid", gap: 8 }}>
          <span className="super-admin-revenue-label">Revenue snapshot</span>
          <strong className="super-admin-revenue-main">{formatCurrency(activeMonthly)}</strong>
          <span className="super-admin-revenue-muted">Ricavo mensile stimato</span>
        </div>
        <div className="super-admin-revenue-mini">
          <strong>{formatCurrency(activeAnnual)}</strong>
          <span>Proiezione annuale</span>
        </div>
        <div className="super-admin-revenue-mini">
          <strong>{formatCurrency(trialPipeline)}</strong>
          <span>Pipeline trial</span>
        </div>
      </section>

      <Panel title="Dove vuoi lavorare?" action="4 aree operative">
        <SuperAdminMenuGrid />
      </Panel>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .super-admin-stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
            .super-admin-revenue-card {
              display: grid;
              grid-template-columns: minmax(0, 1.4fr) repeat(2, minmax(150px, .6fr));
              gap: 12px;
              padding: 22px;
              border-radius: 28px;
              color: #fff;
              background: radial-gradient(circle at 92% 15%, rgba(255,255,255,.16), transparent 24%), linear-gradient(135deg, #064e3b, #047857 55%, #10b981);
              box-shadow: 0 20px 46px rgba(5,150,105,.18);
            }
            .super-admin-revenue-label { color: rgba(255,255,255,.68); font-size: 11px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
            .super-admin-revenue-main { font-size: 36px; line-height: 1; letter-spacing: -.045em; }
            .super-admin-revenue-muted { color: rgba(255,255,255,.72); font-size: 13px; }
            .super-admin-revenue-mini { display: grid; align-content: center; gap: 5px; padding: 14px; border-radius: 20px; background: rgba(255,255,255,.10); border: 1px solid rgba(255,255,255,.13); }
            .super-admin-revenue-mini strong { font-size: 21px; }
            .super-admin-revenue-mini span { color: rgba(255,255,255,.70); font-size: 12px; }
            @media (max-width: 980px) { .super-admin-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
            @media (max-width: 720px) { .super-admin-revenue-card { grid-template-columns: 1fr; } }
            @media (max-width: 520px) { .super-admin-stat-grid { grid-template-columns: 1fr 1fr; } }
          `,
        }}
      />
    </div>
  );
}
