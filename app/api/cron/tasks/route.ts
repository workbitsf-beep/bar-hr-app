import { runTaskEscalation } from "@/lib/taskEscalation";

export async function GET(): Promise<Response> {
  const result = await runTaskEscalation();

  return Response.json({
    ok: true,
    updatedCount: result.count,
  });
}
