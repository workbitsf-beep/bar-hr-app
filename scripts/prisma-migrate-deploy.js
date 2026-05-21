const { spawnSync } = require("node:child_process");

function hasRailwayRuntime() {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
      process.env.RAILWAY_PROJECT_ID ||
      process.env.RAILWAY_SERVICE_ID
  );
}

function normalizeDatabaseHost(rawHost) {
  const value = String(rawHost || "").trim();

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
  const { PGHOST, PGUSER, PGPASSWORD, PGDATABASE } = process.env;
  const PGPORT = process.env.PGPORT || "5432";

  if (!PGHOST || !PGUSER || !PGPASSWORD || !PGDATABASE) {
    return null;
  }

  const params = new URLSearchParams();

  if (process.env.PGSSLMODE) {
    params.set("sslmode", process.env.PGSSLMODE);
  }

  const query = params.toString();
  const host = normalizeDatabaseHost(PGHOST);

  return `postgresql://${encodeURIComponent(PGUSER)}:${encodeURIComponent(PGPASSWORD)}@${host}:${encodeURIComponent(PGPORT)}/${encodeURIComponent(PGDATABASE)}${query ? `?${query}` : ""}`;
}

function isPublicRailwayProxyUrl(databaseUrl) {
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
  const pgDatabaseUrl = buildDatabaseUrlFromPgEnvironment();
  const fallbackDatabaseUrl =
    hasRailwayRuntime() && isPublicRailwayProxyUrl(process.env.DATABASE_URL)
      ? pgDatabaseUrl
      : process.env.DATABASE_URL || pgDatabaseUrl;
  const databaseUrl =
    process.env.DATABASE_PRIVATE_URL ||
    fallbackDatabaseUrl;

  if (!databaseUrl) {
    throw new Error("Database connection is not configured. Set DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE.");
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
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(npxCommand, ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
  },
});

process.exit(result.status ?? 1);
