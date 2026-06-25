import "server-only";

import { Role, type LegalDocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const legalDocumentTypeLabels: Record<LegalDocumentType, string> = {
  PRIVACY_POLICY: "Privacy Policy",
  TERMS_AND_CONDITIONS: "Termini e Condizioni",
  COOKIE_POLICY: "Cookie Policy",
  ACCOUNT_DELETION: "Eliminazione Account",
  GEOLOCATION_NOTICE: "Informativa Geolocalizzazione",
  DPA: "DPA",
  SAAS_CONTRACT: "Contratto SaaS",
  OTHER: "Altro",
};

export async function getRequiredLegalDocumentsForUser(userId: string) {
  const documents = await prisma.legalDocument.findMany({
    where: {
      isActive: true,
      isRequired: true,
    },
    orderBy: [{ type: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      type: true,
      version: true,
      revision: true,
      content: true,
      fileUrl: true,
      fileName: true,
      fileMimeType: true,
      fileSize: true,
      updatedAt: true,
      acceptances: {
        where: { userId },
        select: {
          id: true,
          version: true,
          revision: true,
          acceptedAt: true,
        },
      },
    },
  });

  return documents.filter((document) =>
    document.acceptances.every(
      (acceptance) => acceptance.version !== document.version || acceptance.revision !== document.revision
    )
  );
}

export async function ownerNeedsLegalAcceptance(input: {
  userId: string;
  role: Role;
}) {
  if (input.role !== Role.OWNER) {
    return false;
  }

  const missing = await getRequiredLegalDocumentsForUser(input.userId);
  return missing.length > 0;
}

export async function getLegalDocumentsWithAcceptance(userId: string) {
  return prisma.legalDocument.findMany({
    where: {
      isActive: true,
    },
    orderBy: [{ type: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      type: true,
      version: true,
      revision: true,
      content: true,
      fileUrl: true,
      fileName: true,
      fileMimeType: true,
      fileSize: true,
      isRequired: true,
      updatedAt: true,
      acceptances: {
        where: { userId },
        orderBy: { acceptedAt: "desc" },
        select: {
          version: true,
          revision: true,
          acceptedAt: true,
        },
      },
    },
  });
}
