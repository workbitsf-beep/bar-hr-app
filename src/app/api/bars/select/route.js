import { NextResponse } from "next/server";
import { getCurrentSessionFromRequest } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req) {
  try {
    const auth = await getCurrentSessionFromRequest(req);
    const user = auth?.user;

    if (!auth) {
      return NextResponse.json({ message: "Non autenticato" }, { status: 401 });
    }

    const body = await req.json();
    const { barId } = body ?? {};

    if (!barId) {
      return NextResponse.json({ message: "barId obbligatorio" }, { status: 400 });
    }

    const bar =
      user.role === "OWNER"
        ? await prisma.bar.findFirst({
            where: {
              id: barId,
              ownerId: user.id,
            },
            select: { id: true },
          })
        : await prisma.bar.findFirst({
            where: {
              id: barId,
              memberships: {
                some: {
                  userId: user.id,
                },
              },
            },
            select: { id: true },
          });

    if (!bar) {
      return NextResponse.json({ message: "Bar non trovato" }, { status: 404 });
    }

    await prisma.session.update({
      where: { id: auth.session.id },
      data: { activeBarId: barId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("BAR_SELECT_ERROR", error);
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json(
        {
          ok: false,
          message: "Errore server",
          details: error?.message || String(error),
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { ok: false, message: "Errore server" },
      { status: 500 }
    );
  }
}
