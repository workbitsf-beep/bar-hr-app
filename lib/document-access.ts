import "server-only";

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Short-lived permission to fetch one document from outside the session.
 *
 * The installed app cannot display a file itself: it hands the address to the
 * phone's browser, which is a separate application and carries none of
 * Workbit's cookies. So the permission travels in the address instead. It is
 * issued only after the usual checks have passed, names one document and one
 * reader, and dies within minutes.
 */
const TOKEN_TTL_MS = 10 * 60 * 1000;

export const DOCUMENT_ACCESS_PARAM = "k";

export async function createDocumentAccessToken(documentId: string, userId: string) {
  const token = randomBytes(32).toString("base64url");

  await prisma.documentAccessToken.create({
    data: {
      token,
      documentId,
      userId,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  return token;
}

/**
 * Returns the reader the token stands for, or null when it means nothing.
 *
 * Expired tokens are cleared as they are met, which keeps the table from
 * growing without a scheduled job.
 */
export async function resolveDocumentAccessToken(token: string, documentId: string) {
  if (!token) {
    return null;
  }

  const record = await prisma.documentAccessToken.findUnique({
    where: { token },
    select: { id: true, documentId: true, userId: true, expiresAt: true },
  });

  if (!record || record.documentId !== documentId) {
    return null;
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    await prisma.documentAccessToken.delete({ where: { id: record.id } }).catch(() => {});

    return null;
  }

  return record.userId;
}

export async function pruneExpiredDocumentAccessTokens() {
  await prisma.documentAccessToken
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {});
}
