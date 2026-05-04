import "server-only";

import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export type SessionWithUser = Prisma.SessionGetPayload<{
  include: { user: true };
}>;

export async function getSession(): Promise<SessionWithUser | null> {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get("session")?.value;

  if (!sessionValue) {
    return null;
  }

  const session = await prisma.session.findFirst({
    where: {
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
      OR: [{ token: sessionValue }, { id: sessionValue }],
    },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  return session;
}
