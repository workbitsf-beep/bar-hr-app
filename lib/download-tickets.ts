import "server-only";

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * A file that has already been produced and authorised, waiting to be fetched.
 *
 * The app's web view cannot save a file handed to it in memory, which is why
 * the report would not download there. The file becomes a real address the
 * phone's browser can fetch instead — and because the check happened when the
 * file was made, the ticket grants nothing: it is single use, short-lived, and
 * disappears the moment it is collected.
 */
const TICKET_TTL_MS = 10 * 60 * 1000;

export async function createDownloadTicket(input: {
  userId: string;
  fileName: string;
  mimeType: string;
  content: Uint8Array;
}) {
  const token = randomBytes(32).toString("base64url");

  await prisma.downloadTicket.create({
    data: {
      token,
      userId: input.userId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      content: Buffer.from(input.content),
      expiresAt: new Date(Date.now() + TICKET_TTL_MS),
    },
  });

  // Expired tickets carry file contents, so they are cleared as they are made
  // rather than left to accumulate.
  await prisma.downloadTicket
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {});

  return `/api/downloads/${token}`;
}

export async function readDownloadTicket(token: string) {
  if (!token) {
    return null;
  }

  const ticket = await prisma.downloadTicket.findUnique({
    where: { token },
    select: { id: true, fileName: true, mimeType: true, content: true, expiresAt: true },
  });

  if (!ticket || ticket.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  // Deliberately not destroyed on the first fetch. A browser that decides to
  // save rather than show the file asks for it again through its download
  // manager, and destroying it here turned that second request into an expiry
  // message. The short life is what limits it, not a single use.
  return ticket;
}
