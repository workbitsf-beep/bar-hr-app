import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getChallengeExpiresAt,
  getWebAuthnConfig,
  isMissingWebAuthnTableError,
  pruneExpiredWebAuthnChallenges,
  WEBAUTHN_AUTHENTICATION_CHALLENGE,
} from "@/lib/webauthn";

export const runtime = "nodejs";

type AuthenticationOptionsBody = {
  email?: string;
};

export async function POST(req: Request): Promise<Response> {
  try {
    const { rpID } = getWebAuthnConfig(req);
    const body = (await req.json().catch(() => null)) as AuthenticationOptionsBody | null;
    const email = String(body?.email ?? "").trim().toLowerCase();

    await pruneExpiredWebAuthnChallenges();

    let allowCredentials:
      | {
          id: string;
          transports: AuthenticatorTransportFuture[];
        }[]
      | undefined;
    let challengeUserId: string | null = null;

    if (email) {
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          webAuthnCredentials: {
            select: {
              credentialId: true,
              transports: true,
            },
          },
        },
      });

      if (!user || user.webAuthnCredentials.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Nessuna biometria trovata per questa email. Accedi con email e password, poi attivala da Impostazioni.",
          },
          { status: 409 }
        );
      }

      challengeUserId = user.id;
      allowCredentials = user.webAuthnCredentials.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports as AuthenticatorTransportFuture[],
      }));
    } else {
      const registeredPasskeyCount = await prisma.webAuthnCredential.count();

      if (registeredPasskeyCount === 0) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Nessuna biometria e ancora registrata. Accedi con email e password, poi attivala da Impostazioni.",
          },
          { status: 409 }
        );
      }
    }

    const options = await generateAuthenticationOptions({
      rpID,
      timeout: 60_000,
      userVerification: "required",
      allowCredentials,
    });

    await prisma.webAuthnChallenge.create({
      data: {
        challenge: options.challenge,
        type: WEBAUTHN_AUTHENTICATION_CHALLENGE,
        userId: challengeUserId,
        expiresAt: getChallengeExpiresAt(),
      },
    });

    return NextResponse.json({ ok: true, options });
  } catch (error) {
    console.error("[webauthn] authentication options failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    if (isMissingWebAuthnTableError(error)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "La biometria non e ancora pronta sul database. Esegui le migration e riprova.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { ok: false, message: "Impossibile avviare l'accesso biometrico." },
      { status: 500 }
    );
  }
}
