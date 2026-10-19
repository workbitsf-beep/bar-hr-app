import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { legalDocumentLink } from "@/lib/legal-link";
import { prisma } from "@/lib/prisma";

/** A short-lived address for a published legal PDF, for the installed app (lib/legal-link.ts). */
export async function POST(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: "Sessione scaduta. Accedi di nuovo." }, { status: 401 });
  }
  const { documentId } = await params;
  const document = await prisma.legalDocument.findUnique({
    where: { id: documentId },
    select: { isActive: true, fileName: true },
  });
  if (!document?.fileName || !document.isActive) {
    return NextResponse.json({ ok: false, message: "Documento non disponibile." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, url: legalDocumentLink(documentId) });
}
