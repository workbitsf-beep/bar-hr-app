import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

function getCookieValue(cookieHeader, name) {
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }
  return "";
}

export async function GET(req) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const token = getCookieValue(cookieHeader, "session");

    if (!token) {
      return NextResponse.json({ authenticated: false });
    }

    const session = await prisma.session.findFirst({
      where: {
        token,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            firstName: true,
            lastName: true,
            mustChangePwd: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({ authenticated: true, user: session.user });
  } catch (error) {
    console.error("SESSION_ERROR", error);
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json(
        {
          authenticated: false,
          message: "Errore server",
          details: error?.message || String(error),
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { authenticated: false, message: "Errore server" },
      { status: 500 }
    );
  }
}
