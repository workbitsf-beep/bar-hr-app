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
    { runFiscalSending },
    { runForgottenExits },
  ] = await Promise.all([
    import("@/lib/taskEscalation"),
    import("@/lib/task-recurrence"),
    import("@/lib/shiftCleanup"),
    import("@/lib/timelog-reminders"),
    import("@/lib/data-retention"),
    import("@/lib/trial-reminders"),
    import("@/lib/invoicing/send"),
    import("@/lib/forgotten-exits"),
  ]);

  // Recurrence runs before escalation: escalation rewrites an overdue note's
  // date to tomorrow, which would otherwise move the series' anchor every day
  // it stayed untouched.
  const recurrenceResult = await runTaskRecurrence();

  const [taskResult, shiftResult, timelogReminderResult, retentionResult, trialResult, fiscalResult, forgottenExitResult] =
    await Promise.all([
      runTaskEscalation(),
      runShiftRetentionCleanup(),
      runTimeLogReminders(),
      // Declared in the legal documents, and until now enforced nowhere.
      runDataRetention(),
      // Tre giorni prima che una prova diventi un addebito, si avvisa.
      runTrialEndingReminders(),
      // E-invoices still to send, and the SDI's answers a callback missed.
      runFiscalSending().catch((error) => ({ error: error instanceof Error ? error.message : "errore" })),
      // An exit left unstamped stops the hours at the shift's end, provisionally.
      runForgottenExits().catch((error) => ({ error: error instanceof Error ? error.message : "errore" })),
    ]);

  return Response.json({
    ok: true,
    retention: retentionResult,
    trialEndingNotices: trialResult,
    fiscalSending: fiscalResult,
    forgottenExits: forgottenExitResult,
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
    createdClockReminderCount: timelogReminderResult.createdReminderCount,
    backfilledReminderShiftCount: timelogReminderResult.backfilledReminderShiftCount,
    backfilledClockReminderCount: timelogReminderResult.backfilledReminderCount,
    restaurantCutoff: shiftResult.restaurantCutoff,
    companyCutoff: shiftResult.companyCutoff,
  });
}
