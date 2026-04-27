import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { prisma } from "../../lib/prisma";

type SessionWithUser = Prisma.SessionGetPayload<{
  include: { user: true };
}>;

export async function getSession(): Promise<SessionWithUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findFirst({
    where: {
      token,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: true,
    },
  });

  return session ?? null;
}
