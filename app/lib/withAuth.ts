import { NextResponse } from "next/server";
import { getSession } from "./auth";

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

type AuthedHandler<TContext = unknown> = (
  req: Request,
  session: Session,
  context: TContext
) => Response | Promise<Response>;

export function withAuth<TContext = unknown>(
  handler: AuthedHandler<TContext>
) {
  return async function authedHandler(req: Request, context: TContext) {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { message: "Non autenticato" },
        { status: 401 }
      );
    }

    return handler(req, session, context);
  };
}
