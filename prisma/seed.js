const { PrismaClient, Role } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  const email = "owner@workbit.com";

  const existingOwner = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (existingOwner) {
    console.log(`Owner gia' presente: ${existingOwner.email} (${existingOwner.id})`);
    return;
  }

  const passwordHash = await bcrypt.hash("Workbit123!", 10);

  const owner = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: "Mario",
      lastName: "Rossi",
      role: Role.OWNER,
      mustChangePwd: false,
    },
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      mustChangePwd: true,
    },
  });

  console.log("Owner creato con successo:", owner);
}

main()
  .catch((error) => {
    console.error("Errore durante il seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
