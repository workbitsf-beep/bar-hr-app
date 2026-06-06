import { Role } from "@prisma/client";

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
  if (role === Role.OWNER || role === Role.MANAGER) {
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
