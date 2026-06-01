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
    currentPassword?: string;
    requireCurrentPassword?: boolean;
  };
  const newPassword = String(body.newPassword ?? "").trim();
  const currentPassword = String(body.currentPassword ?? "").trim();
  const requireCurrentPassword = Boolean(body.requireCurrentPassword);

  if (newPassword.length < 6) {
    return NextResponse.json(
      { ok: false, message: "La password deve avere almeno 6 caratteri" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      passwordHash: true,
      mustChangePwd: true,
    },
  });

  if (!user) {
    return NextResponse.json({ ok: false, message: "Utente non trovato" }, { status: 404 });
  }

  if (requireCurrentPassword || currentPassword.length > 0) {
    if (!currentPassword) {
      return NextResponse.json(
        { ok: false, message: "Inserisci la password attuale" },
        { status: 400 }
      );
    }

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!matches) {
      return NextResponse.json(
        { ok: false, message: "Password attuale non valida" },
        { status: 400 }
      );
    }
  } else if (!user.mustChangePwd && requireCurrentPassword) {
    return NextResponse.json(
      { ok: false, message: "Inserisci la password attuale" },
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
