"use server";

import { LegalDocumentType, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getCompanyProfile,
  readCompanyProfileFromForm,
  saveCompanyProfile,
} from "@/lib/company-profile";
import { LEGAL_TEMPLATES } from "@/lib/legal-templates";
import { INTERNAL_NOTIFICATION_TYPES, notifyUsers } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../../context";

const MAX_LEGAL_PDF_SIZE = 12 * 1024 * 1024;

function parseDocumentType(value: FormDataEntryValue | null): LegalDocumentType {
  const raw = String(value ?? "");
  if (Object.values(LegalDocumentType).includes(raw as LegalDocumentType)) {
    return raw as LegalDocumentType;
  }
  return LegalDocumentType.OTHER;
}

async function ensureSuperAdmin() {
  const { role } = await getDashboardContext();
  if (String(role) !== "SUPER_ADMIN") {
    throw new Error("Unauthorized");
  }
}

async function readPdfFile(formData: FormData) {
  const entry = formData.get("pdfFile");

  if (!(entry instanceof File) || entry.size === 0) {
    return null;
  }

  if (entry.type && entry.type !== "application/pdf") {
    throw new Error("Legal document must be a PDF");
  }

  if (entry.size > MAX_LEGAL_PDF_SIZE) {
    throw new Error("Legal document PDF is too large");
  }

  const bytes = Buffer.from(await entry.arrayBuffer());

  return {
    fileName: entry.name || "documento-legale.pdf",
    fileMimeType: "application/pdf",
    fileSize: entry.size,
    fileContent: bytes,
    fileUrl: null,
  };
}

async function getDocumentPayload(formData: FormData, options?: { requireBody?: boolean }) {
  const title = String(formData.get("title") ?? "").trim();
  const version = String(formData.get("version") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const pdfFile = await readPdfFile(formData);

  if (!title || !version) {
    throw new Error("Missing legal document data");
  }

  // The public page shows the text and offers the PDF alongside it when there
  // is one, so demanding a PDF to publish meant a privacy policy written as
  // text could not go up at all. One of the two is enough; neither is not.
  if (options?.requireBody && !content && !pdfFile) {
    throw new Error("Missing legal document body");
  }

  return {
    title,
    version,
    type: parseDocumentType(formData.get("type")),
    content: content || null,
    isActive: formData.get("isActive") === "on",
    isRequired: formData.get("isRequired") === "on",
    pdfFile,
  };
}

function refreshLegalPages() {
  revalidatePath("/dashboard/super-admin/legal");
  revalidatePath("/dashboard/settings");
  revalidatePath("/legal/accept");
}

async function notifyOwnersForLegalDocument(input: {
  title: string;
  action: "created" | "updated";
  isActive: boolean;
  isRequired: boolean;
}) {
  if (!input.isActive || !input.isRequired) {
    return;
  }

  const owners = await prisma.user.findMany({
    where: { role: Role.OWNER },
    select: { id: true },
  });

  await notifyUsers(owners, {
    barId: null,
    title: input.action === "created" ? "Nuovo documento da accettare" : "Documento aggiornato",
    message:
      input.action === "created"
        ? `E disponibile un nuovo documento legale da accettare: ${input.title}.`
        : `E stato aggiornato un documento legale da accettare: ${input.title}.`,
    type: INTERNAL_NOTIFICATION_TYPES.LEGAL_DOCUMENT_REQUIRED,
    actionUrl: "/legal/accept",
  });
}

export async function createLegalDocumentAction(formData: FormData) {
  await ensureSuperAdmin();
  const payload = await getDocumentPayload(formData, { requireBody: true });

  await prisma.legalDocument.create({
    data: {
      title: payload.title,
      version: payload.version,
      type: payload.type,
      content: payload.content,
      isActive: payload.isActive,
      isRequired: payload.isRequired,
      ...(payload.pdfFile ?? {}),
    },
  });

  await notifyOwnersForLegalDocument({
    title: payload.title,
    action: "created",
    isActive: payload.isActive,
    isRequired: payload.isRequired,
  });

  refreshLegalPages();
  redirect("/dashboard/super-admin/legal?success=created");
}

export async function updateLegalDocumentAction(formData: FormData) {
  await ensureSuperAdmin();
  const documentId = String(formData.get("documentId") ?? "");
  if (!documentId) {
    throw new Error("Missing legal document id");
  }

  const payload = await getDocumentPayload(formData);

  await prisma.legalDocument.update({
    where: { id: documentId },
    data: {
      title: payload.title,
      version: payload.version,
      type: payload.type,
      content: payload.content,
      isActive: payload.isActive,
      isRequired: payload.isRequired,
      revision: {
        increment: 1,
      },
      ...(payload.pdfFile ?? {}),
    },
  });

  await notifyOwnersForLegalDocument({
    title: payload.title,
    action: "updated",
    isActive: payload.isActive,
    isRequired: payload.isRequired,
  });

  refreshLegalPages();
  redirect("/dashboard/super-admin/legal?success=updated");
}

export async function saveCompanyProfileAction(formData: FormData) {
  await ensureSuperAdmin();
  await saveCompanyProfile(readCompanyProfileFromForm(formData));

  refreshLegalPages();
  redirect("/dashboard/super-admin/legal?success=profile");
}

/**
 * Writes a document from its template, keeping whatever is already published.
 *
 * An existing document of the same type is updated rather than duplicated, and
 * stays as it was regarding activation and acceptance: regenerating the text
 * must not quietly publish something, nor quietly ask everyone to accept again.
 */
export async function generateLegalDocumentAction(formData: FormData) {
  await ensureSuperAdmin();

  const requested = String(formData.get("templateType") ?? "");
  const template = LEGAL_TEMPLATES.find((entry) => entry.type === requested);

  if (!template) {
    throw new Error("Unknown legal template");
  }

  const profile = await getCompanyProfile();
  const content = template.build(profile);
  const existing = await prisma.legalDocument.findFirst({
    where: { type: template.type },
    orderBy: [{ updatedAt: "desc" }],
    select: { id: true },
  });

  if (existing) {
    await prisma.legalDocument.update({
      where: { id: existing.id },
      data: {
        title: template.title,
        version: profile.documentVersion || "1.0",
        content,
        revision: { increment: 1 },
      },
    });
  } else {
    await prisma.legalDocument.create({
      data: {
        title: template.title,
        version: profile.documentVersion || "1.0",
        type: template.type,
        content,
        // Created switched off on purpose: it goes public when you decide it
        // is finished, not when it is generated.
        isActive: false,
        isRequired: false,
      },
    });
  }

  refreshLegalPages();
  redirect("/dashboard/super-admin/legal?success=generated");
}

export async function deleteLegalDocumentAction(formData: FormData) {
  await ensureSuperAdmin();
  const documentId = String(formData.get("documentId") ?? "");
  if (!documentId) {
    throw new Error("Missing legal document id");
  }

  await prisma.legalDocument.delete({
    where: { id: documentId },
  });
  refreshLegalPages();
  redirect("/dashboard/super-admin/legal?success=deleted");
}
