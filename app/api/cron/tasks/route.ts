import { isAuthorizedCronRequest, unauthorizedCronResponse } from "@/lib/internal-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(request)) {
    return unauthorizedCronResponse();
  }

  const [
    { runTaskEscalation },
    { runShiftRetentionCleanup },
    { runTimeLogReminders },
    { runDataRetention },
  ] = await Promise.all([
    import("@/lib/taskEscalation"),
    import("@/lib/shiftCleanup"),
    import("@/lib/timelog-reminders"),
    import("@/lib/data-retention"),
  ]);

  const [taskResult, shiftResult, timelogReminderResult, retentionResult] = await Promise.all([
    runTaskEscalation(),
    runShiftRetentionCleanup(),
    runTimeLogReminders(),
    // Declared in the legal documents, and until now enforced nowhere.
    runDataRetention(),
  ]);

  return Response.json({
    ok: true,
    retention: retentionResult,
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
