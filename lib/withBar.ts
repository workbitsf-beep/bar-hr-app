import { getSession, type SessionWithUser } from "./auth";
import { canAccessBar } from "./billing";

type SessionWithActiveBar = SessionWithUser & {
  activeBarId: string;
};

export function withBar<TContext = unknown>(
  handler: (
    req: Request,
    session: SessionWithActiveBar,
    context?: TContext
  ) => Response | Promise<Response>
) {
  return async function barHandler(req: Request, context?: TContext) {
    const session = await getSession();

    if (!session) {
      return Response.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!session.activeBarId) {
      return Response.json(
        { ok: false, message: "No active bar selected" },
        { status: 400 }
      );
    }

    if (!(await canAccessBar(session.activeBarId))) {
      return Response.json(
        {
          ok: false,
          code: "SUBSCRIPTION_REQUIRED",
          message: "Subscription required",
        },
        { status: 403 }
      );
    }

    return handler(req, session as SessionWithActiveBar, context);
  };
}
