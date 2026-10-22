import { canAccessBar } from "@/lib/billing";
import { getSession } from "@/lib/auth";
import { userCanAccessBar } from "@/lib/permissions";
import { buildWidgetSnapshot, readWidgetToken, widgetToken } from "@/lib/widget-snapshot";

/**
 * The widgets' data (lib/widget-snapshot.ts).
 *
 * From the app, with the session: the snapshot plus a fresh token. From the
 * widgets refreshing on their own, with `?t=` that token: the same snapshot,
 * still only while the person belongs to the venue and it is active.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t");

  if (token) {
    const holder = readWidgetToken(token);
    if (!holder) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    if (!(await userCanAccessBar(holder.userId, holder.barId)) || !(await canAccessBar(holder.barId))) {
      return Response.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }
    return Response.json(await buildWidgetSnapshot(holder.barId, holder.userId), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const session = await getSession();
  if (!session) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  if (!session.activeBarId) return Response.json({ ok: false, message: "No active bar selected" }, { status: 400 });
  if (!(await userCanAccessBar(session.user.id, session.activeBarId)) || !(await canAccessBar(session.activeBarId))) {
    return Response.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const snapshot = await buildWidgetSnapshot(session.activeBarId, session.user.id);
  return Response.json(
    { ...snapshot, token: widgetToken(session.user.id, session.activeBarId) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
