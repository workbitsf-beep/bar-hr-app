import Link from "next/link";
import { ActivityType, Role, SubscriptionStatus } from "@prisma/client";
import { RevealOnScroll } from "@/app/components/workbit-animations";
import { prisma } from "@/lib/prisma";
import { StatTile } from "./super-admin-ui";

const quickSections = [
  {
    href: "/dashboard/super-admin/owners",
    title: "Inserimento titolare",
    description: "Crea titolari e gestisci associazioni.",
    icon: "👤",
  },
  {
    href: "/dashboard/super-admin/bars",
    title: "Inserimento attività",
    description: "Crea attività e collega uno o più titolari.",
    icon: "🏢",
  },
  {
    href: "/dashboard/super-admin/billing",
    title: "Controllo abbonamenti",
    description: "Stati, trial, scadenze e gestione manuale.",
    icon: "💳",
  },
  {
    href: "/dashboard/super-admin/revenue",
    title: "Andamento ricavi",
    description: "MRR, ARR e classifica per incasso.",
    icon: "💰",
  },
  {
    href: "/dashboard/super-admin/gps",
    title: "GPS globale",
    description: "Range timbrature globale.",
    icon: "📍",
  },
  {
    href: "/dashboard/super-admin/legal",
    title: "Documenti legali",
    description: "Inserimento privacy, termini e contratti.",
    icon: "📄",
  },
  {
    href: "/dashboard/super-admin/system",
    title: "Panoramica utilizzo",
    description: "RAM, CPU, notifiche e attività app.",
    icon: "📊",
  },
  {
    href: "/dashboard/super-admin/settings",
    title: "Impostazioni",
    description: "Cambio password account Super Admin.",
    icon: "⚙️",
  },
];

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

      <section className="sa-overview-grid" aria-label="Sezioni operative">
        {quickSections.map((section, index) => (
          <RevealOnScroll key={section.href} delay={Math.min(index * 28, 160)}>
          <Link href={section.href} className="sa-overview-card">
            <span>{section.icon}</span>
            <strong>{section.title}</strong>
            <small>{section.description}</small>
          </Link>
          </RevealOnScroll>
        ))}
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
              gap: 10px;
            }
            .sa-overview-card {
              display: grid;
              gap: 8px;
              min-height: 128px;
              padding: 16px 18px;
              border-radius: 14px;
              color: #1c1917;
              text-decoration: none;
              background: #ffffff;
              border: 1px solid #e7e5e4;
              transition: border-color 140ms ease, transform 140ms ease;
            }
            .sa-overview-card:hover {
              border-color: #d6d3d1;
              transform: translateY(-1px);
            }
            .sa-overview-card > span {
              width: 34px;
              height: 34px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              border-radius: 10px;
              background: #f5f5f4;
              font-size: 16px;
            }
            .sa-overview-card strong {
              font-size: 14.5px;
              font-weight: 700;
              letter-spacing: -.01em;
            }
            .sa-overview-card small {
              color: #78716c;
              font-size: 12.5px;
              line-height: 1.4;
              font-weight: 400;
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
