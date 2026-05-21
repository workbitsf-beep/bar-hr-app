const bcrypt = require("bcrypt");
const { PrismaClient, Role } = require("@prisma/client");

if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env");
}

function readEnvironmentValue(name) {
  const value = String(process.env[name] || "").trim();
  return value || null;
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

function buildDatabaseUrlFromPgEnvironment() {
  const host = readEnvironmentValue("PGHOST");
  const user = readEnvironmentValue("PGUSER");
  const password = readEnvironmentValue("PGPASSWORD");
  const database = readEnvironmentValue("PGDATABASE");
  const port = readEnvironmentValue("PGPORT") || "5432";

  if (!host || !user || !password || !database) {
    return null;
  }

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${encodeURIComponent(port)}/${encodeURIComponent(database)}`;
}

function resolveDatabaseUrl() {
  return (
    toValidPostgresUrl(readEnvironmentValue("DATABASE_PRIVATE_URL")) ||
    toValidPostgresUrl(readEnvironmentValue("DATABASE_URL")) ||
    toValidPostgresUrl(buildDatabaseUrlFromPgEnvironment())
  );
}

async function main() {
  const databaseUrl = resolveDatabaseUrl();
  const email = readEnvironmentValue("SUPER_ADMIN_EMAIL");
  const password = readEnvironmentValue("SUPER_ADMIN_PASSWORD");

  if (!databaseUrl) {
    throw new Error("Database URL is not configured.");
  }

  if (!email || !password) {
    throw new Error("Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD before running this seed.");
  }

  if (password.length < 8) {
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 8 characters.");
  }

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.upsert({
      where: { email },
      update: {
        firstName: "Super",
        lastName: "Admin",
        role: Role.SUPER_ADMIN,
        mustChangePwd: true,
        passwordHash,
      },
      create: {
        email,
        firstName: "Super",
        lastName: "Admin",
        role: Role.SUPER_ADMIN,
        mustChangePwd: true,
        passwordHash,
      },
    });

    console.info("[seed] super admin ready", { email });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[seed] super admin failed", error);
  process.exitCode = 1;
});
