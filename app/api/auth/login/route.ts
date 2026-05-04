import bcrypt from "bcrypt";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type LoginBody = {
  email?: string;
  password?: string;
};

type AuthenticatedUser = {
  id: string;
  passwordHash: string;
};

async function authenticateUser(
  email: string,
  password: string
): Promise<AuthenticatedUser | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    return null;
  }

  return user;
}

async function createSession(userId: string): Promise<string> {
  const sessionToken = crypto.randomUUID();

  await prisma.session.create({
    data: {
      token: sessionToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      user: {
        connect: {
          id: userId,
        },
      },
    },
  });

  return sessionToken;
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as LoginBody;
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, message: "Invalid credentials" },
      { status: 401 }
    );
  }

  const user = await authenticateUser(email, password);

  if (!user) {
    return NextResponse.json(
      { ok: false, message: "Invalid credentials" },
      { status: 401 }
    );
  }

  // Authentication is complete at this point. Session handling starts below.
  const sessionToken = await createSession(user.id);

  const cookieStore = await cookies();
  cookieStore.set("session", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
