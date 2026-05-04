const { PrismaClient, Role } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  const usersToSeed = [
    {
      email: "owner@workbit.com",
      password: "Workbit123!",
      firstName: "Mario",
      lastName: "Rossi",
      role: Role.OWNER,
      mustChangePwd: false,
      label: "Owner",
    },
    {
      email: "admin@test.com",
      password: "password123",
      firstName: "Admin",
      lastName: "Test",
      role: Role.OWNER,
      mustChangePwd: false,
      label: "Dev admin",
    },
  ];

  for (const userData of usersToSeed) {
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email },
      select: { id: true, email: true },
    });

    if (existingUser) {
      console.log(
        `${userData.label} gia' presente: ${existingUser.email} (${existingUser.id})`
      );
      continue;
    }

    const passwordHash = await bcrypt.hash(userData.password, 10);

    const user = await prisma.user.create({
      data: {
        email: userData.email,
        passwordHash,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        mustChangePwd: userData.mustChangePwd,
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

    console.log(`${userData.label} creato con successo:`, user);
  }
}

main()
  .catch((error) => {
    console.error("Errore durante il seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
