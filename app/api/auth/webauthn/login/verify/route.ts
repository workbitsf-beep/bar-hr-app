import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getSessionCookieOptions,
  getSessionExpiresAt,
  getSessionMaxAge,
  getSessionPersistenceCookieOptions,
  SESSION_COOKIE_NAME,
  SESSION_PERSIST_COOKIE_NAME,
} from "@/lib/auth";
import { LANGUAGE_COOKIE_NAME } from "@/lib/language";
import { getAccessibleBarsForUser, getPostLoginDestination } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { THEME_COOKIE_NAME } from "@/lib/theme";
import {
  getWebAuthnConfig,
  toWebAuthnCredential,
  WEBAUTHN_AUTHENTICATION_CHALLENGE,
} from "@/lib/webauthn";

export const runtime = "nodejs";

type AuthenticationVerifyBody = {
  response?: AuthenticationResponseJSON;
  rememberMe?: boolean;
};

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as AuthenticationVerifyBody | null;

  if (!body?.response) {
    return NextResponse.json(
      { ok: false, message: "Risposta biometrica non valida." },
      { status: 400 }
    );
  }

  try {
    const credentialRecord = await prisma.webAuthnCredential.findUnique({
      where: { credentialId: body.response.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            language: true,
            theme: true,
            mustChangePwd: true,
          },
        },
      },
    });

    if (!credentialRecord) {
      return NextResponse.json(
        { ok: false, message: "Passkey non riconosciuta su Workbit." },
        { status: 401 }
      );
    }

    const { origin, rpID } = getWebAuthnConfig(req);
    let challengeId: string | null = null;

    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: toWebAuthnCredential({
        credentialId: credentialRecord.credentialId,
        publicKey: credentialRecord.publicKey,
        counter: credentialRecord.counter,
        transports: credentialRecord.transports,
      }),
      expectedChallenge: async (challenge) => {
        const storedChallenge = await prisma.webAuthnChallenge.findFirst({
          where: {
            challenge,
            type: WEBAUTHN_AUTHENTICATION_CHALLENGE,
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

    if (!verification.verified) {
      return NextResponse.json(
        { ok: false, message: "Firma biometrica non verificata." },
        { status: 401 }
      );
    }

    const rememberMe = body.rememberMe !== false;
    const accessibleBars = await getAccessibleBarsForUser(
      credentialRecord.user.id,
      credentialRecord.user.role
    );
    const activeBarId = accessibleBars[0]?.id ?? null;
    const sessionToken = crypto.randomUUID();
    const sessionMaxAge = getSessionMaxAge(rememberMe);

    await prisma.$transaction([
      ...(challengeId
        ? [
            prisma.webAuthnChallenge.delete({
              where: { id: challengeId },
            }),
          ]
        : []),
      prisma.webAuthnCredential.update({
        where: { id: credentialRecord.id },
        data: {
          counter: verification.authenticationInfo.newCounter,
          credentialDeviceType: verification.authenticationInfo.credentialDeviceType,
          credentialBackedUp: verification.authenticationInfo.credentialBackedUp,
          lastUsedAt: new Date(),
        },
      }),
      prisma.session.create({
        data: {
          token: sessionToken,
          userId: credentialRecord.user.id,
          activeBarId,
          expiresAt: getSessionExpiresAt(rememberMe),
        },
      }),
    ]);

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionToken, getSessionCookieOptions(sessionMaxAge));
    cookieStore.set(
      SESSION_PERSIST_COOKIE_NAME,
      rememberMe ? "1" : "0",
      getSessionPersistenceCookieOptions(sessionMaxAge)
    );
    cookieStore.set(LANGUAGE_COOKIE_NAME, credentialRecord.user.language, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    cookieStore.set(THEME_COOKIE_NAME, credentialRecord.user.theme, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return NextResponse.json({
      ok: true,
      email: credentialRecord.user.email,
      promptPasskeySetup: false,
      redirectTo: await getPostLoginDestination({
        userId: credentialRecord.user.id,
        role: credentialRecord.user.role,
        mustChangePwd: credentialRecord.user.mustChangePwd,
        activeBarId,
      }),
    });
  } catch (error) {
    console.error("[webauthn] authentication verify failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { ok: false, message: "Accesso biometrico non riuscito." },
      { status: 401 }
    );
  }
}
