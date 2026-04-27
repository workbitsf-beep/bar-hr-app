import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { getCurrentSessionFromRequest } from "@/app/lib/auth";

const prisma = new PrismaClient();

export async function POST(req) {
  try {
    const auth = await getCurrentSessionFromRequest(req);

    if (!auth) {
      return NextResponse.json({ message: "Non autenticato" }, { status: 401 });
    }

    const body = await req.json();
    const newPassword = body?.newPassword;

    if (!newPassword) {
      return NextResponse.json(
        { message: "newPassword obbligatoria" },
        { status: 400 }
      );
    }

    if (String(newPassword).length < 6) {
      return NextResponse.json(
        { message: "La password deve avere almeno 6 caratteri" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);

    await prisma.user.update({
      where: { id: auth.user.id },
      data: {
        passwordHash,
        mustChangePwd: false,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("CHANGE_PASSWORD_ERROR", error);
    return NextResponse.json({ message: "Errore server" }, { status: 500 });
  }
}
