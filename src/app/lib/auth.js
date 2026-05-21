import { prisma } from "@/lib/prisma";

function getCookieValue(cookieHeader, name) {
  const parts = cookieHeader.split(";");

  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return "";
}

export async function getCurrentSessionFromRequest(req) {
  const cookieHeader = req?.headers?.get("cookie") || "";
  const token = getCookieValue(cookieHeader, "session");

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

  if (!session || !session.user) {
    return null;
  }

  return { session, user: session.user };
}
