import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function createSession(userId) {
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return token;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email e password obbligatorie" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        mustChangePwd: true,
        passwordHash: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Credenziali non valide" },
        { status: 401 }
      );
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return NextResponse.json(
        { success: false, message: "Credenziali non valide" },
        { status: 401 }
      );
    }

    const { passwordHash, ...safeUser } = user;
    const token = await createSession(user.id);
    const responseBody = user.mustChangePwd
      ? {
          success: true,
          mustChangePassword: true,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
          },
        }
      : { success: true, user: safeUser };
    const res = NextResponse.json(responseBody);

    res.cookies.set("session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (error) {
    console.error("LOGIN_ERROR", error);
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json(
        {
          success: false,
          message: "Errore server",
          details: error?.message || String(error),
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Errore server" },
      { status: 500 }
    );
  }
}
