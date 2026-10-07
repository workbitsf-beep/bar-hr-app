import { getActiveBarAccess } from "@/lib/permissions";
import { getVenueStatus } from "@/lib/venue-status";
import { withBar } from "@/lib/withBar";

/** The live line under the venue's name, refreshed by the header. */
export const GET = withBar(async (req, session): Promise<Response> => {
  const access = await getActiveBarAccess(session as never);
  const status = await getVenueStatus({
    barId: session.activeBarId,
    userId: session.user.id,
    role: access.role,
    shiftsEnabled: new URL(req.url).searchParams.get("shifts") === "1",
  });

  return Response.json({ ok: true, status }, { headers: { "Cache-Control": "no-store" } });
});
