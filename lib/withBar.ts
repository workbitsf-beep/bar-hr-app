import { getSession } from "./auth";
import { canAccessBar } from "./billing";

type BarHandler = (
  req: Request,
  session: any,
  context?: any
) => Response | Promise<Response>;

export function withBar(handler: BarHandler) {
  return async function barHandler(req: Request, context?: any) {
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

    return handler(req, session, context);
  };
}
