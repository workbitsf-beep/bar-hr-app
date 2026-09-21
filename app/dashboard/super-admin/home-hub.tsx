import Link from "next/link";
import { ActivityType, Role, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function SuperAdminHomeHub() {
  const [
    activityCounts,
    ownerCount,
    activeSubscriptions,
    trialSubscriptions,
    riskySubscriptions,
    recentBars,
  ] = await Promise.all([
    prisma.bar.groupBy({ by: ["activityType"], _count: { _all: true } }),
    prisma.user.count({ where: { role: Role.OWNER } }),
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
    prisma.bar.findMany({
      orderBy: { createdAt: "desc" },
      take: 4,
      select: {
        id: true,
        name: true,
        createdAt: true,
        owner: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const companyCount = activityCounts.find((entry) => entry.activityType === ActivityType.COMPANY)?._count._all ?? 0;
  const restaurantCount =
    activityCounts.find((entry) => entry.activityType === ActivityType.RESTAURANT)?._count._all ?? 0;
  const totalActivities = companyCount + restaurantCount;

  const relativeTime = (date: Date) => {
    const diffMs = Date.now() - date.getTime();
    const diffH = Math.round(diffMs / (1000 * 60 * 60));
    if (diffH < 1) return "ora";
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.round(diffH / 24);
    return diffD === 1 ? "ieri" : `${diffD}g`;
  };

  return (
    <div className="sa-home">
      <form action="/dashboard/super-admin/bars" method="get" className="sa-search">
        <span className="sa-search-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <input name="q" type="search" placeholder="Cerca titolare, locale, email..." />
      </form>

      <div className="sa-scrollstats">
        <div className="sa-stat">
          <span className="sa-stat-lab">Attività</span>
          <strong className="sa-stat-val">{totalActivities}</strong>
        </div>
        <div className="sa-stat">
          <span className="sa-stat-lab">Titolari</span>
          <strong className="sa-stat-val">{ownerCount}</strong>
        </div>
        <div className="sa-stat">
          <span className="sa-stat-lab">Abbonati</span>
          <strong className="sa-stat-val">{activeSubscriptions}</strong>
        </div>
        <div className="sa-stat">
          <span className="sa-stat-lab">In prova</span>
          <strong className="sa-stat-val">{trialSubscriptions}</strong>
        </div>
        <div className="sa-stat">
          <span className="sa-stat-lab">Da rivedere</span>
          <strong className="sa-stat-val sa-stat-warn">{riskySubscriptions}</strong>
        </div>
      </div>

      <div className="sa-actions">
        <Link href="/dashboard/super-admin/new" className="sa-action sa-action-primary">
          <span className="sa-action-icon">＋</span>
          <span className="sa-action-text">Nuovo titolare
            <br />e locale</span>
        </Link>
        <Link href="/dashboard/super-admin/people" className="sa-action sa-action-secondary">
          <span className="sa-action-icon">👥</span>
          <span className="sa-action-text">Gestisci
            <br />dipendenti</span>
        </Link>
      </div>

      <div className="sa-section-title">Locali creati di recente</div>
      <div className="sa-feed">
        {recentBars.length === 0 ? (
          <div className="sa-feed-empty">Nessun locale creato finora.</div>
        ) : (
          recentBars.map((bar) => (
            <Link key={bar.id} href="/dashboard/super-admin/bars" className="sa-feed-row">
              <span className="sa-feed-dot" aria-hidden="true" />
              <span className="sa-feed-text">
                {bar.name}
                <span>{bar.owner.firstName} {bar.owner.lastName}</span>
              </span>
              <span className="sa-feed-time">{relativeTime(bar.createdAt)}</span>
            </Link>
          ))
        )}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .sa-home {
              display: grid;
              gap: 16px;
              min-width: 0;
            }

            .sa-search {
              display: flex;
              align-items: center;
              gap: 10px;
              background: #ffffff;
              border: 1px solid var(--workbit-border);
              border-radius: 999px;
              padding: 13px 16px;
              box-shadow: var(--workbit-shadow);
            }

            .sa-search-icon {
              color: #98a2b3;
              display: inline-flex;
              flex-shrink: 0;
            }

            .sa-search input {
              border: none;
              outline: none;
              background: transparent;
              font-size: 14.5px;
              color: var(--workbit-ink);
              width: 100%;
            }

            .sa-scrollstats {
              display: flex;
              gap: 10px;
              overflow-x: auto;
              padding-bottom: 2px;
            }

            .sa-stat {
              flex: 0 0 auto;
              width: 118px;
              display: grid;
              gap: 5px;
              padding: 14px 16px;
              border-radius: 16px;
              background: #ffffff;
              border: 1px solid var(--workbit-border);
              box-shadow: var(--workbit-shadow);
            }

            .sa-stat-lab {
              font-size: 10.5px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #98a2b3;
            }

            .sa-stat-val {
              font-size: 22px;
              font-weight: 800;
              font-variant-numeric: tabular-nums;
              color: var(--workbit-ink);
            }

            .sa-stat-warn { color: #b45309; }

            .sa-feed {
              display: grid;
              gap: 8px;
            }

            .sa-feed-empty {
              color: var(--workbit-muted);
              font-size: 13.5px;
            }

            .sa-feed-row {
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 12px 14px;
              background: #ffffff;
              border: 1px solid var(--workbit-border);
              border-radius: 14px;
              text-decoration: none;
              color: inherit;
            }

            .sa-feed-dot {
              width: 8px;
              height: 8px;
              border-radius: 999px;
              background: #7b2ff7;
              flex-shrink: 0;
            }

            .sa-feed-text {
              flex: 1;
              min-width: 0;
              font-size: 13px;
              font-weight: 700;
              color: var(--workbit-ink);
              display: grid;
              gap: 1px;
            }

            .sa-feed-text span {
              font-size: 11.5px;
              font-weight: 600;
              color: var(--workbit-muted);
            }

            .sa-feed-time {
              font-size: 11px;
              color: #98a2b3;
              flex-shrink: 0;
            }
          `,
        }}
      />
    </div>
  );
}
