import Link from "next/link";
import { ActivityType, Role, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AdminIcon, superAdminItems, type AdminSection } from "./super-admin-ui";

function ConsoleBar({
  segments,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
}) {
  const total = Math.max(
    1,
    segments.reduce((sum, segment) => sum + segment.value, 0)
  );

  return (
    <div className="sa-bar">
      <div className="sa-bar-track">
        {segments.map((segment) => (
          <span
            key={segment.label}
            className="sa-bar-segment"
            style={{
              width: `${(segment.value / total) * 100}%`,
              background: segment.color,
            }}
            title={`${segment.label}: ${segment.value}`}
          />
        ))}
      </div>
      <div className="sa-bar-legend">
        {segments.map((segment) => (
          <span key={segment.label} className="sa-bar-legend-item">
            <span className="sa-bar-dot" style={{ background: segment.color }} aria-hidden="true" />
            {segment.label}
            <strong>{segment.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

const sectionMetricLabel: Partial<Record<AdminSection, (counts: {
  totalActivities: number;
  ownerCount: number;
  activeSubscriptions: number;
  riskySubscriptions: number;
}) => string>> = {
  owners: (c) => `${c.ownerCount} titolari`,
  bars: (c) => `${c.totalActivities} attive`,
  people: () => "Gestione team",
  billing: (c) => `${c.activeSubscriptions} attivi`,
  revenue: () => "Analisi ricavi",
  gps: () => "Raggio globale",
  legal: () => "Documenti globali",
  system: () => "Consumi live",
  settings: () => "Accesso e sicurezza",
};

export async function SuperAdminHomeHub() {
  const memoryUsage = process.memoryUsage();
  const [
    activityCounts,
    ownerCount,
    userCount,
    activeSubscriptions,
    trialSubscriptions,
    riskySubscriptions,
    planCounts,
  ] = await Promise.all([
    prisma.bar.groupBy({ by: ["activityType"], _count: { _all: true } }),
    prisma.user.count({ where: { role: Role.OWNER } }),
    prisma.user.count({ where: { role: { not: Role.SUPER_ADMIN } } }),
    prisma.subscription.count({
      where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] } },
    }),
    prisma.subscription.count({ where: { status: SubscriptionStatus.TRIALING } }),
    prisma.subscription.count({
      where: {
        status: {
          in: [
            SubscriptionStatus.PAST_DUE,
            SubscriptionStatus.UNPAID,
            SubscriptionStatus.CANCELED,
            SubscriptionStatus.INACTIVE,
          ],
        },
      },
    }),
    prisma.subscription.groupBy({ by: ["planType"], _count: { _all: true } }),
  ]);

  const companyCount = activityCounts.find((entry) => entry.activityType === ActivityType.COMPANY)?._count._all ?? 0;
  const restaurantCount =
    activityCounts.find((entry) => entry.activityType === ActivityType.RESTAURANT)?._count._all ?? 0;
  const totalActivities = companyCount + restaurantCount;
  const rssMb = Math.round(memoryUsage.rss / 1024 / 1024);
  const paidActive = Math.max(0, activeSubscriptions - trialSubscriptions);

  const planBreakdown = planCounts
    .map((entry) => ({ label: entry.planType, value: entry._count._all }))
    .sort((a, b) => b.value - a.value);
  const planColors: Record<string, string> = {
    PAID: "#7b2ff7",
    LIFETIME: "#34d399",
    TRIAL: "#fbbf24",
    FREE: "#6b7094",
  };

  const now = new Date();
  const greeting = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  const counts = { totalActivities, ownerCount, activeSubscriptions, riskySubscriptions };

  return (
    <div className="sa-console">
      <div className="sa-console-header">
        <div>
          <span className="sa-eyebrow">Workbit · Centro operativo</span>
          <h2>Panoramica di rete</h2>
          <span className="sa-console-date">{greeting}</span>
        </div>
        <Link href="/dashboard/super-admin/new" className="sa-cta">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          Nuovo titolare
        </Link>
      </div>

      <div className="sa-kpi-row">
        <div className="sa-kpi">
          <span className="sa-eyebrow">Attività totali</span>
          <strong className="sa-kpi-value">{totalActivities}</strong>
          <span className="sa-kpi-detail">{restaurantCount} ristorazione · {companyCount} aziende</span>
        </div>
        <div className="sa-kpi">
          <span className="sa-eyebrow">Titolari</span>
          <strong className="sa-kpi-value">{ownerCount}</strong>
          <span className="sa-kpi-detail">{userCount} utenti totali in rete</span>
        </div>
        <div className="sa-kpi">
          <span className="sa-eyebrow">Abbonamenti attivi</span>
          <strong className="sa-kpi-value sa-kpi-positive">{activeSubscriptions}</strong>
          <span className="sa-kpi-detail">{trialSubscriptions} in prova</span>
        </div>
        <div className="sa-kpi">
          <span className="sa-eyebrow">Da verificare</span>
          <strong className={`sa-kpi-value ${riskySubscriptions > 0 ? "sa-kpi-warning" : ""}`}>
            {riskySubscriptions}
          </strong>
          <span className="sa-kpi-detail">Runtime {rssMb} MB</span>
        </div>
      </div>

      <div className="sa-charts-row">
        <div className="sa-chart-card">
          <span className="sa-eyebrow">Stato abbonamenti</span>
          <ConsoleBar
            segments={[
              { label: "Paganti", value: paidActive, color: "#7b2ff7" },
              { label: "In prova", value: trialSubscriptions, color: "#fbbf24" },
              { label: "Da verificare", value: riskySubscriptions, color: "#f87171" },
            ]}
          />
        </div>
        <div className="sa-chart-card">
          <span className="sa-eyebrow">Piani in rete</span>
          <ConsoleBar
            segments={planBreakdown.map((entry) => ({
              label: entry.label,
              value: entry.value,
              color: planColors[entry.label] ?? "#6b7094",
            }))}
          />
        </div>
      </div>

      <div className="sa-console-nav">
        <span className="sa-eyebrow">Sezioni</span>
        <div className="sa-nav-list">
          {superAdminItems
            .filter((item) => item.section !== "home")
            .map((item) => (
              <Link key={item.href} href={item.href} className="sa-nav-row">
                <span className="sa-nav-icon">
                  <AdminIcon section={item.section} size={18} />
                </span>
                <span className="sa-nav-row-text">
                  <strong>{item.title}</strong>
                  <span>{sectionMetricLabel[item.section]?.(counts) ?? ""}</span>
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="sa-nav-chevron">
                  <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ))}
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .sa-console {
              display: grid;
              gap: 22px;
              min-width: 0;
              color: #f5f3ff;
            }

            .sa-eyebrow {
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.09em;
              text-transform: uppercase;
              color: #9296b8;
            }

            .sa-console-header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 14px;
              flex-wrap: wrap;
            }

            .sa-cta {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              border-radius: 999px;
              padding: 11px 18px;
              background: linear-gradient(135deg, #7b2ff7, #a855f7);
              color: #ffffff;
              font-size: 13.5px;
              font-weight: 800;
              text-decoration: none;
              box-shadow: 0 12px 26px rgba(123, 47, 247, 0.32);
              white-space: nowrap;
            }

            .sa-console-header h2 {
              margin: 0;
              font-size: 24px;
              font-weight: 800;
              letter-spacing: -0.01em;
              color: #f5f3ff;
            }

            .sa-console-date {
              color: #9296b8;
              font-size: 13px;
              text-transform: capitalize;
            }

            .sa-kpi-row {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 12px;
            }

            .sa-kpi {
              display: grid;
              gap: 6px;
              padding: 16px 18px;
              border-radius: 16px;
              background: rgba(255, 255, 255, 0.04);
              border: 1px solid rgba(255, 255, 255, 0.09);
            }

            .sa-kpi-value {
              font-size: 30px;
              font-weight: 800;
              letter-spacing: -0.02em;
              font-variant-numeric: tabular-nums;
              color: #f5f3ff;
            }

            .sa-kpi-positive { color: #34d399; }
            .sa-kpi-warning { color: #fbbf24; }

            .sa-kpi-detail {
              color: #9296b8;
              font-size: 12.5px;
            }

            .sa-charts-row {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 12px;
            }

            .sa-chart-card {
              display: grid;
              gap: 12px;
              padding: 18px;
              border-radius: 16px;
              background: rgba(255, 255, 255, 0.04);
              border: 1px solid rgba(255, 255, 255, 0.09);
            }

            .sa-bar { display: grid; gap: 10px; }

            .sa-bar-track {
              display: flex;
              width: 100%;
              height: 10px;
              border-radius: 999px;
              overflow: hidden;
              background: rgba(255, 255, 255, 0.06);
            }

            .sa-bar-segment {
              height: 100%;
              min-width: 2px;
            }

            .sa-bar-legend {
              display: flex;
              flex-wrap: wrap;
              gap: 12px;
            }

            .sa-bar-legend-item {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              font-size: 12.5px;
              color: #c7c9de;
            }

            .sa-bar-legend-item strong {
              color: #f5f3ff;
              font-variant-numeric: tabular-nums;
            }

            .sa-bar-dot {
              width: 8px;
              height: 8px;
              border-radius: 999px;
            }

            .sa-console-nav {
              display: grid;
              gap: 10px;
            }

            .sa-nav-list {
              display: grid;
              gap: 8px;
            }

            .sa-nav-row {
              display: flex;
              align-items: center;
              gap: 12px;
              padding: 13px 14px;
              border-radius: 14px;
              background: rgba(255, 255, 255, 0.03);
              border: 1px solid rgba(255, 255, 255, 0.07);
              text-decoration: none;
              transition: background 140ms ease, border-color 140ms ease, transform 140ms ease;
            }

            .sa-nav-row:hover {
              background: rgba(123, 47, 247, 0.14);
              border-color: rgba(123, 47, 247, 0.35);
              transform: translateX(2px);
            }

            .sa-nav-icon {
              width: 34px;
              height: 34px;
              border-radius: 10px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              background: rgba(123, 47, 247, 0.16);
              color: #c4b5fd;
              flex-shrink: 0;
            }

            .sa-nav-row-text {
              display: grid;
              gap: 2px;
              flex: 1;
              min-width: 0;
            }

            .sa-nav-row-text strong {
              color: #f5f3ff;
              font-size: 14.5px;
              font-weight: 700;
            }

            .sa-nav-row-text span {
              color: #9296b8;
              font-size: 12px;
            }

            .sa-nav-chevron {
              color: #6b7094;
              flex-shrink: 0;
            }

            @media (max-width: 1020px) {
              .sa-kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
              .sa-charts-row { grid-template-columns: 1fr; }
            }

            @media (max-width: 560px) {
              .sa-kpi-row { grid-template-columns: 1fr; }
            }
          `,
        }}
      />
    </div>
  );
}
