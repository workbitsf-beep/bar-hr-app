import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A legal document's PDF opened from the installed app goes to the phone's
 * browser, which has none of Workbit's cookies. The address carries a
 * permission instead, signed and good for a day. Legal documents are
 * the same text for everyone, so nothing more than "someone signed in asked
 * for this one, just now" is needed.
 */
// Long enough for a page left open; the text is the same for everyone.
const TTL_MS = 24 * 60 * 60 * 1000;

// Any server-only secret will do; production has no SESSION_SECRET, and a
// missing one used to break every page that lists legal documents.
function secret() {
  const value =
    process.env.LEGAL_LINK_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    process.env.STRIPE_WEBHOOK_SECRET?.trim() ||
    process.env.DATABASE_URL?.trim();
  return value || "workbit-legal-links";
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
