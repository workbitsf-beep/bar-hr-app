import { Role } from "@prisma/client";

const documentMimeTypesByExtension: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsm: "application/vnd.ms-excel.sheet.macroenabled.12",
};

export type DocumentPreviewKind = "pdf" | "word" | "spreadsheet" | "unsupported";

export type DocumentVisibility = {
  assignedToAll: boolean;
  assignedToId: string | null;
  isActive: boolean;
};

export function canViewDocument(
  document: DocumentVisibility,
  userId: string,
  role: Role | string
) {
  if (role === Role.OWNER || role === Role.MANAGER || role === Role.AMMINISTRAZIONE) {
    return true;
  }

  if (!document.isActive) {
    return false;
  }

  return document.assignedToAll || document.assignedToId === userId;
}

export function formatDocumentSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 KB";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round((bytes / 1024) * 10) / 10} KB`;
  }

  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

export function getDocumentMimeType(fileName: string, storedMimeType?: string | null) {
  const cleanStoredMimeType = storedMimeType?.trim();

  if (cleanStoredMimeType && cleanStoredMimeType !== "application/octet-stream") {
    return cleanStoredMimeType;
  }

  const extension = fileName.split(".").pop()?.trim().toLowerCase() ?? "";

  return documentMimeTypesByExtension[extension] ?? cleanStoredMimeType ?? "application/octet-stream";
}

export function getDocumentPreviewKind(
  fileName: string,
  storedMimeType?: string | null
): DocumentPreviewKind {
  const extension = fileName.split(".").pop()?.trim().toLowerCase() ?? "";
  const mimeType = getDocumentMimeType(fileName, storedMimeType).toLowerCase();

  if (extension === "pdf" || mimeType === "application/pdf") {
    return "pdf";
  }

  if (
    extension === "docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "word";
  }

  if (
    extension === "xlsx" ||
    extension === "xlsm" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel.sheet.macroenabled.12"
  ) {
    return "spreadsheet";
  }

  return "unsupported";
}
