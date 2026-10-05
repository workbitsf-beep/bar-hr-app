import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { sendTemporaryPasswordEmail } from "@/lib/email/notifications";
import { prisma } from "@/lib/prisma";
import { createTemporaryPassword } from "@/lib/temporary-password";
import { createAttemptThrottle } from "@/lib/attempt-throttle";
import { callerKey } from "@/lib/signup-throttle";

// Three emails an hour per address, twenty per caller: enough for a person
// who mistyped, not for flooding someone's inbox.
const perAddress = createAttemptThrottle(60 * 60 * 1000, 3);
const perCaller = createAttemptThrottle(60 * 60 * 1000, 20);

// A temporary password is good for a day; after that it must be asked again.
const TEMPORARY_PASSWORD_TTL_MS = 24 * 60 * 60 * 1000;

type ForgotPasswordBody = {
  email?: string;
};

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as ForgotPasswordBody;
  const email = String(body.email ?? "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json(
      { ok: false, message: "Inserisci un indirizzo email valido." },
      { status: 400 }
    );
  }

  const caller = callerKey(req);

  if (!perAddress.isAllowed(email) || !perCaller.isAllowed(caller)) {
    // The same answer as success: a limit reached says nothing about the address.
    return NextResponse.json({ ok: true });
  }

  perAddress.record(email);
  perCaller.record(caller);

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      retiredAt: true,
    },
  });

  if (!user || user.retiredAt) {
    return NextResponse.json({ ok: true });
  }

  // The real password stays as it is. Before, it was replaced on the spot and
  // every session closed, so anyone who knew an address could throw that
  // person out of the app mid-shift, again and again.
  const temporaryPassword = createTemporaryPassword();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      tempPasswordHash: await bcrypt.hash(temporaryPassword, 10),
      tempPasswordExpiresAt: new Date(Date.now() + TEMPORARY_PASSWORD_TTL_MS),
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
      data: { tempPasswordHash: null, tempPasswordExpiresAt: null },
    });

    return NextResponse.json(
      { ok: false, message: "Invio email non disponibile in questo momento." },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true });
}
