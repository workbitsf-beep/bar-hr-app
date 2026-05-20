import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getChallengeExpiresAt,
  getWebAuthnConfig,
  pruneExpiredWebAuthnChallenges,
  WEBAUTHN_AUTHENTICATION_CHALLENGE,
} from "@/lib/webauthn";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  try {
    const { rpID } = getWebAuthnConfig(req);

    await pruneExpiredWebAuthnChallenges();

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

    return NextResponse.json(
      { ok: false, message: "Impossibile avviare l'accesso biometrico." },
      { status: 500 }
    );
  }
}
