import { ActivityType, Role, SubscriptionStatus } from "@prisma/client";
import Link from "next/link";
import { getDatabaseConnectionInfo, prisma } from "@/lib/prisma";
import { getDashboardContext } from "../../context";
import { ColumnChart, DataList, Donut, Figure, FigureBand, Forbidden, Note, Section, Status } from "../console-ui";
import { countByDay, windowStart } from "../console-metrics";

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

export default async function ConsoleUsagePage() {
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <Forbidden />;
  }

  const monthStart = startOfMonth();
  const connectionInfo = getDatabaseConnectionInfo();
  const pingStartedAt = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  const pingMs = Date.now() - pingStartedAt;

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
      where: {
        status: {
          in: [
            SubscriptionStatus.INACTIVE,
            SubscriptionStatus.UNPAID,
            SubscriptionStatus.CANCELED,
            SubscriptionStatus.PAST_DUE,
          ],
        },
      },
    }),
    prisma.timeLog.count({ where: { timestamp: { gte: monthStart } } }),
    prisma.notification.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.notification.count({ where: { read: false } }),
  ]);

  const chartStart = windowStart(30);
  const [recentTimelogs, recentNotifications] = await Promise.all([
    prisma.timeLog.findMany({ where: { timestamp: { gte: chartStart } }, select: { timestamp: true } }),
    prisma.notification.findMany({ where: { createdAt: { gte: chartStart } }, select: { createdAt: true } }),
  ]);

  const runtime = getRuntimeMetrics();
  const privateNetwork = connectionInfo.connection === "railway-private";

  return (
    <div className="wbc-page">
      <Link href="/dashboard/super-admin/system" className="wbc-back">
        ← Sistema
      </Link>

      <div className="wbc-page-head">
        <h1 className="wbc-title">Utilizzo</h1>
        <p className="wbc-desc">Carico della piattaforma nel mese corrente e stato tecnico del server.</p>
      </div>

      <FigureBand>
        <Figure label="Timbrature" value={monthTimelogs} meta="questo mese" />
        <Figure label="Notifiche" value={monthNotifications} meta={`${unreadNotifications} non lette`} />
        <Figure label="Account" value={totalUsers} meta="esclusi i super admin" />
      </FigureBand>

      <Section title="Timbrature al giorno">
        <ColumnChart
          data={countByDay(
            recentTimelogs.map((log) => log.timestamp),
            30
          )}
          caption="ultimi 30 giorni"
        />
      </Section>

      <Section title="Notifiche inviate">
        <ColumnChart
          data={countByDay(
            recentNotifications.map((notification) => notification.createdAt),
            30
          )}
          caption="ultimi 30 giorni"
          height={84}
        />
      </Section>

      <Section title="Tipo di attività">
        <Donut
          centerLabel="locali"
          slices={[
            { label: "Ristorazione", value: restaurantBars, color: "#6d28d9" },
            { label: "Aziende", value: companyBars, color: "#0e7a5f" },
          ]}
        />
      </Section>

      <Section title="Stato degli abbonamenti">
        <DataList
          items={[
            { label: "Attivi o in prova", value: activeSubscriptions },
            { label: "In prova", value: trialSubscriptions },
            { label: "Non attivi", value: inactiveSubscriptions },
            { label: "Locali totali", value: totalBars },
          ]}
        />
      </Section>

      <Section title="Database">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          <Status
            tone={privateNetwork ? "positive" : "warning"}
            label={privateNetwork ? "Rete privata Railway" : `Rete: ${connectionInfo.connection}`}
          />
          <Status
            tone={pingMs < 100 ? "positive" : pingMs < 500 ? "warning" : "negative"}
            label={`Ping ${pingMs} ms`}
          />
          <Status
            tone="neutral"
            label={connectionInfo.railwayRuntime ? "In esecuzione su Railway" : "Fuori da Railway"}
          />
        </div>

        <DataList items={[{ label: "Host", value: connectionInfo.host }]} />

        {!privateNetwork ? (
          <Note tone="warning">
            Il database non passa dalla rete privata di Railway: ogni richiesta usa il proxy pubblico, molto più
            lento. Controlla che la variabile DATABASE_PRIVATE_URL sia impostata sul servizio.
          </Note>
        ) : null}
      </Section>

      <Section title="Consumi del processo">
        <DataList
          items={[
            { label: "RAM processo", value: runtime.rss },
            { label: "Heap usato", value: runtime.heapUsed },
            { label: "Heap totale", value: runtime.heapTotal },
            { label: "Memoria esterna", value: runtime.external },
            { label: "CPU media", value: runtime.cpuAverage },
            { label: "Uptime", value: runtime.uptime },
          ]}
        />
        <Note>
          I consumi si riferiscono all&apos;intero processo del server, condiviso da tutti i locali: non sono
          divisibili per singola attività.
        </Note>
      </Section>
    </div>
  );
}
