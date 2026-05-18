import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPostLoginDestination } from "@/lib/permissions";

export async function POST(req: Request): Promise<Response> {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ ok: false, message: "Non autenticato" }, { status: 401 });
  }

  const body = (await req.json()) as {
    newPassword?: string;
  };
  const newPassword = String(body.newPassword ?? "").trim();

  if (newPassword.length < 6) {
    return NextResponse.json(
      { ok: false, message: "La password deve avere almeno 6 caratteri" },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, 10),
      mustChangePwd: false,
    },
  });

  return NextResponse.json({
    ok: true,
    redirectTo: await getPostLoginDestination({
      userId: session.user.id,
      role: session.user.role,
      mustChangePwd: false,
    }),
  });
}
