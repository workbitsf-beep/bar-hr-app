import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { DOCUMENT_ACCESS_PARAM, resolveDocumentAccessToken } from "@/lib/document-access";
import { canViewDocument, getDocumentMimeType } from "@/lib/documents";
import { getActiveBarAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const documentFields = {
  id: true,
  barId: true,
  fileName: true,
  mimeType: true,
  content: true,
  assignedToAll: true,
  assignedToId: true,
  isActive: true,
} as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;

  if (!documentId) {
    return refuse(400, "Documento non indicato.");
  }

  const accessToken = new URL(request.url).searchParams.get(DOCUMENT_ACCESS_PARAM) ?? "";

  // A token stands in for the session when the file was opened outside the
  // app — in the phone's browser, which carries none of Workbit's cookies.
  const document = accessToken
    ? await loadForToken(accessToken, documentId)
    : await loadForSession(documentId);

  if ("error" in document) {
    return document.error;
  }

  const bytes =
    document.content instanceof Uint8Array ? document.content : new Uint8Array(document.content);
  const safeFileName = document.fileName.replaceAll('"', "'");
  const disposition =
    new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";

  return new Response(bytes, {
    headers: {
      "Content-Type": getDocumentMimeType(document.fileName, document.mimeType),
      "Content-Disposition": `${disposition}; filename="${safeFileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

async function loadForSession(documentId: string) {
  // Each refusal used to read "Not found", which hid whether the request
  // arrived without a session, without a venue, or for a document the reader
  // may not see. The three call for different actions.
  const session = await getSession();

  if (!session) {
    return {
      error: refuse(401, "Sessione assente. Apri il documento da dentro Workbit."),
    };
  }

  const { activeBar, role } = await getActiveBarAccess(session);

  if (!activeBar?.id) {
    return {
      error: refuse(409, "Nessun locale attivo su questo account: selezionane uno e riprova."),
    };
  }

  const document = await prisma.document.findFirst({
    where: { id: documentId, barId: activeBar.id },
    select: documentFields,
  });

  if (!document) {
    return { error: refuse(404, "Documento non presente in questo locale.") };
  }

  if (!canViewDocument(document, session.user.id, role)) {
    return { error: refuse(403, "Questo documento non è assegnato al tuo account.") };
  }

  return document;
}

async function loadForToken(token: string, documentId: string) {
  const userId = await resolveDocumentAccessToken(token, documentId);

  if (!userId) {
    return {
      error: refuse(410, "Questo collegamento è scaduto. Torna su Workbit e riapri il documento."),
    };
  }

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: documentFields,
  });

  if (!document) {
    return { error: refuse(404, "Documento non più disponibile.") };
  }

  // The permission is checked again rather than trusted from when the link was
  // made, so a document withdrawn in the meantime stops opening at once.
  const role = await getRoleInBar(userId, document.barId);

  if (!role || !canViewDocument(document, userId, role)) {
    return { error: refuse(403, "Questo documento non è più accessibile a questo account.") };
  }

  return document;
}

async function getRoleInBar(userId: string, barId: string) {
  const bar = await prisma.bar.findUnique({ where: { id: barId }, select: { ownerId: true } });

  if (!bar) {
    return null;
  }

  if (bar.ownerId === userId) {
    return Role.OWNER;
  }

  const membership = await prisma.employeeBar.findUnique({
    where: { userId_barId: { userId, barId } },
    select: { role: true, isActive: true },
  });

  return membership?.isActive ? membership.role : null;
}

/** Plain text, so the reason is readable wherever the file was opened. */
function refuse(status: number, message: string) {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
