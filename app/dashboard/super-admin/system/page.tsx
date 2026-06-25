import { ActivityType, Role, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../../context";
import { EmptyState, Panel, Stack, StatusPill } from "../../ui";
import { SuperAdminForbidden, SuperAdminFrame } from "../super-admin-ui";

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

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "green" | "purple" | "orange";
}) {
  const palette = {
    neutral: ["#f8fafc", "#0f172a"],
    green: ["#ecfdf5", "#047857"],
    purple: ["#f5f3ff", "#6d28d9"],
    orange: ["#fff7ed", "#c2410c"],
  } as const;
  const [background, color] = palette[tone];

  return (
    <div
      className="dashboard-list-card"
      style={{
        display: "grid",
        gap: 8,
        padding: 16,
        borderRadius: 22,
        background,
        border: "1px solid rgba(226,232,240,.9)",
        minWidth: 0,
      }}
    >
      <span style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>{label}</span>
      <strong style={{ color, fontSize: 28, letterSpacing: "-0.04em" }}>{value}</strong>
    </div>
  );
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
      title="Sistema"
      description="Monitoraggio leggero con metriche interne disponibili dal database."
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
              <MetricCard label="Attività totali" value={totalBars} tone="purple" />
              <MetricCard label="Attività attive/prova" value={activeBars} tone="green" />
              <MetricCard label="Utenti" value={totalUsers} />
              <MetricCard label="Timbrature mese" value={monthTimelogs} tone="orange" />
              <MetricCard label="Notifiche mese" value={monthNotifications} tone="purple" />
              <MetricCard label="Notifiche non lette" value={unreadNotifications} />
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
            <MetricCard label="RAM processo" value={runtimeMetrics.rss} tone="purple" />
            <MetricCard label="Heap usato" value={runtimeMetrics.heapUsed} tone="green" />
            <MetricCard label="Heap totale" value={runtimeMetrics.heapTotal} />
            <MetricCard label="Memoria esterna" value={runtimeMetrics.external} />
            <MetricCard label="CPU media" value={runtimeMetrics.cpuAverage} tone="orange" />
            <MetricCard label="Uptime processo" value={runtimeMetrics.uptime} />
          </div>
        </Panel>
      </Stack>
    </SuperAdminFrame>
  );
}
