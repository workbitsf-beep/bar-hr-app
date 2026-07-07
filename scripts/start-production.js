const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const path = require("node:path");

process.env.NODE_ENV = process.env.NODE_ENV || "production";

if (
  process.env.DISABLE_INTERNAL_CRON !== "true" &&
  !process.env.INTERNAL_CRON_SECRET &&
  !process.env.CRON_SECRET
) {
  process.env.INTERNAL_CRON_SECRET = crypto.randomUUID();
}

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

if (process.env.DISABLE_INTERNAL_CRON !== "true") {
  const port = process.env.PORT || "3000";
  const cronSecret = process.env.INTERNAL_CRON_SECRET || process.env.CRON_SECRET || "";
  const cronUrl = `http://127.0.0.1:${port}/api/cron/tasks`;
  let running = false;

  async function runInternalCron() {
    if (running) {
      return;
    }

    running = true;
    try {
      const response = await fetch(cronUrl, {
        method: "GET",
        headers: {
          "x-workbit-internal-cron": cronSecret,
        },
      });

      if (!response.ok) {
        console.error("[internal-cron] Cron endpoint returned an error.", {
          status: response.status,
        });
      }
    } catch (error) {
      console.error("[internal-cron] Failed to run scheduled tasks.", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      running = false;
    }
  }

  setTimeout(() => {
    void runInternalCron();
    setInterval(() => {
      void runInternalCron();
    }, 60_000).unref?.();
  }, 20_000).unref?.();
}
