import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getChallengeExpiresAt,
  getWebAuthnConfig,
  pruneExpiredWebAuthnChallenges,
  userIdToWebAuthnUserID,
  WEBAUTHN_REGISTRATION_CHALLENGE,
} from "@/lib/webauthn";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { ok: false, message: "Devi accedere prima di registrare la biometria." },
      { status: 401 }
    );
  }

  try {
    const { rpName, rpID } = getWebAuthnConfig(req);

    await pruneExpiredWebAuthnChallenges();

    const existingCredentials = await prisma.webAuthnCredential.findMany({
      where: { userId: session.user.id },
      select: {
        credentialId: true,
        transports: true,
      },
    });

    const displayName = `${session.user.firstName} ${session.user.lastName}`.trim() || session.user.email;
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: userIdToWebAuthnUserID(session.user.id),
      userName: session.user.email,
      userDisplayName: displayName,
      timeout: 60_000,
      attestationType: "none",
      excludeCredentials: existingCredentials.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports as AuthenticatorTransportFuture[],
      })),
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "required",
        requireResidentKey: true,
        userVerification: "required",
      },
      preferredAuthenticatorType: "localDevice",
    });

    await prisma.webAuthnChallenge.create({
      data: {
        challenge: options.challenge,
        type: WEBAUTHN_REGISTRATION_CHALLENGE,
        userId: session.user.id,
        expiresAt: getChallengeExpiresAt(),
      },
    });

    return NextResponse.json({ ok: true, options });
  } catch (error) {
    console.error("[webauthn] registration options failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { ok: false, message: "Impossibile avviare la registrazione biometrica." },
      { status: 500 }
    );
  }
}
