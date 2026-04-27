import { Prisma, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentSessionFromRequest } from "@/app/lib/auth";

const prisma = new PrismaClient();

function generateTempPassword() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const all = letters + digits;
  const length = crypto.randomInt(10, 13);

  const chars = [
    letters[crypto.randomInt(0, letters.length)],
    digits[crypto.randomInt(0, digits.length)],
  ];

  while (chars.length < length) {
    chars.push(all[crypto.randomInt(0, all.length)]);
  }

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }

  return chars.join("");
}

export async function GET(req) {
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

    const employees = await prisma.employeeBar.findMany({
      where: { barId: auth.session.activeBarId },
      select: {
        id: true,
        userId: true,
        barId: true,
        hourlyRate: true,
        isActive: true,
        hiredAt: true,
        endedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            mustChangePwd: true,
          },
        },
      },
      orderBy: { hiredAt: "desc" },
    });

    return NextResponse.json(employees);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("EMPLOYEES_GET_ERROR", error);
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

    if (!auth.session.activeBarId) {
      return NextResponse.json({ message: "Seleziona un bar" }, { status: 400 });
    }

    const body = await req.json();
    const email = body?.email?.trim();
    const firstName = body?.firstName?.trim();
    const lastName = body?.lastName?.trim();

    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        { message: "email, firstName e lastName sono obbligatori" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "Email gia' esistente" },
        { status: 409 }
      );
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const employee = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          firstName,
          lastName,
          role: Role.EMPLOYEE,
          mustChangePwd: true,
          passwordHash,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });

      await tx.employeeBar.create({
        data: {
          userId: createdUser.id,
          barId: auth.session.activeBarId,
          isActive: true,
          hiredAt: new Date(),
        },
      });

      return createdUser;
    });

    return NextResponse.json(
      {
        ok: true,
        employee,
        tempPassword,
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Email gia' esistente" },
        { status: 409 }
      );
    }

    if (process.env.NODE_ENV !== "production") {
      console.error("EMPLOYEES_POST_ERROR", error);
    }

    return NextResponse.json({ message: "Errore server" }, { status: 500 });
  }
}
