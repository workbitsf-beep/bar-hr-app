import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getRequiredLegalDocumentsForUser } from "@/lib/legal-documents";
import { getPostLoginDestination } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function getClientIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return headers.get("x-real-ip");
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ ok: false, message: "Sessione scaduta" }, { status: 401 });
  }

  if (session.user.role !== Role.OWNER) {
    return NextResponse.json({ ok: false, message: "Azione non disponibile" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { accepted?: boolean } | null;

  if (body?.accepted !== true) {
    return NextResponse.json({ ok: false, message: "Conferma richiesta" }, { status: 400 });
  }

  const documents = await getRequiredLegalDocumentsForUser(session.user.id);

  if (documents.length > 0) {
    const ipAddress = getClientIp(request.headers);
    const userAgent = request.headers.get("user-agent");

    await prisma.$transaction(
      documents.map((document) =>
        prisma.legalAcceptance.upsert({
          where: {
            documentId_userId_version_revision: {
              documentId: document.id,
              userId: session.user.id,
              version: document.version,
              revision: document.revision,
            },
          },
          create: {
            documentId: document.id,
            userId: session.user.id,
            barId: session.activeBarId,
            version: document.version,
            revision: document.revision,
            ipAddress,
            userAgent,
          },
          update: {
            acceptedAt: new Date(),
            barId: session.activeBarId,
            ipAddress,
            userAgent,
          },
        })
      )
    );
  }

  const destination = await getPostLoginDestination({
    userId: session.user.id,
    role: session.user.role,
    mustChangePwd: false,
    activeBarId: session.activeBarId,
  });

  return NextResponse.json({
    ok: true,
    redirectTo: destination === "/legal/accept" ? "/dashboard" : destination,
  });
}
