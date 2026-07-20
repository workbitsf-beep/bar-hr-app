import { isAuthorizedCronRequest, unauthorizedCronResponse } from "@/lib/internal-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(request)) {
    return unauthorizedCronResponse();
  }

  const { runTimeLogReminders } = await import("@/lib/timelog-reminders");
  const result = await runTimeLogReminders();

  return Response.json({
    ok: true,
    checkedReminderShiftCount: result.checkedShiftCount,
    createdClockReminderCount: result.createdReminderCount,
    backfilledReminderShiftCount: result.backfilledReminderShiftCount,
    backfilledClockReminderCount: result.backfilledReminderCount,
    autoClockOutCount: result.autoClockOutCount,
  });
}
