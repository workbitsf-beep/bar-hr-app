export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const [{ runTaskEscalation }, { runShiftRetentionCleanup }] = await Promise.all([
    import("@/lib/taskEscalation"),
    import("@/lib/shiftCleanup"),
  ]);

  const [taskResult, shiftResult] = await Promise.all([
    runTaskEscalation(),
    runShiftRetentionCleanup(),
  ]);

  return Response.json({
    ok: true,
    updatedCount: taskResult.count,
    deletedShiftCount: shiftResult.deletedShiftCount,
    deletedRequestCount: shiftResult.deletedRequestCount,
    detachedTimeLogCount: shiftResult.detachedTimeLogCount,
  });
}
