import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { legalLinkIsValid } from "@/lib/legal-link";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await getSession();
  const { documentId } = await params;
  const url = new URL(request.url);
  // From the installed app: the phone's browser has no session, the signed address stands in for it.
  const signed = legalLinkIsValid(documentId, url.searchParams.get("e"), url.searchParams.get("s"));

  if (!session && !signed) {
    return NextResponse.json({ ok: false, error: "Sessione scaduta. Accedi di nuovo." }, { status: 401 });
  }

  if (!documentId) {
    return NextResponse.json({ ok: false, error: "Documento non indicato." }, { status: 400 });
  }

  const document = await prisma.legalDocument.findUnique({
    where: { id: documentId },
    select: {
      title: true,
      fileName: true,
      fileMimeType: true,
      fileContent: true,
      isActive: true,
    },
  });

  if (!document?.fileContent) {
    return NextResponse.json({ ok: false, error: "Documento non trovato." }, { status: 404 });
  }

  // Anyone signed in reads a published document: staff accept theirs too.
  if (String(session?.user.role) !== Role.SUPER_ADMIN && !document.isActive) {
    return NextResponse.json({ ok: false, error: "Non hai i permessi per farlo." }, { status: 403 });
  }

  const bytes =
    document.fileContent instanceof Uint8Array
      ? document.fileContent
      : new Uint8Array(document.fileContent);
  const safeFileName = (document.fileName || `${document.title}.pdf`).replaceAll('"', "'");
  const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";

  return new Response(bytes, {
    headers: {
      "Content-Type": document.fileMimeType || "application/pdf",
      "Content-Disposition": `${disposition}; filename="${safeFileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
