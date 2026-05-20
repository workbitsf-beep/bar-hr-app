import "server-only";

import type {
  AuthenticatorTransportFuture,
  Base64URLString,
  WebAuthnCredential,
} from "@simplewebauthn/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const WEBAUTHN_REGISTRATION_CHALLENGE = "registration";
export const WEBAUTHN_AUTHENTICATION_CHALLENGE = "authentication";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export function getWebAuthnConfig(req: Request) {
  const configuredOrigin = process.env.WEBAUTHN_ORIGIN || process.env.APP_URL;
  const origin = normalizeOrigin(configuredOrigin) ?? getForwardedOrigin(req) ?? new URL(req.url).origin;
  const rpID = normalizeRpID(process.env.WEBAUTHN_RP_ID) ?? new URL(origin).hostname;

  return {
    rpName: process.env.WEBAUTHN_RP_NAME || "Workbit",
    rpID,
    origin,
  };
}

export function getChallengeExpiresAt() {
  return new Date(Date.now() + CHALLENGE_TTL_MS);
}

export async function pruneExpiredWebAuthnChallenges() {
  await prisma.webAuthnChallenge.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
}

export function isMissingWebAuthnTableError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021";
}

export function userIdToWebAuthnUserID(userId: string) {
  return new TextEncoder().encode(userId);
}

export function toWebAuthnCredential(input: {
  credentialId: string;
  publicKey: Uint8Array;
  counter: number;
  transports: string[];
}): WebAuthnCredential {
  return {
    id: input.credentialId as Base64URLString,
    publicKey: input.publicKey as WebAuthnCredential["publicKey"],
    counter: input.counter,
    transports: input.transports as AuthenticatorTransportFuture[],
  };
}

export function getSafeWebAuthnMessage(error: unknown) {
  if (error instanceof Error && error.name === "NotAllowedError") {
    return "Operazione annullata o non autorizzata dal dispositivo.";
  }

  return "Autenticazione biometrica non riuscita. Riprova o usa email e password.";
}

function normalizeOrigin(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function normalizeRpID(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).hostname;
  } catch {
    return trimmed.replace(/^https?:\/\//, "").split("/")[0].split(":")[0] || null;
  }
}

function getForwardedOrigin(req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");

  if (!host) {
    return null;
  }

  const proto =
    req.headers.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");

  return `${proto}://${host}`;
}
