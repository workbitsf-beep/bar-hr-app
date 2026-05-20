import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getWebAuthnConfig,
  WEBAUTHN_REGISTRATION_CHALLENGE,
} from "@/lib/webauthn";

export const runtime = "nodejs";

type RegistrationVerifyBody = {
  response?: RegistrationResponseJSON;
};

export async function POST(req: Request): Promise<Response> {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { ok: false, message: "Sessione scaduta. Accedi di nuovo." },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => null)) as RegistrationVerifyBody | null;

  if (!body?.response) {
    return NextResponse.json(
      { ok: false, message: "Risposta biometrica non valida." },
      { status: 400 }
    );
  }

  try {
    const { origin, rpID } = getWebAuthnConfig(req);
    let challengeId: string | null = null;

    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      expectedChallenge: async (challenge) => {
        const storedChallenge = await prisma.webAuthnChallenge.findFirst({
          where: {
            challenge,
            type: WEBAUTHN_REGISTRATION_CHALLENGE,
            userId: session.user.id,
            expiresAt: {
              gt: new Date(),
            },
          },
          select: { id: true },
        });

        challengeId = storedChallenge?.id ?? null;
        return Boolean(storedChallenge);
      },
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { ok: false, message: "Registrazione biometrica non verificata." },
        { status: 400 }
      );
    }

    const { credential, credentialBackedUp, credentialDeviceType } = verification.registrationInfo;
    const existingCredential = await prisma.webAuthnCredential.findUnique({
      where: { credentialId: credential.id },
      select: { userId: true },
    });

    if (existingCredential) {
      return NextResponse.json(
        { ok: false, message: "Questa passkey e gia registrata." },
        { status: 409 }
      );
    }

    await prisma.$transaction([
      ...(challengeId
        ? [
            prisma.webAuthnChallenge.delete({
              where: { id: challengeId },
            }),
          ]
        : []),
      prisma.webAuthnCredential.create({
        data: {
          userId: session.user.id,
          credentialId: credential.id,
          publicKey: credential.publicKey,
          counter: credential.counter,
          transports: body.response.response.transports ?? credential.transports ?? [],
          credentialDeviceType,
          credentialBackedUp,
        },
      }),
    ]);

    return NextResponse.json({ ok: true, message: "Biometria attivata su questo dispositivo." });
  } catch (error) {
    console.error("[webauthn] registration verify failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { ok: false, message: "Impossibile completare la registrazione biometrica." },
      { status: 400 }
    );
  }
}
