const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const path = require("node:path");

process.env.NODE_ENV = process.env.NODE_ENV || "production";

// The container runs in UTC, and the app reads "today" from the server's own
// clock: which day a shift belongs to, whether a day is in the past, what the
// calendar marks as today. Between midnight and two in the morning Italian
// time, UTC is still yesterday, so the whole app was a day behind for those
// two hours every night. Europe/Rome is already what APP_TIME_ZONE says the
// venues run on, so the process runs on it too. Must be set before anything
// formats a date.
process.env.TZ = process.env.TZ || "Europe/Rome";

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
  const maintenanceCronUrl = `http://127.0.0.1:${port}/api/cron/tasks`;
  const clockReminderCronUrl = `http://127.0.0.1:${port}/api/cron/timelog-reminders?mode=due`;
  const clockReminderIntervalMs = Number(process.env.CLOCK_REMINDER_CRON_INTERVAL_MS || 15_000);
  const maintenanceIntervalMs = Number(process.env.MAINTENANCE_CRON_INTERVAL_MS || 300_000);
  const running = new Set();

  async function runInternalCron(url, label) {
    if (running.has(label)) {
      return;
    }

    running.add(label);
    try {
      const response = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(60_000),
        headers: {
          "x-workbit-internal-cron": cronSecret,
        },
      });

      if (!response.ok) {
        console.error("[internal-cron] Cron endpoint returned an error.", {
          label,
          status: response.status,
        });
      }
    } catch (error) {
      console.error("[internal-cron] Failed to run scheduled tasks.", {
        label,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      running.delete(label);
    }
  }

  setTimeout(() => {
    void runInternalCron(clockReminderCronUrl, "clock-reminders");
    setInterval(() => {
      void runInternalCron(clockReminderCronUrl, "clock-reminders");
    }, Number.isFinite(clockReminderIntervalMs) && clockReminderIntervalMs > 0 ? clockReminderIntervalMs : 15_000).unref?.();
  }, 5_000).unref?.();

  setTimeout(() => {
    void runInternalCron(maintenanceCronUrl, "maintenance");
    setInterval(() => {
      void runInternalCron(maintenanceCronUrl, "maintenance");
    }, Number.isFinite(maintenanceIntervalMs) && maintenanceIntervalMs > 0 ? maintenanceIntervalMs : 300_000).unref?.();
  }, 20_000).unref?.();
}
