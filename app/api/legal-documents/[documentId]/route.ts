import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;

  if (!documentId) {
    return NextResponse.json({ ok: false, error: "Missing document id" }, { status: 400 });
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
    return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
  }

  if (session.user.role !== Role.SUPER_ADMIN && (session.user.role !== Role.OWNER || !document.isActive)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const bytes =
    document.fileContent instanceof Uint8Array
      ? document.fileContent
      : new Uint8Array(document.fileContent);
  const safeFileName = (document.fileName || `${document.title}.pdf`).replaceAll('"', "'");

  return new Response(bytes, {
    headers: {
      "Content-Type": document.fileMimeType || "application/pdf",
      "Content-Disposition": `inline; filename="${safeFileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
