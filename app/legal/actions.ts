"use server";

import { Role } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getRequiredLegalDocumentsForUser } from "@/lib/legal-documents";
import { getPostLoginDestination } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function getClientIp(headerStore: Headers) {
  const forwardedFor = headerStore.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return headerStore.get("x-real-ip");
}

export async function acceptRequiredLegalDocumentsAction(formData: FormData) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== Role.OWNER) {
    redirect("/dashboard");
  }

  if (formData.get("accepted") !== "on") {
    redirect("/legal/accept?error=required");
  }

  const documents = await getRequiredLegalDocumentsForUser(session.user.id);

  if (documents.length === 0) {
    redirect("/dashboard");
  }

  const headerStore = await headers();
  const ipAddress = getClientIp(headerStore);
  const userAgent = headerStore.get("user-agent");

  await prisma.$transaction(
    documents.map((document) =>
      prisma.legalAcceptance.upsert({
        where: {
          documentId_userId_version: {
            documentId: document.id,
            userId: session.user.id,
            version: document.version,
          },
        },
        create: {
          documentId: document.id,
          userId: session.user.id,
          barId: session.activeBarId,
          version: document.version,
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

  const destination = await getPostLoginDestination({
    userId: session.user.id,
    role: session.user.role,
    mustChangePwd: false,
    activeBarId: session.activeBarId,
  });

  redirect(destination === "/legal/accept" ? "/dashboard" : destination);
}
