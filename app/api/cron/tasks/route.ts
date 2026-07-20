import { isAuthorizedCronRequest, unauthorizedCronResponse } from "@/lib/internal-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(request)) {
    return unauthorizedCronResponse();
  }

  const [{ runTaskEscalation }, { runShiftRetentionCleanup }, { runTimeLogReminders }] = await Promise.all([
    import("@/lib/taskEscalation"),
    import("@/lib/shiftCleanup"),
    import("@/lib/timelog-reminders"),
  ]);

  const [taskResult, shiftResult, timelogReminderResult] = await Promise.all([
    runTaskEscalation(),
    runShiftRetentionCleanup(),
    runTimeLogReminders(),
  ]);

  return Response.json({
    ok: true,
    updatedCount: taskResult.count,
    deletedShiftCount: shiftResult.deletedShiftCount,
    deletedRequestCount: shiftResult.deletedRequestCount,
    detachedTimeLogCount: shiftResult.detachedTimeLogCount,
    deletedAvailabilityCount: shiftResult.deletedAvailabilityCount,
    deletedCourseCount: shiftResult.deletedCourseCount,
    deletedClosureCount: shiftResult.deletedClosureCount,
    deletedTaskCount: shiftResult.deletedTaskCount,
    deletedNoteCount: shiftResult.deletedNoteCount,
    checkedReminderShiftCount: timelogReminderResult.checkedShiftCount,
    createdClockReminderCount: timelogReminderResult.createdReminderCount,
    backfilledReminderShiftCount: timelogReminderResult.backfilledReminderShiftCount,
    backfilledClockReminderCount: timelogReminderResult.backfilledReminderCount,
    autoClockOutCount: timelogReminderResult.autoClockOutCount,
    restaurantCutoff: shiftResult.restaurantCutoff,
    companyCutoff: shiftResult.companyCutoff,
  });
}
