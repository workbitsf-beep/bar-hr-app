import { getSession, type SessionWithUser } from "./auth";

export function withAuth<TContext = unknown>(
  handler: (
    req: Request,
    session: SessionWithUser,
    context?: TContext
  ) => Promise<Response>
) {
  return async function authedHandler(req: Request, context?: TContext) {
    const session = await getSession();

    if (!session) {
      return Response.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    return handler(req, session, context);
  };
}
