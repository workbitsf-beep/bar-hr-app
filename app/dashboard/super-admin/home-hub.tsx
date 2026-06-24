import Link from "next/link";
import { ActivityType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MONTHLY_PRICE = 29.99;
const YEARLY_PRICE = 299;

type RevenueBar = {
  activityType: ActivityType;
  createdAt: Date;
  name: string;
  owner: {
    firstName: string;
    lastName: string;
    email: string;
  };
  subscription: {
    planType: "FREE" | "TRIAL" | "PAID" | "LIFETIME";
    status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "UNPAID" | "INACTIVE";
    billingInterval: "MONTHLY" | "YEARLY" | null;
    monthlyDiscountPercent: number;
    currentPeriodEnd: Date | null;
  } | null;
};

type BillingBucket = "active" | "trial" | "risk" | "manual";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
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
  return activityType === ActivityType.COMPANY ? "Aziende" : "Ristorazione";
}

function getDiscountMultiplier(discountPercent: number) {
  return 1 - Math.max(0, Math.min(100, discountPercent)) / 100;
}

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

function getBillingBucket(bar: RevenueBar): BillingBucket {
  const subscription = bar.subscription;

  if (!subscription) return "risk";

  if (subscription.planType === "FREE" || subscription.planType === "LIFETIME") {
    return "manual";
  }

  if (subscription.planType === "TRIAL" || subscription.status === "TRIALING") {
    return "trial";
  }

  if (subscription.status === "ACTIVE") {
    return "active";
  }

  return "risk";
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("it-IT", { month: "short" }).format(date);
}

function getLastMonths(count: number) {
  const now = new Date();

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return {
      key: getMonthKey(date),
      label: getMonthLabel(date),
    };
  });
}

function StatCard({
  icon,
  value,
  label,
  detail,
  tone,
}: {
  icon: string;
  value: string;
  label: string;
  detail: string;
  tone: "violet" | "blue" | "emerald" | "amber";
}) {
  return (
    <div className={`sa-stat-card sa-tone-${tone}`}>
      <span className="sa-stat-icon" aria-hidden="true">
        {icon}
      </span>
      <strong>{value}</strong>
      <span className="sa-stat-label">{label}</span>
      <small>{detail}</small>
    </div>
  );
}

function ProgressBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const percent = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;

  return (
    <div className="sa-progress-row">
      <div className="sa-progress-head">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <span className="sa-progress-track">
        <span className="sa-progress-fill" style={{ width: `${percent}%`, background: color }} />
      </span>
    </div>
  );
}

function RevenueSparkline({
  bars,
  max,
}: {
  bars: Array<{ label: string; value: number }>;
  max: number;
}) {
  return (
    <div className="sa-sparkline" aria-label="Crescita attivita ultimi mesi">
      {bars.map((bar) => {
        const height = max > 0 ? Math.max(12, Math.round((bar.value / max) * 100)) : 12;

        return (
          <div key={bar.label} className="sa-spark-item">
            <span className="sa-spark-bar" style={{ height: `${height}%` }} />
            <small>{bar.label}</small>
          </div>
        );
      })}
    </div>
  );
}

function BillingDonut({ buckets }: { buckets: Record<BillingBucket, number> }) {
  const segments = [
    { key: "active", label: "Attivi", value: buckets.active, color: "#22c55e" },
    { key: "trial", label: "Prova", value: buckets.trial, color: "#f59e0b" },
    { key: "risk", label: "Da seguire", value: buckets.risk, color: "#ef4444" },
    { key: "manual", label: "Manuali", value: buckets.manual, color: "#8b5cf6" },
  ];
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  let cursor = 0;
  const gradient =
    total > 0
      ? segments
          .map((segment) => {
            const start = cursor;
            cursor += (segment.value / total) * 100;
            return `${segment.color} ${start}% ${cursor}%`;
          })
          .join(", ")
      : "#e5e7eb 0% 100%";

  return (
    <div className="sa-donut-grid">
      <div className="sa-donut" style={{ background: `conic-gradient(${gradient})` }}>
        <span>{total}</span>
      </div>
      <div className="sa-donut-legend">
        {segments.map((segment) => (
          <span key={segment.key}>
            <i style={{ background: segment.color }} />
            {segment.label}
            <strong>{segment.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

export async function SuperAdminHomeHub() {
  const [activityCounts, ownerCount, staffCount, revenueBars] = await Promise.all([
    prisma.bar.groupBy({ by: ["activityType"], _count: { _all: true } }),
    prisma.user.count({ where: { role: Role.OWNER } }),
    prisma.user.count({ where: { role: { in: [Role.MANAGER, Role.EMPLOYEE] } } }),
    prisma.bar.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        name: true,
        activityType: true,
        createdAt: true,
        owner: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        subscription: {
          select: {
            planType: true,
            status: true,
            billingInterval: true,
            monthlyDiscountPercent: true,
            currentPeriodEnd: true,
          },
        },
      },
    }),
  ]);

  const companyCount = activityCounts.find((entry) => entry.activityType === ActivityType.COMPANY)?._count._all ?? 0;
  const restaurantCount =
    activityCounts.find((entry) => entry.activityType === ActivityType.RESTAURANT)?._count._all ?? 0;
  const totalBars = companyCount + restaurantCount;
  const activeBillingCount = revenueBars.filter(
    (bar) => bar.subscription?.status === "ACTIVE" || bar.subscription?.status === "TRIALING"
  ).length;
  const activeMonthly = revenueBars.reduce((sum, bar) => sum + getEstimatedMonthlyRevenue(bar), 0);
  const activeAnnual = revenueBars.reduce((sum, bar) => sum + getEstimatedAnnualRevenue(bar), 0);
  const trialPipeline = revenueBars.reduce((sum, bar) => sum + getTrialPipelineMonthly(bar), 0);
  const maxActivityCount = Math.max(companyCount, restaurantCount, 1);
  const billingBuckets = revenueBars.reduce<Record<BillingBucket, number>>(
    (acc, bar) => {
      acc[getBillingBucket(bar)] += 1;
      return acc;
    },
    { active: 0, trial: 0, risk: 0, manual: 0 }
  );
  const months = getLastMonths(6);
  const growthBars = months.map((month) => ({
    label: month.label,
    value: revenueBars.filter((bar) => getMonthKey(bar.createdAt) === month.key).length,
  }));
  const growthMax = Math.max(...growthBars.map((bar) => bar.value), 1);
  const topRevenueBars = revenueBars
    .map((bar) => ({
      ...bar,
      monthlyRevenue: getEstimatedMonthlyRevenue(bar),
    }))
    .sort((a, b) => b.monthlyRevenue - a.monthlyRevenue)
    .slice(0, 5);

  return (
    <div className="sa-command-center">
      <section className="sa-command-hero" aria-label="Panoramica economica">
        <div className="sa-command-copy">
          <span className="sa-eyebrow">⚡ Centro operativo</span>
          <h2>{formatCurrency(activeMonthly)} / mese</h2>
          <p>
            Ricavo ricorrente stimato, con {formatCurrency(trialPipeline)} di pipeline da prove attive e{" "}
            {formatCurrency(activeAnnual)} di proiezione annuale.
          </p>
        </div>
        <div className="sa-command-orbit" aria-hidden="true">
          <span />
          <strong>WB</strong>
        </div>
      </section>

      <div className="sa-stat-grid">
        <StatCard
          icon="🏢"
          value={String(totalBars)}
          label="Attivita"
          detail={`${companyCount} aziende · ${restaurantCount} ristorazione`}
          tone="violet"
        />
        <StatCard
          icon="👤"
          value={String(ownerCount)}
          label="Titolari"
          detail="Account proprietari collegati"
          tone="blue"
        />
        <StatCard
          icon="👥"
          value={String(staffCount)}
          label="Staff"
          detail="Manager e dipendenti attivi"
          tone="amber"
        />
        <StatCard
          icon="✅"
          value={String(activeBillingCount)}
          label="Abbonamenti ok"
          detail="Attivi o in prova"
          tone="emerald"
        />
      </div>

      <section className="sa-grid-main">
        <article className="sa-card sa-card-large">
          <div className="sa-card-head">
            <div>
              <span className="sa-eyebrow">📊 Distribuzione clienti</span>
              <h3>Attivita per settore</h3>
            </div>
            <Link href="/dashboard/super-admin/bars">Apri</Link>
          </div>
          <div className="sa-progress-stack">
            <ProgressBar label="Ristorazione" value={restaurantCount} max={maxActivityCount} color="#7c3aed" />
            <ProgressBar label="Aziende" value={companyCount} max={maxActivityCount} color="#38bdf8" />
          </div>
        </article>

        <article className="sa-card">
          <div className="sa-card-head">
            <div>
              <span className="sa-eyebrow">💳 Billing</span>
              <h3>Stato abbonamenti</h3>
            </div>
            <Link href="/dashboard/super-admin/billing">Gestisci</Link>
          </div>
          <BillingDonut buckets={billingBuckets} />
        </article>

        <article className="sa-card">
          <div className="sa-card-head">
            <div>
              <span className="sa-eyebrow">📈 Crescita</span>
              <h3>Nuove attivita</h3>
            </div>
            <span className="sa-soft-pill">6 mesi</span>
          </div>
          <RevenueSparkline bars={growthBars} max={growthMax} />
        </article>

        <article className="sa-card sa-card-large">
          <div className="sa-card-head">
            <div>
              <span className="sa-eyebrow">💜 Ricavi</span>
              <h3>Attivita che rendono di piu</h3>
            </div>
            <span className="sa-soft-pill">{formatCompactCurrency(activeMonthly)}/mese</span>
          </div>
          <div className="sa-top-list">
            {topRevenueBars.length ? (
              topRevenueBars.map((bar, index) => (
                <div key={`${bar.name}-${index}`} className="sa-top-row">
                  <span className="sa-rank">{index + 1}</span>
                  <div>
                    <strong>{bar.name}</strong>
                    <small>
                      {getActivityLabel(bar.activityType)} · {bar.owner.firstName} {bar.owner.lastName}
                    </small>
                  </div>
                  <div className="sa-top-money">
                    <strong>{formatCurrency(bar.monthlyRevenue)}</strong>
                    <small>{formatDate(bar.subscription?.currentPeriodEnd ?? null)}</small>
                  </div>
                </div>
              ))
            ) : (
              <div className="sa-empty">Nessun ricavo attivo al momento.</div>
            )}
          </div>
        </article>
      </section>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .sa-command-center {
              --sa-ink: #111827;
              --sa-muted: #667085;
              --sa-violet: #6d28d9;
              display: grid;
              gap: 16px;
              min-width: 0;
            }
            .sa-command-hero {
              position: relative;
              overflow: hidden;
              display: grid;
              grid-template-columns: minmax(0, 1fr) 220px;
              gap: 18px;
              min-height: 260px;
              padding: 28px;
              border: 1px solid rgba(124, 58, 237, .16);
              border-radius: 34px;
              background:
                radial-gradient(circle at 78% 20%, rgba(255,255,255,.78), transparent 24%),
                radial-gradient(circle at 16% 88%, rgba(196,181,253,.45), transparent 28%),
                linear-gradient(135deg, #f6f0ff 0%, #ffffff 44%, #e0f2fe 100%);
              box-shadow: 0 24px 70px rgba(88, 28, 135, .12);
            }
            .sa-command-copy {
              position: relative;
              z-index: 1;
              display: grid;
              align-content: center;
              gap: 12px;
              max-width: 760px;
            }
            .sa-eyebrow {
              color: #6d28d9;
              font-size: 11px;
              font-weight: 950;
              letter-spacing: .12em;
              text-transform: uppercase;
            }
            .sa-command-copy h2 {
              margin: 0;
              color: var(--sa-ink);
              font-size: clamp(40px, 7vw, 74px);
              line-height: .92;
              letter-spacing: -.07em;
            }
            .sa-command-copy p {
              margin: 0;
              max-width: 620px;
              color: #475467;
              font-size: 15px;
              line-height: 1.65;
            }
            .sa-card-head a {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              min-height: 38px;
              padding: 0 14px;
              border-radius: 999px;
              color: #111827;
              background: rgba(255,255,255,.86);
              border: 1px solid rgba(124,58,237,.15);
              text-decoration: none;
              font-size: 12px;
              font-weight: 900;
              box-shadow: 0 10px 24px rgba(88,28,135,.08);
            }
            .sa-command-orbit {
              position: relative;
              display: grid;
              place-items: center;
              min-height: 210px;
            }
            .sa-command-orbit span {
              position: absolute;
              width: 190px;
              height: 190px;
              border-radius: 999px;
              border: 18px solid rgba(124,58,237,.12);
              box-shadow: 0 0 0 26px rgba(124,58,237,.045), inset 0 0 40px rgba(124,58,237,.10);
              animation: sa-pulse 4s ease-in-out infinite;
            }
            .sa-command-orbit strong {
              position: relative;
              display: grid;
              place-items: center;
              width: 94px;
              height: 94px;
              border-radius: 30px;
              color: #fff;
              background: linear-gradient(145deg, #111827, #6d28d9);
              font-size: 28px;
              letter-spacing: -.08em;
              box-shadow: 0 24px 44px rgba(109,40,217,.24);
            }
            @keyframes sa-pulse {
              0%, 100% { transform: scale(.96); opacity: .8; }
              50% { transform: scale(1.04); opacity: 1; }
            }
            .sa-stat-grid {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 12px;
            }
            .sa-stat-card,
            .sa-card {
              min-width: 0;
              border: 1px solid rgba(124,58,237,.10);
              border-radius: 28px;
              background: rgba(255,255,255,.86);
              box-shadow: 0 18px 44px rgba(88,28,135,.065);
              backdrop-filter: blur(18px);
            }
            .sa-stat-card {
              display: grid;
              gap: 8px;
              padding: 18px;
            }
            .sa-stat-card strong {
              color: var(--sa-ink);
              font-size: 32px;
              line-height: 1;
              letter-spacing: -.05em;
            }
            .sa-stat-card small,
            .sa-stat-label {
              color: var(--sa-muted);
              font-size: 12px;
              line-height: 1.35;
            }
            .sa-stat-label {
              color: #344054;
              font-size: 14px;
              font-weight: 900;
            }
            .sa-stat-icon {
              width: 40px;
              height: 40px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              border-radius: 16px;
              background: #fff;
              box-shadow: 0 10px 24px rgba(15,23,42,.06);
            }
            .sa-tone-violet { background: linear-gradient(145deg, #fff 30%, #f5f3ff); }
            .sa-tone-blue { background: linear-gradient(145deg, #fff 30%, #eff6ff); }
            .sa-tone-emerald { background: linear-gradient(145deg, #fff 30%, #ecfdf5); }
            .sa-tone-amber { background: linear-gradient(145deg, #fff 30%, #fffbeb); }
            .sa-grid-main {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 14px;
              align-items: start;
            }
            .sa-card {
              display: grid;
              gap: 16px;
              padding: 20px;
            }
            .sa-card-large {
              min-height: 300px;
            }
            .sa-card-head {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 14px;
            }
            .sa-card-head h3 {
              margin: 4px 0 0;
              color: var(--sa-ink);
              font-size: 20px;
              letter-spacing: -.035em;
            }
            .sa-progress-stack {
              display: grid;
              gap: 16px;
              align-content: center;
            }
            .sa-progress-row {
              display: grid;
              gap: 8px;
            }
            .sa-progress-head {
              display: flex;
              justify-content: space-between;
              gap: 12px;
              color: #344054;
              font-size: 13px;
              font-weight: 850;
            }
            .sa-progress-track {
              height: 16px;
              overflow: hidden;
              border-radius: 999px;
              background: #f2f4f7;
              box-shadow: inset 0 0 0 1px rgba(15,23,42,.04);
            }
            .sa-progress-fill {
              display: block;
              height: 100%;
              border-radius: inherit;
            }
            .sa-donut-grid {
              display: grid;
              grid-template-columns: 132px minmax(0, 1fr);
              gap: 18px;
              align-items: center;
            }
            .sa-donut {
              width: 132px;
              height: 132px;
              display: grid;
              place-items: center;
              border-radius: 999px;
              box-shadow: inset 0 0 0 18px rgba(255,255,255,.72);
            }
            .sa-donut span {
              display: grid;
              place-items: center;
              width: 76px;
              height: 76px;
              border-radius: 999px;
              color: #111827;
              background: #fff;
              font-size: 27px;
              font-weight: 950;
              box-shadow: 0 12px 30px rgba(15,23,42,.08);
            }
            .sa-donut-legend {
              display: grid;
              gap: 8px;
            }
            .sa-donut-legend span {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 8px;
              color: #475467;
              font-size: 13px;
              font-weight: 800;
            }
            .sa-donut-legend i {
              width: 9px;
              height: 9px;
              border-radius: 99px;
              margin-right: auto;
            }
            .sa-donut-legend strong {
              color: #111827;
            }
            .sa-sparkline {
              height: 184px;
              display: grid;
              grid-template-columns: repeat(6, minmax(0, 1fr));
              gap: 9px;
              align-items: end;
              padding: 8px 2px 0;
            }
            .sa-spark-item {
              height: 100%;
              display: grid;
              grid-template-rows: 1fr auto;
              gap: 8px;
              align-items: end;
              min-width: 0;
            }
            .sa-spark-bar {
              display: block;
              border-radius: 999px 999px 10px 10px;
              background: linear-gradient(180deg, #8b5cf6, #c4b5fd);
              box-shadow: 0 10px 24px rgba(124,58,237,.18);
            }
            .sa-spark-item small {
              color: #667085;
              font-size: 11px;
              font-weight: 850;
              text-align: center;
              text-transform: capitalize;
            }
            .sa-top-list {
              display: grid;
              gap: 9px;
            }
            .sa-top-row {
              display: grid;
              grid-template-columns: auto minmax(0, 1fr) auto;
              align-items: center;
              gap: 12px;
              padding: 12px;
              border-radius: 20px;
              background: linear-gradient(145deg, #fff, #faf7ff);
              border: 1px solid rgba(124,58,237,.08);
            }
            .sa-rank {
              width: 34px;
              height: 34px;
              display: inline-grid;
              place-items: center;
              border-radius: 13px;
              color: #6d28d9;
              background: #f5f3ff;
              font-size: 13px;
              font-weight: 950;
            }
            .sa-top-row strong {
              color: #111827;
              font-size: 14px;
            }
            .sa-top-row small,
            .sa-top-money small {
              display: block;
              color: #667085;
              font-size: 12px;
              line-height: 1.35;
            }
            .sa-top-money {
              text-align: right;
              white-space: nowrap;
            }
            .sa-soft-pill {
              display: inline-flex;
              align-items: center;
              min-height: 34px;
              padding: 0 11px;
              border-radius: 999px;
              color: #6d28d9;
              background: #f5f3ff;
              font-size: 12px;
              font-weight: 900;
              white-space: nowrap;
            }
            .sa-empty {
              padding: 20px;
              border-radius: 20px;
              color: #667085;
              background: #f8fafc;
              text-align: center;
              font-size: 13px;
              font-weight: 800;
            }
            @media (max-width: 980px) {
              .sa-command-hero { grid-template-columns: 1fr; }
              .sa-command-orbit { display: none; }
              .sa-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
              .sa-grid-main { grid-template-columns: 1fr; }
            }
            @media (max-width: 560px) {
              .sa-command-center { gap: 12px; }
              .sa-command-hero { padding: 20px; border-radius: 28px; min-height: auto; }
              .sa-command-copy h2 { font-size: 42px; }
              .sa-command-copy p { font-size: 13px; }
              .sa-stat-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
              .sa-stat-card { padding: 14px; border-radius: 22px; }
              .sa-stat-card strong { font-size: 26px; }
              .sa-card { padding: 16px; border-radius: 24px; }
              .sa-card-head { align-items: center; }
              .sa-card-head h3 { font-size: 18px; }
              .sa-donut-grid { grid-template-columns: 1fr; justify-items: center; }
              .sa-donut-legend { width: 100%; }
              .sa-top-row { grid-template-columns: auto minmax(0, 1fr); }
              .sa-top-money { grid-column: 1 / -1; text-align: left; padding-left: 46px; }
            }
          `,
        }}
      />
    </div>
  );
}
