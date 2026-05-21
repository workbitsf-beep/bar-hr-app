const { spawnSync } = require("node:child_process");
const path = require("node:path");

process.env.NODE_ENV = process.env.NODE_ENV || "production";

if (process.env.SKIP_PRISMA_MIGRATE !== "true") {
  const migrationScript = path.join(__dirname, "prisma-migrate-deploy.js");
  const migrationResult = spawnSync(process.execPath, [migrationScript], {
    stdio: "inherit",
    env: process.env,
  });

  if (migrationResult.status !== 0) {
    process.exit(migrationResult.status ?? 1);
  }
}

require("../server");
