/**
 * Builds an EMPTY database straight from the current schema.
 *
 * The migration history cannot rebuild the database from nothing: the second
 * "init" rewrites the first prototype's tables, and later files index tables
 * that only arrive after them. Production never noticed, because it grew
 * along the way. A new environment, or a restore onto a blank database, stops
 * at the second migration and the app never starts.
 *
 * So when the database has no tables at all, the schema is pushed as it is
 * today and every migration is recorded as applied, with the checksum Prisma
 * itself would compute. migrate deploy then finds nothing to do, and any
 * migration added later applies normally.
 *
 * A database with even one table is left alone: this never runs on
 * production, nor on anything that already holds data.
 *
 * Exit 0 when the database was already there or has just been built.
 */
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const MIGRATIONS_DIR = path.join(__dirname, "..", "prisma", "migrations");
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

async function main() {
  // One connection is all this needs, and the database may be near its limit
  // while the previous copies of the app are still up.
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("connection_limit", "1");
  const prisma = new PrismaClient({ datasourceUrl: url.toString() });

  try {
    const [{ count }] = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS count FROM information_schema.tables
       WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'`
    );

    if (count > 0) {
      return;
    }

    console.info("[database] empty database: building it from the current schema");

    const push = spawnSync(npxCommand, ["prisma", "db", "push", "--skip-generate"], {
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
    });

    if (push.status !== 0) {
      throw new Error("prisma db push failed");
    }

    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY NOT NULL,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )`);

    const migrations = fs
      .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    for (const name of migrations) {
      const file = path.join(MIGRATIONS_DIR, name, "migration.sql");

      if (!fs.existsSync(file)) {
        continue;
      }

      const checksum = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

      await prisma.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations"
           ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
         VALUES ($1, $2, now(), $3, now(), 1)`,
        crypto.randomUUID(),
        checksum,
        name
      );
    }

    console.info("[database] empty database built", { migrations: migrations.length });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[database] could not build the empty database", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
