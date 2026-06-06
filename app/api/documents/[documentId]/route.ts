import { getSession } from "@/lib/auth";
import { canViewDocument } from "@/lib/documents";
import { getActiveBarAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await getSession();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { activeBar, role } = await getActiveBarAccess(session);
  const { documentId } = await params;

  if (!activeBar?.id || !documentId) {
    return new Response("Not found", { status: 404 });
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

  if (!document || !canViewDocument(document, session.user.id, role)) {
    return new Response("Not found", { status: 404 });
  }

  const bytes = document.content instanceof Uint8Array ? document.content : new Uint8Array(document.content);
  const safeFileName = document.fileName.replaceAll('"', "'");

  return new Response(bytes, {
    headers: {
      "Content-Type": document.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeFileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
