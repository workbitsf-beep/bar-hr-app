import { getSession } from "./auth";

type AuthHandler = (
  req: Request,
  session: any,
  context?: any
) => Promise<Response>;

export function withAuth(handler: AuthHandler) {
  return async function authedHandler(req: Request, context?: any) {
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
