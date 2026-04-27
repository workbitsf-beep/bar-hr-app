import { withAuth } from "@/lib/withAuth";

type SessionData = {
  activeBarId: string | null;
  user: unknown;
};

export const GET = withAuth(
  async (_req: Request, session: SessionData): Promise<Response> => {
    return Response.json({
      ok: true,
      user: session.user,
      activeBarId: session.activeBarId,
    });
  }
);
