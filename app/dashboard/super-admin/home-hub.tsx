import { ActivityType, Role, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { StatTile } from "./super-admin-ui";

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
            @media (max-width: 1020px) {
              .sa-overview-metrics {
                grid-template-columns: repeat(2, minmax(0, 1fr));
              }
            }
            @media (max-width: 560px) {
              .sa-overview-metrics {
                grid-template-columns: 1fr;
              }
            }
          `,
        }}
      />
    </div>
  );
}
