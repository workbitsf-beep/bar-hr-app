import { getSession } from "@/lib/auth";
import { renderSpreadsheetPreview, renderUnsupportedPreview, renderWordPreview } from "@/lib/document-preview";
import { canViewDocument, getDocumentPreviewKind } from "@/lib/documents";
import { getActiveBarAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function htmlResponse(content: string, status = 200) {
  return new Response(content, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

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
    where: { id: documentId, barId: activeBar.id },
    select: {
      title: true,
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

  const bytes = document.content instanceof Uint8Array
    ? document.content
    : new Uint8Array(document.content);
  const previewKind = getDocumentPreviewKind(document.fileName, document.mimeType);

  try {
    if (previewKind === "word") {
      return htmlResponse(await renderWordPreview(document.title, bytes));
    }

    if (previewKind === "spreadsheet") {
      return htmlResponse(await renderSpreadsheetPreview(document.title, bytes));
    }

    return htmlResponse(renderUnsupportedPreview(document.title), 415);
  } catch (error) {
    console.error("[documents] preview failed", {
      documentId,
      previewKind,
      error: error instanceof Error ? error.message : String(error),
    });
    return htmlResponse(renderUnsupportedPreview(document.title), 422);
  }
}
