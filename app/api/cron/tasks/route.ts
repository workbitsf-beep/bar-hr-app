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
    { runInboxSync },
    { runPayrollReminders },
    { runCourseReminders },
    { runAccountantNotices },
    { runPaymentReminders },
    { runMarketReminder },
  ] = await Promise.all([
    import("@/lib/taskEscalation"),
    import("@/lib/task-recurrence"),
    import("@/lib/shiftCleanup"),
    import("@/lib/timelog-reminders"),
    import("@/lib/data-retention"),
    import("@/lib/trial-reminders"),
    import("@/lib/invoicing/send"),
    import("@/lib/forgotten-exits"),
    import("@/lib/costs/openapi-inbox"),
    import("@/lib/payroll/reminders"),
    import("@/lib/course-certificates"),
    import("@/lib/accountant/invoices"),
    import("@/lib/costs/payments"),
    import("@/lib/costs/market"),
  ]);

  // Recurrence runs before escalation: escalation rewrites an overdue note's
  // date to tomorrow, which would otherwise move the series' anchor every day
  // it stayed untouched.
  const recurrenceResult = await runTaskRecurrence();

  const [taskResult, shiftResult, timelogReminderResult, retentionResult, trialResult, fiscalResult, forgottenExitResult, inboxResult, payrollResult, courseResult, accountantResult, paymentResult, marketResult] =
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
      // Supplier invoices waiting at Openapi for venues that receive them there.
      runInboxSync().catch((error) => ({ error: error instanceof Error ? error.message : "errore" })),
      // On the day each owner chose: last month's attendance is ready to send.
      runPayrollReminders().catch((error) => ({ error: error instanceof Error ? error.message : "errore" })),
      // Certificates about to lapse: time to book the course again.
      runCourseReminders().catch((error) => ({ error: error instanceof Error ? error.message : "errore" })),
      // From the 2nd: each accountant hears that last month's invoices are ready.
      runAccountantNotices().catch((error) => ({ error: error instanceof Error ? error.message : "errore" })),
      // Supplier bonifici: three days before, and "did you pay?" the day after.
      runPaymentReminders().catch((error) => ({ error: error instanceof Error ? error.message : "errore" })),
      // From the 3rd: the super admins type in last month's market prices.
      runMarketReminder().catch((error) => ({ error: error instanceof Error ? error.message : "errore" })),
    ]);

  return Response.json({
    ok: true,
    retention: retentionResult,
    trialEndingNotices: trialResult,
    fiscalSending: fiscalResult,
    forgottenExits: forgottenExitResult,
    supplierInvoiceInbox: inboxResult,
    payrollReminders: payrollResult,
    courseReminders: courseResult,
    accountantNotices: accountantResult,
    paymentReminders: paymentResult,
    marketReminder: marketResult,
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
