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

export async function POST(req: Request): Promise<Response> {
  try {
    const { rpID } = getWebAuthnConfig(req);

    await pruneExpiredWebAuthnChallenges();

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

    const options = await generateAuthenticationOptions({
      rpID,
      timeout: 60_000,
      userVerification: "required",
    });

    await prisma.webAuthnChallenge.create({
      data: {
        challenge: options.challenge,
        type: WEBAUTHN_AUTHENTICATION_CHALLENGE,
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
