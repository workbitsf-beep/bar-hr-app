import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isMissingWebAuthnTableError } from "@/lib/webauthn";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { ok: false, message: "Sessione scaduta. Accedi di nuovo." },
      { status: 401 }
    );
  }

  try {
    await prisma.$transaction([
      prisma.webAuthnCredential.deleteMany({
        where: {
          userId: session.user.id,
        },
      }),
      prisma.webAuthnChallenge.deleteMany({
        where: {
          userId: session.user.id,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      message: "Passkey biometrica pronta per essere aggiornata.",
    });
  } catch (error) {
    if (isMissingWebAuthnTableError(error)) {
      return NextResponse.json(
        { ok: false, message: "La tabella delle passkey non è disponibile." },
        { status: 500 }
      );
    }

    console.error("[webauthn] passkey reset failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { ok: false, message: "Impossibile aggiornare la passkey biometrica." },
      { status: 500 }
    );
  }
}
