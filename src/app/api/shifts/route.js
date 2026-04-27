import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentSessionFromRequest } from "@/app/lib/auth";

const prisma = new PrismaClient();

export async function GET(req) {
  try {
    const auth = await getCurrentSessionFromRequest(req);

    if (!auth) {
      return NextResponse.json({ message: "Non autenticato" }, { status: 401 });
    }

    if (!auth.session.activeBarId) {
      return NextResponse.json({ message: "Seleziona un bar" }, { status: 400 });
    }

    const shifts = await prisma.shift.findMany({
      where: { barId: auth.session.activeBarId },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { startsAt: "asc" },
    });

    return NextResponse.json(shifts);
  } catch (error) {
    console.error("SHIFTS_GET_ERROR", error);
    return NextResponse.json({ message: "Errore server" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const auth = await getCurrentSessionFromRequest(req);

    if (!auth) {
      return NextResponse.json({ message: "Non autenticato" }, { status: 401 });
    }

    if (auth.user.role !== "OWNER") {
      return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
    }

    if (!auth.session.activeBarId) {
      return NextResponse.json({ message: "Seleziona un bar" }, { status: 400 });
    }

    const body = await req.json();
    const { employeeId, startsAt, endsAt, roleLabel, notes } = body ?? {};

    if (!employeeId) {
      return NextResponse.json(
        { message: "employeeId obbligatorio" },
        { status: 400 }
      );
    }

    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime())
    ) {
      return NextResponse.json(
        { message: "startsAt e endsAt devono essere validi" },
        { status: 400 }
      );
    }

    if (endDate <= startDate) {
      return NextResponse.json(
        { message: "endsAt deve essere successivo a startsAt" },
        { status: 400 }
      );
    }

    const membership = await prisma.employeeBar.findFirst({
      where: {
        barId: auth.session.activeBarId,
        userId: employeeId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json(
        { message: "Dipendente non associato al bar" },
        { status: 400 }
      );
    }

    const shift = await prisma.shift.create({
      data: {
        barId: auth.session.activeBarId,
        employeeId,
        startsAt: startDate,
        endsAt: endDate,
        roleLabel: roleLabel ?? null,
        notes: notes ?? null,
      },
    });

    return NextResponse.json({ ok: true, shift });
  } catch (error) {
    console.error("SHIFTS_POST_ERROR", error);
    return NextResponse.json({ message: "Errore server" }, { status: 500 });
  }
}
