import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getSession,
  getSessionCookieOptions,
  getSessionExpiresAt,
  getSessionMaxAge,
  getSessionPersistenceCookieOptions,
  getSessionPersistencePreference,
  SESSION_COOKIE_NAME,
  SESSION_PERSIST_COOKIE_NAME,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(): Promise<Response> {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const rememberMe = await getSessionPersistencePreference();
  const sessionMaxAge = getSessionMaxAge(rememberMe);
  const nextExpiresAt = getSessionExpiresAt(rememberMe);

  await prisma.session.update({
    where: {
      token: session.token,
    },
    data: {
      expiresAt: nextExpiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, session.token, getSessionCookieOptions(sessionMaxAge));
  cookieStore.set(
    SESSION_PERSIST_COOKIE_NAME,
    rememberMe ? "1" : "0",
    getSessionPersistenceCookieOptions(sessionMaxAge)
  );

  return NextResponse.json({ ok: true });
}
