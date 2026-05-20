import "server-only";

import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

export type SessionWithUser = Prisma.SessionGetPayload<{
  include: { user: true };
}>;

export const SESSION_COOKIE_NAME = "session";
export const SESSION_PERSIST_COOKIE_NAME = "session-persist";
const DAY_IN_SECONDS = 60 * 60 * 24;
export const DEFAULT_SESSION_MAX_AGE = 30 * DAY_IN_SECONDS;
export const REMEMBER_ME_SESSION_MAX_AGE = 180 * DAY_IN_SECONDS;

export function getSessionMaxAge(rememberMe: boolean) {
  return rememberMe ? REMEMBER_ME_SESSION_MAX_AGE : DEFAULT_SESSION_MAX_AGE;
}

export function getSessionExpiresAt(rememberMe: boolean) {
  return new Date(Date.now() + getSessionMaxAge(rememberMe) * 1000);
}

export function getSessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
    expires: new Date(Date.now() + maxAge * 1000),
    priority: "high" as const,
  };
}

export function getSessionPersistenceCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
    expires: new Date(Date.now() + maxAge * 1000),
    priority: "high" as const,
  };
}

export const getSession = cache(async (): Promise<SessionWithUser | null> => {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionValue) {
    return null;
  }

  const now = new Date();
  const baseWhere = {
    revokedAt: null,
    expiresAt: {
      gt: now,
    },
  };

  let session = await prisma.session.findUnique({
    where: {
      token: sessionValue,
    },
    include: { user: true },
  });

  if (
    session &&
    (session.revokedAt !== null || session.expiresAt.getTime() <= now.getTime())
  ) {
    session = null;
  }

  if (!session) {
    session = await prisma.session.findFirst({
      where: {
        ...baseWhere,
        id: sessionValue,
      },
      include: { user: true },
    });
  }

  if (!session) {
    return null;
  }

  return session;
});

export async function getSessionPersistencePreference() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_PERSIST_COOKIE_NAME)?.value === "1";
}
