import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { getActiveBarAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const session = await getSession();

  if (!session) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const { activeBar, role } = await getActiveBarAccess(session);
  const { noteId } = await params;

  if (!activeBar?.id || !noteId) {
    return Response.json({ ok: false, message: "Not found" }, { status: 404 });
  }

  const note = await prisma.note.findFirst({
    where: {
      id: noteId,
      barId: activeBar.id,
      ...(role === Role.EMPLOYEE
        ? {
            OR: [{ employeeId: null }, { employeeId: session.user.id }],
          }
        : {}),
    },
    select: {
      id: true,
      readReceipts: {
        orderBy: {
          readAt: "desc",
        },
        select: {
          readAt: true,
          userId: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  if (!note) {
    return Response.json({ ok: false, message: "Not found" }, { status: 404 });
  }

  return Response.json({
    ok: true,
    confirmations: note.readReceipts.map((receipt) => ({
      userId: receipt.userId,
      userName: `${receipt.user.firstName} ${receipt.user.lastName}`.trim(),
      readAt: receipt.readAt.toISOString(),
    })),
  });
}
