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

  // With more than one copy of the app running, every copy has this timer.
  // Reminders would go out once per copy, so each tick first asks Postgres
  // for an advisory lock and only the holder runs the jobs. The lock lives on
  // one dedicated connection and is released when that connection closes, so
  // if the copy holding it stops, another one takes over on its next tick.
  // Asking again on every tick also covers a connection that was recycled:
  // the new session only gets the lock if nobody else holds it.
  const CRON_LOCK_KEY = 74_210_031;
  let lockClient = null;

  function getLockClient() {
    if (lockClient || !process.env.DATABASE_URL) {
      return lockClient;
    }

    try {
      const { PrismaClient } = require("@prisma/client");
      const url = new URL(process.env.DATABASE_URL);
      url.searchParams.set("connection_limit", "1");
      lockClient = new PrismaClient({ datasourceUrl: url.toString() });
    } catch (error) {
      console.error("[internal-cron] Lock client unavailable, running unguarded.", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return lockClient;
  }

  async function holdsCronLock() {
    const client = getLockClient();

    if (!client) {
      return true;
    }

    try {
      // Already ours on this session: keep it without stacking another hold.
      const rows = await client.$queryRawUnsafe(
        `SELECT CASE WHEN EXISTS (
           SELECT 1 FROM pg_locks
           WHERE locktype = 'advisory' AND classid = 0 AND objid = ${CRON_LOCK_KEY}
             AND objsubid = 1 AND pid = pg_backend_pid() AND granted
         ) THEN true ELSE pg_try_advisory_lock(${CRON_LOCK_KEY}) END AS locked`
      );
      return Boolean(rows?.[0]?.locked);
    } catch (error) {
      console.error("[internal-cron] Could not check the cron lock.", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async function runInternalCron(url, label) {
    if (running.has(label)) {
      return;
    }

    running.add(label);
    try {
      if (!(await holdsCronLock())) {
        return;
      }

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
