import { PrismaClient, TimeLogType } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentSessionFromRequest } from "@/app/lib/auth";

const prisma = new PrismaClient();

export async function GET(req) {
  try {
    const auth = await getCurrentSessionFromRequest(req);

    if (!auth) {
      return NextResponse.json({ message: "Non autenticato" }, { status: 401 });
    }

    const timeLogs = await prisma.timeLog.findMany({
      where: { employeeId: auth.user.id },
      orderBy: { timestamp: "desc" },
    });

    return NextResponse.json(timeLogs);
  } catch (error) {
    console.error("TIMELOGS_GET_ERROR", error);
    return NextResponse.json({ message: "Errore server" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const auth = await getCurrentSessionFromRequest(req);

    if (!auth) {
      return NextResponse.json({ message: "Non autenticato" }, { status: 401 });
    }

    const body = await req.json();
    const { type } = body ?? {};

    if (type !== TimeLogType.IN && type !== TimeLogType.OUT) {
      return NextResponse.json(
        { message: 'type deve essere "IN" oppure "OUT"' },
        { status: 400 }
      );
    }

    const barId = auth.session.activeBarId;

    if (!barId) {
      return NextResponse.json({ message: "Seleziona un bar" }, { status: 400 });
    }

    const now = new Date();

    const activeShift = await prisma.shift.findFirst({
      where: {
        employeeId: auth.user.id,
        barId,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      select: { id: true },
      orderBy: { startsAt: "asc" },
    });

    const timeLog = await prisma.timeLog.create({
      data: {
        barId,
        employeeId: auth.user.id,
        shiftId: activeShift?.id ?? null,
        type,
        timestamp: now,
      },
    });

    return NextResponse.json({ ok: true, timeLog });
  } catch (error) {
    console.error("TIMELOGS_POST_ERROR", error);
    return NextResponse.json({ message: "Errore server" }, { status: 500 });
  }
}
