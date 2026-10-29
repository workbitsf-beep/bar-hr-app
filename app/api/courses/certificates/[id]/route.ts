import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { canManageTraining, getActiveBarAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A certificate's file, for whoever runs the courses and for the person it belongs to. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Accedi di nuovo.", { status: 401 });
  const { activeBar, role } = await getActiveBarAccess(session);
  if (!activeBar?.id) return new Response("Scegli prima il locale.", { status: 409 });

  const { id } = await params;
  const certificate = await prisma.courseCertificate.findFirst({
    where: { id, barId: activeBar.id },
    select: { userId: true, fileName: true, mimeType: true, content: true },
  });
  if (!certificate?.content || (!canManageTraining(role as Role) && certificate.userId !== session.user.id)) {
    return new Response("Attestato non trovato.", { status: 404 });
  }

  const bytes = certificate.content instanceof Uint8Array ? certificate.content : new Uint8Array(certificate.content);
  const name = (certificate.fileName ?? "attestato").replaceAll('"', "'");
  const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";
  return new Response(bytes, {
    headers: {
      "Content-Type": certificate.mimeType ?? "application/octet-stream",
      "Content-Disposition": `${disposition}; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
