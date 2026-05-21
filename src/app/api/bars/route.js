import { NextResponse } from "next/server";
import { getCurrentSessionFromRequest } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req) {
  try {
    const auth = await getCurrentSessionFromRequest(req);

    if (!auth) {
      return NextResponse.json({ message: "Non autenticato" }, { status: 401 });
    }

    const bars =
      auth.user.role === "OWNER"
        ? await prisma.bar.findMany({
            where: { ownerId: auth.user.id },
            orderBy: { createdAt: "desc" },
          })
        : await prisma.bar.findMany({
            where: {
              memberships: {
                some: {
                  userId: auth.user.id,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          });

    return NextResponse.json(bars);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("BARS_GET_ERROR", error);
    }
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

    const body = await req.json();
    const { name, latitude, longitude } = body ?? {};

    if (name == null || latitude == null || longitude == null) {
      return NextResponse.json(
        { message: "name, latitude e longitude sono obbligatori" },
        { status: 400 }
      );
    }

    const bar = await prisma.bar.create({
      data: {
        name,
        latitude,
        longitude,
        ownerId: auth.user.id,
        radiusMeters: 10,
        roundingEnabled: false,
        entryToleranceMin: 5,
        roundingStepMin: 15,
        exitToleranceMin: 13,
      },
    });

    return NextResponse.json(bar, { status: 201 });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("BARS_POST_ERROR", error);
    }
    return NextResponse.json({ message: "Errore server" }, { status: 500 });
  }
}
