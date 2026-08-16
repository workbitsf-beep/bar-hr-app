import { NextResponse } from "next/server";
import {
  getLatestPublicLegalDocument,
  isPublicLegalDocumentType,
} from "@/lib/public-legal";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentType: string }> }
) {
  const { documentType } = await params;

  if (!isPublicLegalDocumentType(documentType)) {
    return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
  }

  const document = await getLatestPublicLegalDocument(documentType);

  if (!document?.fileContent) {
    return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
  }

  const bytes =
    document.fileContent instanceof Uint8Array
      ? document.fileContent
      : new Uint8Array(document.fileContent);
  const safeFileName = (document.fileName || `${document.title}.pdf`).replaceAll('"', "'");
  const disposition =
    new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";

  return new Response(bytes, {
    headers: {
      "Content-Type": document.fileMimeType || "application/pdf",
      "Content-Disposition": `${disposition}; filename="${safeFileName}"`,
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
