const { spawnSync } = require("node:child_process");

if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env");
}

const BUILD_TIME_DATABASE_URL = "postgresql://mock:mock@localhost:5432/mock";

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

function toValidPostgresUrl(value) {
  const trimmed = String(value || "").trim();

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

function isNextBuildPhase() {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build" ||
    String(process.env.npm_lifecycle_script || "").includes("next build")
  );
}

function describeDatabaseUrl(databaseUrl) {
  try {
    const host = new URL(databaseUrl).hostname;
    const connection = host.endsWith(".railway.internal")
      ? "railway-private"
      : isPublicRailwayProxyUrl(databaseUrl)
        ? "railway-public-proxy"
        : host === "localhost" || host === "127.0.0.1"
          ? "local"
          : "external";

    return { host, connection };
  } catch {
    return { host: "invalid-url", connection: "invalid" };
  }
}

function resolveDatabaseUrl() {
  const privateDatabaseUrl = toValidPostgresUrl(process.env.DATABASE_PRIVATE_URL);
  const databaseUrl = toValidPostgresUrl(process.env.DATABASE_URL);
  const fallbackDatabaseUrl = toValidPostgresUrl(process.env.DATABASE_FALLBACK_URL);
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
      `Railway database URL is missing or invalid. Add a Postgres service to this Railway environment, or set DATABASE_PRIVATE_URL/DATABASE_URL in the bar-hr-app service to a valid PostgreSQL URL. If using a Railway reference variable, replace Postgres with the exact database service name, for example \${{YourDatabaseService.DATABASE_URL}}. Safe env status: DATABASE_PRIVATE_URL=${Boolean(privateDatabaseUrl)}, DATABASE_URL=${Boolean(databaseUrl)}, PG_ENV=${Boolean(pgDatabaseUrl)}, DATABASE_FALLBACK_URL=${Boolean(fallbackDatabaseUrl)}.`
    );
  }

  const localDatabaseUrl = databaseUrl || pgDatabaseUrl || fallbackDatabaseUrl;

  if (localDatabaseUrl) {
    return localDatabaseUrl;
  }

  if (isNextBuildPhase()) {
    return BUILD_TIME_DATABASE_URL;
  }

  throw new Error("Database connection is not configured. Set DATABASE_URL or DATABASE_PRIVATE_URL to a valid postgresql:// URL.");
}

const databaseUrl = resolveDatabaseUrl();
const { host, connection } = describeDatabaseUrl(databaseUrl);
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const maxAttempts = Number(process.env.PRISMA_MIGRATE_RETRIES || 12);
const retryDelayMs = Number(process.env.PRISMA_MIGRATE_RETRY_DELAY_MS || 5000);

console.info("[database] prisma migrate deploy", {
  host,
  connection,
  railwayRuntime: hasRailwayRuntime(),
  maxAttempts,
});

function wait(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

let status = 1;

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  console.info("[database] migration attempt", { attempt, maxAttempts });

  const result = spawnSync(npxCommand, ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });

  status = result.status ?? 1;

  if (status === 0) {
    process.exit(0);
  }

  if (attempt < maxAttempts) {
    console.warn("[database] migration failed, retrying after database warmup", {
      attempt,
      maxAttempts,
      retryDelayMs,
    });

    wait(retryDelayMs);
  }
}

process.exit(status);
