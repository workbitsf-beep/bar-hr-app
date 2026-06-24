"use server";

import { LegalDocumentType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../../context";

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

function getDocumentPayload(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const version = String(formData.get("version") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const fileUrl = String(formData.get("fileUrl") ?? "").trim();

  if (!title || !version) {
    throw new Error("Missing legal document data");
  }

  return {
    title,
    version,
    type: parseDocumentType(formData.get("type")),
    content: content || null,
    fileUrl: fileUrl || null,
    isActive: formData.get("isActive") === "on",
    isRequired: formData.get("isRequired") === "on",
  };
}

function refreshLegalPages() {
  revalidatePath("/dashboard/super-admin/legal");
  revalidatePath("/dashboard/settings");
  revalidatePath("/legal/accept");
}

export async function createLegalDocumentAction(formData: FormData) {
  await ensureSuperAdmin();
  await prisma.legalDocument.create({
    data: getDocumentPayload(formData),
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

  await prisma.legalDocument.update({
    where: { id: documentId },
    data: getDocumentPayload(formData),
  });
  refreshLegalPages();
  redirect("/dashboard/super-admin/legal?success=updated");
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
