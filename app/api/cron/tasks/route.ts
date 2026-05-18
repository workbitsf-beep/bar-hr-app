import { runTaskEscalation } from "@/lib/taskEscalation";
import { runShiftRetentionCleanup } from "@/lib/shiftCleanup";

export async function GET(): Promise<Response> {
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
