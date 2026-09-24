import { getSession } from "@/lib/auth";
import { canViewDocument, getDocumentMimeType } from "@/lib/documents";
import { getActiveBarAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  // Every refusal used to read "Not found", which hid whether the request
  // arrived without a session, without a venue, or for a document the reader
  // may not see. The three need different actions from whoever hits them.
  const session = await getSession();

  if (!session) {
    return refuse(
      401,
      "Sessione assente. Questa pagina si apre solo da dentro Workbit, con l'account già collegato."
    );
  }

  const { activeBar, role } = await getActiveBarAccess(session);
  const { documentId } = await params;

  if (!documentId) {
    return refuse(400, "Documento non indicato.");
  }

  if (!activeBar?.id) {
    return refuse(409, "Nessun locale attivo su questo account: selezionane uno e riprova.");
  }

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      barId: activeBar.id,
    },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      content: true,
      assignedToAll: true,
      assignedToId: true,
      isActive: true,
    },
  });

  if (!document) {
    return refuse(404, "Documento non presente in questo locale.");
  }

  if (!canViewDocument(document, session.user.id, role)) {
    return refuse(403, "Questo documento non è assegnato al tuo account.");
  }

  const bytes = document.content instanceof Uint8Array ? document.content : new Uint8Array(document.content);
  const safeFileName = document.fileName.replaceAll('"', "'");
  const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";

  return new Response(bytes, {
    headers: {
      "Content-Type": getDocumentMimeType(document.fileName, document.mimeType),
      "Content-Disposition": `${disposition}; filename="${safeFileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
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
