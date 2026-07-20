import Link from "next/link";
import { ActivityType, Role, SubscriptionStatus } from "@prisma/client";
import { RevealOnScroll } from "@/app/components/workbit-animations";
import { prisma } from "@/lib/prisma";

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
    <div className="sa-overview-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

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
      <RevealOnScroll as="section" className="sa-overview-head">
        <span>Control room</span>
        <h2>Super Admin leggero</h2>
        <p>Solo accessi rapidi e numeri essenziali. Le liste pesanti restano nelle pagine dedicate.</p>
      </RevealOnScroll>

      <section className="sa-overview-metrics" aria-label="Metriche Super Admin">
        <AdminMetric
          label="Attività"
          value={String(totalActivities)}
          detail={`${restaurantCount} ristorazione - ${companyCount} aziende`}
        />
        <AdminMetric label="Titolari" value={String(ownerCount)} detail={`${userCount} utenti totali`} />
        <AdminMetric
          label="Abbonamenti"
          value={String(activeSubscriptions)}
          detail={`${trialSubscriptions} in prova - ${riskySubscriptions} da verificare`}
        />
        <AdminMetric label="Runtime" value={`${rssMb} MB`} detail={`Heap ${heapMb} MB`} />
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
            .sa-overview-head,
            .sa-overview-metric,
            .sa-overview-card {
              border: 1px solid rgba(124, 58, 237, .13);
              background: rgba(255,255,255,.94);
              box-shadow: 0 16px 38px rgba(88, 28, 135, .08);
            }
            .sa-overview-head {
              display: grid;
              gap: 8px;
              padding: 24px;
              border-radius: 30px;
              background:
                radial-gradient(circle at 90% 8%, rgba(168, 85, 247, .18), transparent 24%),
                linear-gradient(135deg, #ffffff 0%, #f7f3ff 58%, #eef2ff 100%);
            }
            .sa-overview-head span {
              color: #6d28d9;
              font-size: 11px;
              font-weight: 950;
              letter-spacing: .13em;
              text-transform: uppercase;
            }
            .sa-overview-head h2 {
              margin: 0;
              color: #0f172a;
              font-size: clamp(30px, 5vw, 54px);
              line-height: .98;
              letter-spacing: -.06em;
            }
            .sa-overview-head p {
              margin: 0;
              max-width: 680px;
              color: #64748b;
              font-size: 14px;
              line-height: 1.55;
            }
            .sa-overview-metrics {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 10px;
            }
            .sa-overview-metric {
              display: grid;
              gap: 6px;
              padding: 16px;
              border-radius: 24px;
            }
            .sa-overview-metric span,
            .sa-overview-card small {
              color: #64748b;
              font-size: 12px;
              font-weight: 800;
            }
            .sa-overview-metric strong {
              color: #0f172a;
              font-size: 30px;
              line-height: 1;
              letter-spacing: -.05em;
            }
            .sa-overview-metric small {
              color: #64748b;
              font-size: 12px;
              line-height: 1.35;
            }
            .sa-overview-grid {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 12px;
            }
            .sa-overview-card {
              display: grid;
              gap: 8px;
              min-height: 138px;
              padding: 18px;
              border-radius: 26px;
              color: #0f172a;
              text-decoration: none;
              background: linear-gradient(145deg, #ffffff 0%, #faf5ff 100%);
              transition: transform .18s ease, box-shadow .18s ease;
            }
            .sa-overview-card:hover {
              transform: translateY(-2px);
              box-shadow: 0 22px 46px rgba(124, 58, 237, .14);
            }
            .sa-overview-card > span {
              width: 42px;
              height: 42px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              border-radius: 16px;
              background: linear-gradient(135deg, #111936, #7c3aed);
              font-size: 20px;
              box-shadow: 0 12px 26px rgba(124, 58, 237, .18);
            }
            .sa-overview-card strong {
              font-size: 16px;
              letter-spacing: -.02em;
            }
            @media (max-width: 1020px) {
              .sa-overview-metrics,
              .sa-overview-grid {
                grid-template-columns: repeat(2, minmax(0, 1fr));
              }
            }
            @media (max-width: 560px) {
              .sa-overview-head { padding: 20px; border-radius: 26px; }
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
