import { PrismaClient, type Prisma } from "@prisma/client";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
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
  const rawDatabasePrivateUrl = readEnvironmentValue("DATABASE_PRIVATE_URL");
  const rawDatabaseUrl = readEnvironmentValue("DATABASE_URL");
  const pgDatabaseUrl = buildDatabaseUrlFromPgEnvironment();
  const fallbackDatabaseUrl =
    hasRailwayRuntime() && isPublicRailwayProxyUrl(rawDatabaseUrl)
      ? pgDatabaseUrl
      : rawDatabaseUrl || pgDatabaseUrl;
  const databaseUrl = rawDatabasePrivateUrl || fallbackDatabaseUrl;

  if (!databaseUrl) {
    throw new Error(
      "Database connection is not configured. Set a non-empty DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE."
    );
  }

  try {
    new URL(databaseUrl);
  } catch {
    throw new Error(
      "Database connection URL is invalid. Check DATABASE_URL or DATABASE_PRIVATE_URL."
    );
  }

  if (hasRailwayRuntime()) {
    if (isPublicRailwayProxyUrl(databaseUrl)) {
      throw new Error(
        "Railway production must use the private Postgres network. Set DATABASE_URL or DATABASE_PRIVATE_URL to the internal Railway database URL, not the public proxy."
      );
    }
  }

  return databaseUrl;
}

const databaseUrl = resolveDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: prismaLogLevels,
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
