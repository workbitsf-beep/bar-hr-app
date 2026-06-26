import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { getActiveBarAccess, canManageTrainingAndDocuments } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { INTERNAL_NOTIFICATION_TYPES, notifyUsers } from "@/lib/notifications";

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

type NotificationUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function dedupeUsers(users: NotificationUser[]) {
  const byId = new Map<string, NotificationUser>();

  for (const user of users) {
    byId.set(user.id, user);
  }

  return Array.from(byId.values());
}

async function ensureUserBelongsToBar(barId: string, userId: string) {
  const membership = await prisma.employeeBar.findFirst({
    where: {
      barId,
      userId,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!membership) {
    throw new Error("Destinatario non associato a questa attivita.");
  }
}

async function getDocumentRecipients(barId: string) {
  const bar = await prisma.bar.findUnique({
    where: { id: barId },
    select: {
      name: true,
      owner: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      memberships: {
        where: {
          isActive: true,
        },
        select: {
          role: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  if (!bar) {
    return null;
  }

  const owner: NotificationUser = {
    id: bar.owner.id,
    email: bar.owner.email,
    firstName: bar.owner.firstName,
    lastName: bar.owner.lastName,
    role: Role.OWNER,
  };

  return {
    barName: bar.name,
    users: dedupeUsers([
      owner,
      ...bar.memberships.map((membership) => ({
        id: membership.user.id,
        email: membership.user.email,
        firstName: membership.user.firstName,
        lastName: membership.user.lastName,
        role: membership.role,
      })),
    ]),
  };
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return jsonError("Non autenticato.", 401);
  }

  const { activeBar, role } = await getActiveBarAccess(session);

  if (!activeBar?.id) {
    return jsonError("Nessuna attivita selezionata.", 400);
  }

  if (!canManageTrainingAndDocuments(role)) {
    return jsonError("Permesso non sufficiente.", 403);
  }

  const settings = await prisma.barSettings.findUnique({
    where: { barId: activeBar.id },
    select: { documentsEnabled: true },
  });

  if (settings?.documentsEnabled === false) {
    return jsonError("Modulo documenti disattivato.", 403);
  }

  const formData = await request.formData();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const audience = String(formData.get("audience") ?? "ALL").trim().toUpperCase();
  const assignedToAll = audience !== "USER";
  const assignedToId = String(formData.get("assignedToId") ?? "").trim();
  const fileEntry = formData.get("file");

  if (!title) {
    return jsonError("Inserisci il titolo del documento.");
  }

  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    return jsonError("Seleziona un file da caricare.");
  }

  if (fileEntry.size > MAX_DOCUMENT_BYTES) {
    return jsonError("File troppo grande. Massimo 8 MB.");
  }

  if (!assignedToAll && !assignedToId) {
    return jsonError("Seleziona almeno un destinatario.");
  }

  try {
    if (!assignedToAll) {
      await ensureUserBelongsToBar(activeBar.id, assignedToId);
    }

    const content = Buffer.from(await fileEntry.arrayBuffer());
    const document = await prisma.document.create({
      data: {
        barId: activeBar.id,
        title,
        description: description || null,
        fileName: fileEntry.name || title,
        mimeType: fileEntry.type || "application/octet-stream",
        fileSize: fileEntry.size,
        content,
        assignedToAll,
        assignedToId: assignedToAll ? null : assignedToId,
        createdById: session.user.id,
      },
      select: {
        id: true,
        title: true,
      },
    });

    const notificationContext = await getDocumentRecipients(activeBar.id);

    if (notificationContext) {
      const recipients = assignedToAll
        ? notificationContext.users.filter((user) => user.id !== session.user.id)
        : notificationContext.users.filter(
            (user) => user.id === assignedToId && user.id !== session.user.id
          );

      if (recipients.length > 0) {
        await notifyUsers(recipients, {
          barId: activeBar.id,
          title: "Nuovo documento",
          message: `${document.title} e disponibile nei documenti di ${notificationContext.barName}.`,
          type: INTERNAL_NOTIFICATION_TYPES.DOCUMENT_CREATED,
          actionUrl: "/dashboard/documents",
        });
      }
    }

    return NextResponse.json({ ok: true, documentId: document.id });
  } catch (error) {
    console.error("[documents] upload failed", {
      error: error instanceof Error ? error.message : "Unexpected error",
    });

    return jsonError(
      error instanceof Error ? error.message : "Impossibile caricare il documento.",
      500
    );
  }
}
