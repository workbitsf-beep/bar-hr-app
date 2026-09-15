import Link from "next/link";
import { ActivityType, Role, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AdminIcon, StatTile, superAdminItems, type AdminSection } from "./super-admin-ui";

const tileTones: Partial<Record<AdminSection, { bg: string; fg: string }>> = {
  owners: { bg: "#f4f2fe", fg: "#5b21b6" },
  bars: { bg: "#eef4ff", fg: "#1d4ed8" },
  billing: { bg: "#eafbf3", fg: "#047857" },
  revenue: { bg: "#fff8e8", fg: "#92400e" },
  gps: { bg: "#fef2f2", fg: "#b91c1c" },
  legal: { bg: "#f4f4f5", fg: "#3f3f46" },
  system: { bg: "#eef2ff", fg: "#3730a3" },
  settings: { bg: "#faf5ff", fg: "#7e22ce" },
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
  ]);

  const companyCount = activityCounts.find((entry) => entry.activityType === ActivityType.COMPANY)?._count._all ?? 0;
  const restaurantCount =
    activityCounts.find((entry) => entry.activityType === ActivityType.RESTAURANT)?._count._all ?? 0;
  const totalActivities = companyCount + restaurantCount;
  const rssMb = Math.round(memoryUsage.rss / 1024 / 1024);
  const heapMb = Math.round(memoryUsage.heapUsed / 1024 / 1024);

  return (
    <div className="sa-overview">
      <section className="sa-overview-metrics" aria-label="Metriche Super Admin">
        <StatTile
          label="Attività"
          value={String(totalActivities)}
          detail={`${restaurantCount} ristorazione - ${companyCount} aziende`}
        />
        <StatTile label="Titolari" value={String(ownerCount)} detail={`${userCount} utenti totali`} />
        <StatTile
          label="Abbonamenti"
          value={String(activeSubscriptions)}
          detail={`${trialSubscriptions} in prova - ${riskySubscriptions} da verificare`}
        />
        <StatTile label="Runtime" value={`${rssMb} MB`} detail={`Heap ${heapMb} MB`} />
      </section>

      <section className="sa-overview-grid" aria-label="Sezioni">
        {superAdminItems
          .filter((item) => item.section !== "home")
          .map((item) => {
            const tone = tileTones[item.section] ?? { bg: "#f4f4f5", fg: "#3f3f46" };

            return (
              <Link
                key={item.href}
                href={item.href}
                className="sa-overview-tile"
                style={{ background: tone.bg }}
              >
                <span className="sa-overview-tile-icon" style={{ color: tone.fg }}>
                  <AdminIcon section={item.section} size={20} />
                </span>
                <strong style={{ color: tone.fg }}>{item.title}</strong>
              </Link>
            );
          })}
      </section>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .sa-overview {
              display: grid;
              gap: 14px;
              min-width: 0;
            }
            .sa-overview-metrics {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 10px;
            }
            .sa-overview-grid {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 12px;
            }
            .sa-overview-tile {
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              gap: 26px;
              min-height: 112px;
              padding: 18px;
              border-radius: 16px;
              text-decoration: none;
              transition: transform 140ms ease, box-shadow 140ms ease;
            }
            .sa-overview-tile:hover {
              transform: translateY(-2px);
              box-shadow: 0 12px 26px rgba(15, 23, 42, 0.08);
            }
            .sa-overview-tile-icon {
              width: 34px;
              height: 34px;
              border-radius: 10px;
              background: rgba(255,255,255,0.6);
              display: inline-flex;
              align-items: center;
              justify-content: center;
            }
            .sa-overview-tile strong {
              font-size: 14.5px;
              font-weight: 700;
            }
            @media (max-width: 1020px) {
              .sa-overview-metrics,
              .sa-overview-grid {
                grid-template-columns: repeat(2, minmax(0, 1fr));
              }
            }
            @media (max-width: 560px) {
              .sa-overview-metrics,
              .sa-overview-grid {
                grid-template-columns: 1fr;
              }
            }
          `,
        }}
      />
    </div>
  );
}
