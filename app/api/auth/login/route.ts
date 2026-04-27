import bcrypt from "bcrypt";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as LoginBody;
  const { email, password } = body;

  if (!email || !password) {
    return Response.json(
      { ok: false, message: "Invalid credentials" },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (!user) {
    return Response.json(
      { ok: false, message: "Invalid credentials" },
      { status: 401 }
    );
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    return Response.json(
      { ok: false, message: "Invalid credentials" },
      { status: 401 }
    );
  }

  const sessionId = crypto.randomUUID();

  await prisma.session.create({
    data: {
      id: sessionId,
      token: sessionId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      user: {
        connect: {
          id: user.id,
        },
      },
    },
  });

  const cookieStore = await cookies();
  cookieStore.set("session", sessionId, {
    httpOnly: true,
    path: "/",
  });

  return Response.json({ ok: true });
}
