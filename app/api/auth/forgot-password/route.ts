import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { sendTemporaryPasswordEmail } from "@/lib/email/notifications";
import { prisma } from "@/lib/prisma";

type ForgotPasswordBody = {
  email?: string;
};

function createTemporaryPassword() {
  return `Workbit-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as ForgotPasswordBody;
  const email = String(body.email ?? "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json(
      { ok: false, message: "Inserisci un indirizzo email valido." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      passwordHash: true,
      mustChangePwd: true,
    },
  });

  if (!user) {
    return NextResponse.json({ ok: true });
  }

  const temporaryPassword = createTemporaryPassword();
  const nextPasswordHash = await bcrypt.hash(temporaryPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: nextPasswordHash,
      mustChangePwd: true,
    },
  });

  const emailResult = await sendTemporaryPasswordEmail(
    user.email,
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || "utente",
    temporaryPassword
  );

  if (!emailResult.ok) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: user.passwordHash,
        mustChangePwd: user.mustChangePwd,
      },
    });

    return NextResponse.json(
      { ok: false, message: "Invio email non disponibile in questo momento." },
      { status: 503 }
    );
  }

  await prisma.session.updateMany({
    where: {
      userId: user.id,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
