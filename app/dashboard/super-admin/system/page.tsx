import { ActivityType, Role, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../../context";
import { EmptyState, Panel, Stack, StatusPill } from "../../ui";
import { StatTile, SuperAdminForbidden, SuperAdminFrame } from "../super-admin-ui";

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 MB";
  }

  const megabytes = bytes / 1024 / 1024;
  if (megabytes < 1024) {
    return `${megabytes.toFixed(0)} MB`;
  }

  return `${(megabytes / 1024).toFixed(1)} GB`;
}

function getRuntimeMetrics() {
  const memory = process.memoryUsage();
  const cpu = process.cpuUsage();
  const uptimeSeconds = Math.max(process.uptime(), 1);
  const cpuUsedMs = (cpu.user + cpu.system) / 1000;
  const averageCpuPercent = Math.max(0, (cpuUsedMs / (uptimeSeconds * 1000)) * 100);

  return {
    rss: formatBytes(memory.rss),
    heapUsed: formatBytes(memory.heapUsed),
    heapTotal: formatBytes(memory.heapTotal),
    external: formatBytes(memory.external),
    cpuAverage: `${averageCpuPercent.toFixed(1)}%`,
    uptime: `${Math.floor(uptimeSeconds / 60)} min`,
  };
}

export default async function SuperAdminSystemPage() {
  const { role } = await getDashboardContext();

  if (role !== Role.SUPER_ADMIN) {
    return <SuperAdminForbidden />;
  }

  const monthStart = startOfMonth();

  const [
    totalBars,
    restaurantBars,
    companyBars,
    totalUsers,
    activeSubscriptions,
    trialSubscriptions,
    inactiveSubscriptions,
    monthTimelogs,
    monthNotifications,
    unreadNotifications,
  ] = await Promise.all([
    prisma.bar.count(),
    prisma.bar.count({ where: { activityType: ActivityType.RESTAURANT } }),
    prisma.bar.count({ where: { activityType: ActivityType.COMPANY } }),
    prisma.user.count({ where: { role: { not: Role.SUPER_ADMIN } } }),
    prisma.subscription.count({
      where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] } },
    }),
    prisma.subscription.count({ where: { status: SubscriptionStatus.TRIALING } }),
    prisma.subscription.count({
      where: { status: { in: [SubscriptionStatus.INACTIVE, SubscriptionStatus.UNPAID, SubscriptionStatus.CANCELED, SubscriptionStatus.PAST_DUE] } },
    }),
    prisma.timeLog.count({ where: { timestamp: { gte: monthStart } } }),
    prisma.notification.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.notification.count({ where: { read: false } }),
  ]);

  const activeBars = activeSubscriptions;
  const runtimeMetrics = getRuntimeMetrics();

  return (
    <SuperAdminFrame
      title="Panoramica utilizzo"
      description="Monitoraggio leggero di RAM, CPU e attività dell'app."
    >
      <Stack>
        <Panel title="Monitoraggio">
          {totalBars === 0 ? (
            <EmptyState message="Nessuna attività registrata." />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 12,
              }}
            >
              <StatTile label="Attività totali" value={totalBars} tone="purple" />
              <StatTile label="Attività attive/prova" value={activeBars} tone="green" />
              <StatTile label="Utenti" value={totalUsers} />
              <StatTile label="Timbrature mese" value={monthTimelogs} tone="orange" />
              <StatTile label="Notifiche mese" value={monthNotifications} tone="purple" />
              <StatTile label="Notifiche non lette" value={unreadNotifications} />
            </div>
          )}
        </Panel>

        <Panel title="Stato operativo">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <StatusPill label={`${restaurantBars} ristorazione`} tone="neutral" />
            <StatusPill label={`${companyBars} aziende`} tone="neutral" />
            <StatusPill label={`${trialSubscriptions} in prova`} tone="warning" />
            <StatusPill label={`${inactiveSubscriptions} non attive`} tone="danger" />
          </div>
        </Panel>

        <Panel title="Consumi runtime">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 12,
            }}
          >
            <StatTile label="RAM processo" value={runtimeMetrics.rss} tone="purple" />
            <StatTile label="Heap usato" value={runtimeMetrics.heapUsed} tone="green" />
            <StatTile label="Heap totale" value={runtimeMetrics.heapTotal} />
            <StatTile label="Memoria esterna" value={runtimeMetrics.external} />
            <StatTile label="CPU media" value={runtimeMetrics.cpuAverage} tone="orange" />
            <StatTile label="Uptime processo" value={runtimeMetrics.uptime} />
          </div>
        </Panel>
      </Stack>
    </SuperAdminFrame>
  );
}
