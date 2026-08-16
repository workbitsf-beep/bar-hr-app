import "server-only";

import { LegalDocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const publicLegalDocumentTypes = [
  LegalDocumentType.PRIVACY_POLICY,
  LegalDocumentType.TERMS_AND_CONDITIONS,
  LegalDocumentType.COOKIE_POLICY,
  LegalDocumentType.ACCOUNT_DELETION,
  LegalDocumentType.GEOLOCATION_NOTICE,
] as const;

export function isPublicLegalDocumentType(value: string): value is LegalDocumentType {
  return publicLegalDocumentTypes.includes(value as (typeof publicLegalDocumentTypes)[number]);
}

export function getSupportEmail() {
  return process.env.SUPPORT_EMAIL?.trim() || "support@workbit.it";
}

export async function getLatestPublicLegalDocument(type: LegalDocumentType) {
  return prisma.legalDocument.findFirst({
    where: { type, isActive: true },
    orderBy: [{ updatedAt: "desc" }, { revision: "desc" }],
    select: {
      id: true,
      title: true,
      type: true,
      version: true,
      revision: true,
      content: true,
      fileName: true,
      fileMimeType: true,
      fileSize: true,
      fileContent: true,
      updatedAt: true,
    },
  });
}
