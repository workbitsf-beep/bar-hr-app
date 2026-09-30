import { isAuthorizedCronRequest, unauthorizedCronResponse } from "@/lib/internal-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(request)) {
    return unauthorizedCronResponse();
  }

  const [
    { runTaskEscalation },
    { runTaskRecurrence },
    { runShiftRetentionCleanup },
    { runTimeLogReminders },
    { runDataRetention },
    { runTrialEndingReminders },
  ] = await Promise.all([
    import("@/lib/taskEscalation"),
    import("@/lib/task-recurrence"),
    import("@/lib/shiftCleanup"),
    import("@/lib/timelog-reminders"),
    import("@/lib/data-retention"),
    import("@/lib/trial-reminders"),
  ]);

  // Recurrence runs before escalation: escalation rewrites an overdue note's
  // date to tomorrow, which would otherwise move the series' anchor every day
  // it stayed untouched.
  const recurrenceResult = await runTaskRecurrence();

  const [taskResult, shiftResult, timelogReminderResult, retentionResult, trialResult] =
    await Promise.all([
      runTaskEscalation(),
      runShiftRetentionCleanup(),
      runTimeLogReminders(),
      // Declared in the legal documents, and until now enforced nowhere.
      runDataRetention(),
      // Tre giorni prima che una prova diventi un addebito, si avvisa.
      runTrialEndingReminders(),
    ]);

  return Response.json({
    ok: true,
    retention: retentionResult,
    trialEndingNotices: trialResult,
    updatedCount: taskResult.count,
    renewedRecurringTaskCount: recurrenceResult.count,
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
