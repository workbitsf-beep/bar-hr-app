const {
  PrismaClient,
  Role,
  TaskStatus,
  ClockType,
} = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function upsertUser(data) {
  const passwordHash = await bcrypt.hash(data.password, 10);

  return prisma.user.upsert({
    where: { email: data.email },
    update: {
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      language: data.language,
      mustChangePwd: data.mustChangePwd,
      passwordHash,
    },
    create: {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      language: data.language,
      mustChangePwd: data.mustChangePwd,
      passwordHash,
    },
  });
}

async function ensureSuperAdmin(data) {
  const passwordHash = await bcrypt.hash(data.password, 10);
  const existingByEmail = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingByEmail) {
    return prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        role: "SUPER_ADMIN",
        language: data.language,
        mustChangePwd: data.mustChangePwd,
        passwordHash,
      },
    });
  }

  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
  });

  if (existingSuperAdmin) {
    return prisma.user.update({
      where: { id: existingSuperAdmin.id },
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: "SUPER_ADMIN",
        language: data.language,
        mustChangePwd: data.mustChangePwd,
        passwordHash,
      },
    });
  }

  return prisma.user.create({
    data: {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: "SUPER_ADMIN",
      language: data.language,
      mustChangePwd: data.mustChangePwd,
      passwordHash,
    },
  });
}

async function main() {
  await ensureSuperAdmin({
    email: "workbitsf@gmail.it",
    password: "12345",
    firstName: "Super",
    lastName: "Admin",
    language: "it",
    mustChangePwd: true,
  });

  const owner = await upsertUser({
    email: "owner@workbit.com",
    password: "Workbit123!",
    firstName: "Mario",
    lastName: "Rossi",
    role: Role.OWNER,
    language: "it",
    mustChangePwd: false,
  });

  const manager = await upsertUser({
    email: "manager@workbit.com",
    password: "Workbit123!",
    firstName: "Giulia",
    lastName: "Bianchi",
    role: Role.MANAGER,
    language: "en",
    mustChangePwd: false,
  });

  const employee = await upsertUser({
    email: "employee@workbit.com",
    password: "Workbit123!",
    firstName: "Luca",
    lastName: "Verdi",
    role: Role.EMPLOYEE,
    language: "it",
    mustChangePwd: false,
  });

  const bar = await prisma.bar.upsert({
    where: { id: "3b44df9f-c3e0-43f8-ae44-0dc9e73cb4c2" },
    update: {
      name: "Workbit Bistro",
      legalName: "Workbit Bistro SRL",
      email: "bistro@workbit.com",
      phone: "+39 02 1234567",
      addressLine1: "Via Torino 10",
      city: "Milano",
      postalCode: "20123",
      vatNumber: "IT12345678901",
      latitude: 45.4642,
      longitude: 9.19,
      radiusMeters: 80,
      roundingEnabled: true,
      roundingStepMin: 15,
      ownerId: owner.id,
    },
    create: {
      id: "3b44df9f-c3e0-43f8-ae44-0dc9e73cb4c2",
      name: "Workbit Bistro",
      legalName: "Workbit Bistro SRL",
      email: "bistro@workbit.com",
      phone: "+39 02 1234567",
      addressLine1: "Via Torino 10",
      city: "Milano",
      postalCode: "20123",
      vatNumber: "IT12345678901",
      latitude: 45.4642,
      longitude: 9.19,
      radiusMeters: 80,
      roundingEnabled: true,
      roundingStepMin: 15,
      entryToleranceMin: 5,
      exitToleranceMin: 13,
      ownerId: owner.id,
    },
  });

  await prisma.subscription.upsert({
    where: { barId: bar.id },
    update: {
      planType: "PAID",
      billingInterval: "MONTHLY",
      status: "ACTIVE",
      currentPeriodEnd: new Date("2026-12-31T00:00:00.000Z"),
      trialEndsAt: null,
    },
    create: {
      barId: bar.id,
      planType: "PAID",
      billingInterval: "MONTHLY",
      status: "ACTIVE",
      currentPeriodEnd: new Date("2026-12-31T00:00:00.000Z"),
      trialEndsAt: null,
    },
  });

  await prisma.barSettings.upsert({
    where: { barId: bar.id },
    update: {
      gpsLatitude: 45.4642,
      gpsLongitude: 9.19,
      gpsRadius: 80,
      roundingEnabled: true,
      roundingMinutes: 15,
      roundingMode: "NEAREST",
    },
    create: {
      barId: bar.id,
      gpsLatitude: 45.4642,
      gpsLongitude: 9.19,
      gpsRadius: 80,
      roundingEnabled: true,
      roundingMinutes: 15,
      roundingMode: "NEAREST",
    },
  });

  const memberships = [
    { userId: owner.id, role: Role.OWNER },
    { userId: manager.id, role: Role.MANAGER },
    { userId: employee.id, role: Role.EMPLOYEE },
  ];

  for (const membership of memberships) {
    await prisma.employeeBar.upsert({
      where: {
        userId_barId: {
          userId: membership.userId,
          barId: bar.id,
        },
      },
      update: {
        role: membership.role,
        isActive: true,
        endedAt: null,
      },
      create: {
        userId: membership.userId,
        barId: bar.id,
        role: membership.role,
        isActive: true,
      },
    });
  }

  const shift = await prisma.shift.upsert({
    where: { id: "4140b521-44b0-4c2d-bde2-624d7775654c" },
    update: {
      title: "Servizio serale",
      startTime: new Date("2026-05-12T16:00:00.000Z"),
      endTime: new Date("2026-05-12T22:00:00.000Z"),
      assignedToId: manager.id,
      createdById: owner.id,
    },
    create: {
      id: "4140b521-44b0-4c2d-bde2-624d7775654c",
      title: "Servizio serale",
      startTime: new Date("2026-05-12T16:00:00.000Z"),
      endTime: new Date("2026-05-12T22:00:00.000Z"),
      barId: bar.id,
      assignedToId: manager.id,
      createdById: owner.id,
    },
  });

  const shiftAssignments = [manager.id, employee.id];

  await prisma.shiftAssignment.deleteMany({
    where: { shiftId: shift.id },
  });

  await prisma.shiftAssignment.createMany({
    data: shiftAssignments.map((userId) => ({
      shiftId: shift.id,
      userId,
    })),
    skipDuplicates: true,
  });

  const existingTask = await prisma.task.findFirst({
    where: {
      barId: bar.id,
      title: "Checklist apertura",
    },
  });

  if (!existingTask) {
    await prisma.task.create({
      data: {
        title: "Checklist apertura",
        description: "Controlla cassa, frigo e mise en place.",
        status: TaskStatus.TODO,
        dueDate: new Date("2026-05-12T10:00:00.000Z"),
        assignedToAll: true,
        barId: bar.id,
        createdById: owner.id,
      },
    });
  }

  const note = await prisma.note.findFirst({
    where: {
      barId: bar.id,
      content: "Benvenuti nella nuova dashboard del locale.",
    },
  });

  if (!note) {
    await prisma.note.create({
      data: {
        barId: bar.id,
        authorId: owner.id,
        content: "Benvenuti nella nuova dashboard del locale.",
        isPinned: true,
      },
    });
  }

  const hasLogs = await prisma.timeLog.findFirst({
    where: {
      barId: bar.id,
      userId: employee.id,
    },
  });

  if (!hasLogs) {
    await prisma.timeLog.createMany({
      data: [
        {
          barId: bar.id,
          userId: employee.id,
          shiftId: shift.id,
          type: ClockType.IN,
          timestamp: new Date("2026-05-11T15:57:00.000Z"),
          latitude: 45.4642,
          longitude: 9.19,
        },
        {
          barId: bar.id,
          userId: employee.id,
          shiftId: shift.id,
          type: ClockType.OUT,
          timestamp: new Date("2026-05-11T22:08:00.000Z"),
          latitude: 45.4642,
          longitude: 9.19,
        },
      ],
    });
  }

  console.log("Seed completato");
}

main()
  .catch((error) => {
    console.error("Errore durante il seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
