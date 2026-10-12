/**
 * Sets up an EMPTY database (a test copy, a second environment) for Workbit.
 *
 * The migration history cannot be replayed from nothing: the early schema was
 * created by hand, and 20260520124500_add_performance_indexes indexes columns
 * that only appear later. So this pushes the current schema in one go, then
 * records every migration as applied, so `prisma migrate deploy` works from
 * here on exactly as in production.
 *
 *   DATABASE_URL=postgresql://... node scripts/create-fresh-db.js
 *
 * It refuses a database that already has tables: production is never touched.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL to the empty database first.");
  process.exit(1);
}

function prisma(args) {
  const result = spawnSync("npx", ["prisma", ...args], { stdio: "pipe", encoding: "utf8", shell: true, env: process.env });
  return { ok: result.status === 0, out: `${result.stdout}${result.stderr}` };
}

// Empty means no tables at all in the public schema.
const probe = spawnSync(
  "npx",
  ["prisma", "db", "execute", "--stdin", "--schema", "prisma/schema.prisma"],
  {
    input: "DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public') THEN RAISE EXCEPTION 'not empty'; END IF; END $$;",
    stdio: ["pipe", "pipe", "pipe"],
    encoding: "utf8",
    shell: true,
    env: process.env,
  }
);
if (probe.status !== 0) {
  console.error("This database already has tables: refusing. Use it with `npm run migrate:deploy` instead.");
  process.exit(1);
}

const push = prisma(["db", "push", "--skip-generate"]);
if (!push.ok) {
  console.error(push.out);
  process.exit(1);
}

const migrations = fs
  .readdirSync(path.join(__dirname, "..", "prisma", "migrations"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const name of migrations) {
  const resolved = prisma(["migrate", "resolve", "--applied", name]);
  if (!resolved.ok) {
    console.error(`Could not mark ${name} as applied:\n${resolved.out}`);
    process.exit(1);
  }
}

console.log(`Schema created and ${migrations.length} migrations marked as applied.`);
