import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(): Promise<Response> {
  const session = await getSession();

  if (session) {
    await prisma.session.updateMany({
      where: {
        userId: session.user.id,
        token: session.token,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);

  return NextResponse.json({ ok: true });
}
