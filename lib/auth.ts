import "server-only";

import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export type SessionWithUser = Prisma.SessionGetPayload<{
  include: { user: true };
}>;

export async function getSession(): Promise<SessionWithUser | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;

  if (!sessionId) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  return session;
}
