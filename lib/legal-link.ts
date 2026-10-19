import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A legal document's PDF opened from the installed app goes to the phone's
 * browser, which has none of Workbit's cookies. The address carries a
 * permission instead, signed and good for ten minutes. Legal documents are
 * the same text for everyone, so nothing more than "someone signed in asked
 * for this one, just now" is needed.
 */
const TTL_MS = 10 * 60 * 1000;

function secret() {
  const value = process.env.SESSION_SECRET?.trim();
  if (!value) throw new Error("SESSION_SECRET missing");
  return value;
}

function sign(documentId: string, expires: number) {
  return createHmac("sha256", secret()).update(`legal:${documentId}:${expires}`).digest("base64url");
}

export function legalDocumentLink(documentId: string) {
  const expires = Date.now() + TTL_MS;
  return `/api/legal-documents/${documentId}?e=${expires}&s=${sign(documentId, expires)}`;
}

export function legalLinkIsValid(documentId: string, expiresRaw: string | null, signature: string | null) {
  const expires = Number(expiresRaw);
  if (!signature || !Number.isFinite(expires) || expires < Date.now()) return false;
  try {
    const expected = Buffer.from(sign(documentId, expires));
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}
