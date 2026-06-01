import { ActivityType, Role, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Panel, Stack } from "../ui";
import { SuperAdminMenuGrid } from "./super-admin-ui";

function StatCard({
  value,
  label,
  detail,
}: {
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
        gap: 8,
        minWidth: 0,
      }}
    >
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

export async function SuperAdminHomeHub() {
  const [activityCounts, activeBillingCount, ownerCount, staffCount] = await Promise.all([
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
  ]);

  const companyCount = getActivityCount(activityCounts, ActivityType.COMPANY);
  const restaurantCount = getActivityCount(activityCounts, ActivityType.RESTAURANT);
  const totalBars = companyCount + restaurantCount;
  const totalUsers = ownerCount + staffCount;

  return (
    <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
      <Stack columns="repeat(auto-fit, minmax(220px, 1fr))">
        <StatCard value={String(totalBars)} label="Strutture" detail="Totale attivita registrate" />
        <StatCard value={String(companyCount)} label="Aziende" detail="Sezione separata" />
        <StatCard value={String(restaurantCount)} label="Ristorazione" detail="Sezione separata" />
        <StatCard value={String(totalUsers)} label="Utenti" detail={`${ownerCount} titolari - ${staffCount} staff`} />
        <StatCard value={String(activeBillingCount)} label="Abbonamenti attivi" detail="Clienti sbloccati" />
      </Stack>

      <Panel title="Azioni rapide" action="Apri le pagine dedicate">
        <SuperAdminMenuGrid />
      </Panel>

      <Panel title="Home leggera">
        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.7 }}>
          La gestione dettagliata di titolari, attivita e abbonamenti si apre nelle pagine
          dedicate, cosi la panoramica resta piu veloce su mobile.
        </p>
      </Panel>
    </div>
  );
}
