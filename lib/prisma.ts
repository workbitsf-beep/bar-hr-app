import { PrismaClient, type Prisma } from "@prisma/client";

const BUILD_TIME_DATABASE_URL = "postgresql://mock:mock@localhost:5432/mock";

const globalForPrisma = globalThis as unknown as {
  prismaGlobal: PrismaClient | undefined;
  prismaGlobalUrl: string | undefined;
  prismaGlobalLoggedUrl: string | undefined;
};

const prismaLogLevels: Prisma.LogLevel[] =
  process.env.PRISMA_QUERY_LOGS === "true"
    ? ["query", "warn", "error"]
    : process.env.NODE_ENV !== "production"
      ? ["warn", "error"]
      : ["error"];

function readEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function hasRailwayRuntime() {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
      process.env.RAILWAY_PROJECT_ID ||
      process.env.RAILWAY_SERVICE_ID
  );
}

function isNextBuildPhase() {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build" ||
    process.env.npm_lifecycle_script?.includes("next build") === true
  );
}

function normalizeDatabaseHost(rawHost: string) {
  const value = rawHost.trim();

  if (!value) {
    return "";
  }

  try {
    return new URL(value.includes("://") ? value : `postgresql://${value}`).hostname;
  } catch {
    return value.split("/")[0].split(":")[0];
  }
}

function buildDatabaseUrlFromPgEnvironment() {
  const host = readEnvironmentValue("PGHOST");
  const user = readEnvironmentValue("PGUSER");
  const password = readEnvironmentValue("PGPASSWORD");
  const database = readEnvironmentValue("PGDATABASE");
  const port = readEnvironmentValue("PGPORT") || "5432";

  if (!host || !user || !password || !database) {
    return null;
  }

  const params = new URLSearchParams();
  const sslMode = readEnvironmentValue("PGSSLMODE");

  if (sslMode) {
    params.set("sslmode", sslMode);
  }

  const query = params.toString();
  const normalizedHost = normalizeDatabaseHost(host);

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${normalizedHost}:${encodeURIComponent(port)}/${encodeURIComponent(database)}${query ? `?${query}` : ""}`;
}

function isPublicRailwayProxyUrl(databaseUrl?: string | null) {
  if (!databaseUrl) {
    return false;
  }

  try {
    const host = new URL(databaseUrl).hostname;
    return host.endsWith(".proxy.rlwy.net") || host === "proxy.rlwy.net";
  } catch {
    return false;
  }
}

function describeDatabaseUrl(databaseUrl: string) {
  try {
    const host = new URL(databaseUrl).hostname;
    const connection =
      host.endsWith(".railway.internal")
        ? "railway-private"
        : host.endsWith(".proxy.rlwy.net") || host === "proxy.rlwy.net"
          ? "railway-public-proxy"
          : host === "localhost" || host === "127.0.0.1"
            ? "local"
            : "external";

    return { host, connection };
  } catch {
    return { host: "invalid-url", connection: "invalid" };
  }
}

function toValidPostgresUrl(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  if (!trimmed.startsWith("postgresql://") && !trimmed.startsWith("postgres://")) {
    return null;
  }

  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return null;
  }
}

function resolveDatabaseUrl() {
  const privateDatabaseUrl = toValidPostgresUrl(
    readEnvironmentValue("DATABASE_PRIVATE_URL")
  );
  const databaseUrl = toValidPostgresUrl(readEnvironmentValue("DATABASE_URL"));
  const fallbackDatabaseUrl = toValidPostgresUrl(
    readEnvironmentValue("DATABASE_FALLBACK_URL")
  );
  const pgDatabaseUrl = toValidPostgresUrl(buildDatabaseUrlFromPgEnvironment());

  if (privateDatabaseUrl) {
    return privateDatabaseUrl;
  }

  if (hasRailwayRuntime()) {
    const railwayPrivateCandidate =
      pgDatabaseUrl && !isPublicRailwayProxyUrl(pgDatabaseUrl)
        ? pgDatabaseUrl
        : databaseUrl && !isPublicRailwayProxyUrl(databaseUrl)
          ? databaseUrl
          : fallbackDatabaseUrl && !isPublicRailwayProxyUrl(fallbackDatabaseUrl)
            ? fallbackDatabaseUrl
            : null;

    if (railwayPrivateCandidate) {
      return railwayPrivateCandidate;
    }

    if (isNextBuildPhase()) {
      return BUILD_TIME_DATABASE_URL;
    }

    throw new Error(
      `Railway database private URL is missing or invalid. Set DATABASE_PRIVATE_URL to \${{Postgres.DATABASE_URL}} in the bar-hr-app service variables, save it, and redeploy. Safe env status: DATABASE_PRIVATE_URL=${Boolean(privateDatabaseUrl)}, DATABASE_URL=${Boolean(databaseUrl)}, PG_ENV=${Boolean(pgDatabaseUrl)}, DATABASE_FALLBACK_URL=${Boolean(fallbackDatabaseUrl)}.`
    );
  }

  const localDatabaseUrl = databaseUrl || pgDatabaseUrl || fallbackDatabaseUrl;

  if (localDatabaseUrl) {
    return localDatabaseUrl;
  }

  if (isNextBuildPhase()) {
    return BUILD_TIME_DATABASE_URL;
  }

  throw new Error(
    "Database connection is not configured. Set DATABASE_URL or DATABASE_PRIVATE_URL to a valid postgresql:// URL."
  );
}

function prismaClientSingleton(databaseUrl = resolveDatabaseUrl()) {
  return new PrismaClient({
    log: prismaLogLevels,
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
}

function getPrismaClient() {
  const databaseUrl = resolveDatabaseUrl();

  if (
    !globalForPrisma.prismaGlobal ||
    globalForPrisma.prismaGlobalUrl !== databaseUrl
  ) {
    if (globalForPrisma.prismaGlobalLoggedUrl !== databaseUrl) {
      const { host, connection } = describeDatabaseUrl(databaseUrl);

      console.info("[database] prisma client", {
        host,
        connection,
        railwayRuntime: hasRailwayRuntime(),
        buildPhase: isNextBuildPhase(),
      });

      globalForPrisma.prismaGlobalLoggedUrl = databaseUrl;
    }

    globalForPrisma.prismaGlobal = prismaClientSingleton(databaseUrl);
    globalForPrisma.prismaGlobalUrl = databaseUrl;
  }

  return globalForPrisma.prismaGlobal;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client);

    return typeof value === "function" ? value.bind(client) : value;
  },
});

export default prisma;
