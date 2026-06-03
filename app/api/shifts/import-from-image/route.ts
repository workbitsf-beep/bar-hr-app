import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageOperations, getActiveBarAccess } from "@/lib/permissions";
import { matchShiftPhotoMember, type ShiftPhotoMember } from "@/lib/shift-photo-parser";
import { parseShiftImageWithOpenAI, type ShiftImageExtraction } from "@/lib/ai/shift-image-parser";
import { withBar } from "@/lib/withBar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionWithBar = {
  activeBarId: string;
  user: {
    id: string;
    role: Role;
  };
};

type ImportAnalysisResponse = {
  ok: true;
  shifts: Array<
    ShiftImageExtraction & {
      employeeId: string | null;
      matchStatus: "matched" | "unmatched";
    }
  >;
};

function validateImageFile(file: File) {
  const allowedTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

  if (!allowedTypes.has(file.type)) {
    throw new Error("Formato immagine non supportato. Usa PNG, JPG, WEBP o GIF.");
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error("L'immagine supera il limite di 8MB.");
  }
}

function buildStaffMemberList(input: {
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    role: Role;
  };
  memberships: Array<{
    user: {
      id: string;
      firstName: string;
      lastName: string;
    };
    role: Role;
  }>;
}): ShiftPhotoMember[] {
  const members = new Map<string, ShiftPhotoMember>();

  members.set(input.owner.id, {
    id: input.owner.id,
    firstName: input.owner.firstName,
    lastName: input.owner.lastName,
    role: input.owner.role,
  });

  for (const membership of input.memberships) {
    members.set(membership.user.id, {
      id: membership.user.id,
      firstName: membership.user.firstName,
      lastName: membership.user.lastName,
      role: membership.role,
    });
  }

  return Array.from(members.values());
}

export const POST = withBar(async (req: Request, session: SessionWithBar): Promise<Response> => {
  const access = await getActiveBarAccess(session as never);

  if (!canManageOperations(access.role)) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const image = formData.get("image");
    const rangeStart = String(formData.get("rangeStart") ?? "").trim() || null;
    const rangeEnd = String(formData.get("rangeEnd") ?? "").trim() || null;

    if (!(image instanceof File)) {
      return Response.json({ ok: false, message: "Carica una foto valida." }, { status: 400 });
    }

    validateImageFile(image);

    const bar = await prisma.bar.findUnique({
      where: { id: session.activeBarId },
      select: {
        name: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        memberships: {
          where: { isActive: true },
          select: {
            role: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!bar) {
      return Response.json({ ok: false, message: "Locale non trovato." }, { status: 404 });
    }

    const imageBase64 = Buffer.from(await image.arrayBuffer()).toString("base64");
    const members = buildStaffMemberList({
      owner: bar.owner,
      memberships: bar.memberships,
    });

    const parsedShifts = await parseShiftImageWithOpenAI({
      imageBase64,
      mimeType: image.type,
      barName: bar.name,
      rangeStart,
      rangeEnd,
      members,
    });

    const response: ImportAnalysisResponse = {
      ok: true,
      shifts: parsedShifts.map((shift) => {
        const matched = matchShiftPhotoMember(shift.employeeName, members);

        return {
          ...shift,
          employeeId: matched?.id ?? null,
          matchStatus: matched ? "matched" : "unmatched",
        };
      }),
    };

    return Response.json(response);
  } catch (error) {
    console.error("[shifts/import-from-image] failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return Response.json(
      {
        ok: false,
        message:
          error instanceof Error && error.message
            ? error.message
            : "Impossibile analizzare la foto.",
      },
      { status: 500 }
    );
  }
});
