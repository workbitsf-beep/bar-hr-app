import { PrismaClient, type Prisma } from "@prisma/client";

const FALLBACK_DATABASE_URL = "postgresql://mock:mock@localhost:5432/mock";

const globalForPrisma = globalThis as unknown as {
  prismaGlobal: PrismaClient | undefined;
  prismaGlobalUrl: string | undefined;
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

function resolveDatabaseUrl() {
  const privateDatabaseUrl = readEnvironmentValue("DATABASE_PRIVATE_URL");
  const databaseUrl = readEnvironmentValue("DATABASE_URL");
  const publicDatabaseUrl = readEnvironmentValue("NEXT_PUBLIC_DATABASE_URL");
  const pgDatabaseUrl = buildDatabaseUrlFromPgEnvironment();

  if (privateDatabaseUrl) {
    return privateDatabaseUrl;
  }

  if (hasRailwayRuntime() && isPublicRailwayProxyUrl(databaseUrl) && pgDatabaseUrl) {
    return pgDatabaseUrl;
  }

  return databaseUrl || pgDatabaseUrl || publicDatabaseUrl || FALLBACK_DATABASE_URL;
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
