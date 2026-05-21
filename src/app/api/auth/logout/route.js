import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const token = cookies().get("session")?.value;

    if (token) {
      await prisma.session.updateMany({
        where: {
          token,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set("session", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    return res;
  } catch (error) {
    console.error("LOGOUT_ERROR", error);
    return NextResponse.json(
      { ok: false, message: "Errore server" },
      { status: 500 }
    );
  }
}
