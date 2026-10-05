import { getSession, type SessionWithUser } from "./auth";
import { canAccessBar } from "./billing";
import { userCanAccessBar } from "./permissions";

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

    // The bar on the session was checked when it was chosen, not since. Someone
    // removed from it kept a session pointing at it, and every route below
    // read its data with a role resolved from whichever bar they still had -
    // an owner of their own bar became an owner here too.
    if (!(await userCanAccessBar(session.user.id, session.activeBarId))) {
      return Response.json(
        { ok: false, message: "Forbidden" },
        { status: 403 }
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
