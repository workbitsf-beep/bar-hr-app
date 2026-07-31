import { isAuthorizedCronRequest, unauthorizedCronResponse } from "@/lib/internal-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(request)) {
    return unauthorizedCronResponse();
  }

  const mode = new URL(request.url).searchParams.get("mode");
  const { runDueTimeLogReminderNotifications, runTimeLogReminders } = await import(
    "@/lib/timelog-reminders"
  );
  const result =
    mode === "due"
      ? await runDueTimeLogReminderNotifications()
      : await runTimeLogReminders();

  return Response.json({
    ok: true,
    checkedReminderShiftCount: "checkedShiftCount" in result ? result.checkedShiftCount : 0,
    createdClockReminderCount: result.createdReminderCount,
    backfilledReminderShiftCount: "backfilledReminderShiftCount" in result ? result.backfilledReminderShiftCount : 0,
    backfilledClockReminderCount: "backfilledReminderCount" in result ? result.backfilledReminderCount : 0,
    autoClockOutCount: "autoClockOutCount" in result ? result.autoClockOutCount : 0,
    checkedScheduledNotificationCount: result.checkedScheduledNotificationCount,
    sentScheduledNotificationCount: result.sentScheduledNotificationCount,
    skippedScheduledNotificationCount: result.skippedScheduledNotificationCount,
  });
}
