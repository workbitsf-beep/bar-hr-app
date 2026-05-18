import process from "node:process";
import bcrypt from "bcrypt";
import { PrismaClient, Role } from "@prisma/client";

if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env");
}

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email: "admin@workbit.it",
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    console.log("Super admin gi\u00E0 esistente");
    return;
  }

  const passwordHash = await bcrypt.hash("Workbit123!", 10);

  await prisma.user.create({
    data: {
      email: "admin@workbit.it",
      firstName: "Super",
      lastName: "Admin",
      role: Role.SUPER_ADMIN,
      mustChangePwd: true,
      passwordHash,
    },
  });

  console.log("Super admin creato");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
