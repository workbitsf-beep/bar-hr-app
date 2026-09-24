import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  DOCUMENT_ACCESS_PARAM,
  createDocumentAccessToken,
  pruneExpiredDocumentAccessTokens,
} from "@/lib/document-access";
import { canViewDocument } from "@/lib/documents";
import { getActiveBarAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Hands back an address the phone's browser can open on its own.
 *
 * Asked for only when someone actually taps, so a page listing many documents
 * does not mint permissions nobody uses.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ ok: false, message: "Sessione assente." }, { status: 401 });
  }

  const { activeBar, role } = await getActiveBarAccess(session);
  const { documentId } = await params;

  if (!activeBar?.id || !documentId) {
    return NextResponse.json(
      { ok: false, message: "Nessun locale attivo su questo account." },
      { status: 409 }
    );
  }

  const document = await prisma.document.findFirst({
    where: { id: documentId, barId: activeBar.id },
    select: { id: true, assignedToAll: true, assignedToId: true, isActive: true },
  });

  if (!document || !canViewDocument(document, session.user.id, role)) {
    return NextResponse.json(
      { ok: false, message: "Documento non disponibile." },
      { status: 404 }
    );
  }

  await pruneExpiredDocumentAccessTokens();

  const token = await createDocumentAccessToken(document.id, session.user.id);

  return NextResponse.json({
    ok: true,
    url: `/api/documents/${document.id}?${DOCUMENT_ACCESS_PARAM}=${token}`,
  });
}
