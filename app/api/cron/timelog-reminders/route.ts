export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const { runTimeLogReminders } = await import("@/lib/timelog-reminders");
  const result = await runTimeLogReminders();

  return Response.json({
    ok: true,
    checkedReminderShiftCount: result.checkedShiftCount,
    createdClockReminderCount: result.createdReminderCount,
    autoClockOutCount: result.autoClockOutCount,
  });
}
