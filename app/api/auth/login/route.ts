import bcrypt from "bcrypt";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LANGUAGE_COOKIE_NAME } from "@/lib/language";
import { getAccessibleBarsForUser, getPostLoginDestination } from "@/lib/permissions";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as LoginBody;
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

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

  await prisma.session.create({
    data: {
      token: sessionToken,
      userId: user.id,
      activeBarId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set("session", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
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
