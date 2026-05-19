import bcrypt from "bcrypt";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getSessionCookieOptions,
  getSessionExpiresAt,
  getSessionMaxAge,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LANGUAGE_COOKIE_NAME } from "@/lib/language";
import { getAccessibleBarsForUser, getPostLoginDestination } from "@/lib/permissions";

type LoginBody = {
  email?: string;
  password?: string;
  rememberMe?: boolean;
};

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as LoginBody;
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const rememberMe = body.rememberMe === true;

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, message: "Credenziali non valide" },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
      role: true,
      language: true,
      mustChangePwd: true,
    },
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json(
      { ok: false, message: "Credenziali non valide" },
      { status: 401 }
    );
  }

  const accessibleBars = await getAccessibleBarsForUser(user.id);
  const activeBarId = accessibleBars[0]?.id ?? null;
  const sessionToken = crypto.randomUUID();
  const sessionMaxAge = getSessionMaxAge(rememberMe);

  await prisma.session.create({
    data: {
      token: sessionToken,
      userId: user.id,
      activeBarId,
      expiresAt: getSessionExpiresAt(rememberMe),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, getSessionCookieOptions(sessionMaxAge));
  cookieStore.set(LANGUAGE_COOKIE_NAME, user.language, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({
    ok: true,
    redirectTo: await getPostLoginDestination({
      userId: user.id,
      role: user.role,
      mustChangePwd: user.mustChangePwd,
    }),
  });
}
