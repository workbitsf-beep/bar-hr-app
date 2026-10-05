/**
 * Creates the venue Apple and Google reviewers log in to.
 *
 *   node scripts/create-review-demo.js --confirm
 *
 * Writes to DATABASE_URL, which is production when the app is to be reviewed:
 * the reviewers use the live app. Run once; it refuses if the demo is there.
 * Prints the two logins to paste into App Store Connect and Play Console.
 *
 * Two things a real venue would not have, both because a reviewer is not in
 * the venue:
 *  - the clock-in radius covers the whole planet. Reviewers sit in the United
 *    States; with a real radius every clock-in would be refused, and a refused
 *    clock-in reads as a broken app.
 *  - the demo employee has a shift covering the whole day, every day for the
 *    next three months, so clock-in works at whatever hour a review happens.
 *
 * Remove it after approval with --remove.
 */
process.env.TZ = process.env.TZ || "Europe/Rome";

try {
  require("dotenv").config({ quiet: true });
} catch {}

const crypto = require("node:crypto");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const OWNER_EMAIL = "revisione.titolare@workbit.it";
const EMPLOYEE_EMAIL = "revisione.dipendente@workbit.it";
const BAR_NAME = "Bar Aurora (demo)";
// Milan, Navigli. Any real place will do; the radius makes it irrelevant.
const LATITUDE = 45.4515;
const LONGITUDE = 9.1773;
const PLANET_RADIUS_METERS = 20_100_000;

const STAFF = [
  ["Giulia", "Rossi", "MANAGER"],
  ["Marco", "Bianchi", "EMPLOYEE"],
  ["Sara", "Colombo", "EMPLOYEE"],
  ["Luca", "Ricci", "EMPLOYEE"],
];

function at(day, hours, minutes = 0) {
  const date = new Date(day);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function addDays(day, days) {
  const date = new Date(day);
  date.setDate(date.getDate() + days);
  return date;
}

function password() {
  // Readable when pasted into a review form: no look-alike characters.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: 14 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
}

async function remove(prisma) {
  const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true } });

  if (owner) {
    await prisma.bar.deleteMany({ where: { ownerId: owner.id } });
  }

  const removed = await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { in: [OWNER_EMAIL, EMPLOYEE_EMAIL] } },
        { email: { endsWith: "@demo.workbit.invalid" } },
      ],
    },
  });

  console.log(`Demo rimossa (${removed.count} account).`);
}

async function create(prisma) {
  if (await prisma.user.findUnique({ where: { email: OWNER_EMAIL } })) {
    throw new Error("La demo esiste già. Per rifarla: --remove, poi --confirm.");
  }

  const ownerPassword = password();
  const employeePassword = password();
  const today = at(new Date(), 0);

  await prisma.$transaction(async (tx) => {
    const owner = await tx.user.create({
      data: {
        email: OWNER_EMAIL,
        passwordHash: await bcrypt.hash(ownerPassword, 10),
        firstName: "Elena",
        lastName: "Fontana",
        role: "OWNER",
        mustChangePwd: false,
      },
    });

    const bar = await tx.bar.create({
      data: {
        name: BAR_NAME,
        latitude: LATITUDE,
        longitude: LONGITUDE,
        ownerId: owner.id,
        activityType: "RESTAURANT",
        city: "Milano",
      },
    });

    await tx.barSettings.create({
      data: {
        barId: bar.id,
        gpsLatitude: LATITUDE,
        gpsLongitude: LONGITUDE,
        gpsRadius: PLANET_RADIUS_METERS,
        roundingEnabled: true,
        roundingMinutes: 15,
        roundingMode: "NEAREST",
      },
    });
    await tx.subscription.create({ data: { barId: bar.id, planType: "LIFETIME", status: "ACTIVE" } });
    await tx.employeeBar.create({ data: { userId: owner.id, barId: bar.id, role: "OWNER" } });

    const documents = await tx.legalDocument.findMany({
      where: { isActive: true, isRequired: true },
      select: { id: true, version: true, revision: true },
    });

    for (const document of documents) {
      await tx.legalAcceptance.create({
        data: { documentId: document.id, userId: owner.id, barId: bar.id, version: document.version, revision: document.revision },
      });
    }

    const reviewer = await tx.user.create({
      data: {
        email: EMPLOYEE_EMAIL,
        passwordHash: await bcrypt.hash(employeePassword, 10),
        firstName: "Davide",
        lastName: "Greco",
        role: "EMPLOYEE",
        mustChangePwd: false,
      },
    });
    await tx.employeeBar.create({ data: { userId: reviewer.id, barId: bar.id, role: "EMPLOYEE", hiredAt: addDays(today, -60) } });

    const colleagues = [];
    for (const [index, [firstName, lastName, role]] of STAFF.entries()) {
      const user = await tx.user.create({
        data: {
          email: `collega-${index}@demo.workbit.invalid`,
          passwordHash: `closed:${crypto.randomBytes(24).toString("hex")}`,
          firstName,
          lastName,
          role,
          mustChangePwd: false,
        },
      });
      await tx.employeeBar.create({ data: { userId: user.id, barId: bar.id, role, hiredAt: addDays(today, -90) } });
      colleagues.push(user);
    }

    // A month of history, so reports and the month's hours are not empty.
    for (let offset = -30; offset < 0; offset += 1) {
      const day = addDays(today, offset);
      const team = offset % 2 === 0 ? [reviewer, colleagues[1], colleagues[2]] : [colleagues[0], colleagues[3], reviewer];
      const startTime = at(day, 18);
      const endTime = at(day, 23, 30);
      const shift = await tx.shift.create({
        data: { barId: bar.id, startTime, endTime, assignedToId: team[0].id, createdById: owner.id, confirmedAt: startTime, title: "Cena" },
      });

      for (const person of team) {
        await tx.shiftAssignment.create({ data: { shiftId: shift.id, userId: person.id } });
        await tx.timeLog.createMany({
          data: [
            { userId: person.id, barId: bar.id, shiftId: shift.id, type: "IN", timestamp: at(day, 17, 55), latitude: LATITUDE, longitude: LONGITUDE },
            { userId: person.id, barId: bar.id, shiftId: shift.id, type: "OUT", timestamp: at(day, 23, 40), latitude: LATITUDE, longitude: LONGITUDE },
          ],
        });
      }
    }

    // The next three months: the reviewer's all-day shift, and the team's evenings.
    for (let offset = 0; offset < 90; offset += 1) {
      const day = addDays(today, offset);
      const allDay = await tx.shift.create({
        data: { barId: bar.id, startTime: at(day, 0, 5), endTime: at(day, 23, 55), assignedToId: reviewer.id, createdById: owner.id, title: "Turno demo" },
      });
      await tx.shiftAssignment.create({ data: { shiftId: allDay.id, userId: reviewer.id } });

      if (offset < 14) {
        const evening = await tx.shift.create({
          data: { barId: bar.id, startTime: at(day, 18), endTime: at(day, 23, 30), assignedToId: colleagues[0].id, createdById: owner.id, title: "Cena" },
        });
        for (const person of [colleagues[0], colleagues[1 + (offset % 3)]]) {
          await tx.shiftAssignment.create({ data: { shiftId: evening.id, userId: person.id } });
        }
      }
    }

    await tx.request.createMany({
      data: [
        { barId: bar.id, employeeId: colleagues[1].id, type: "VACATION", status: "PENDING", startsAt: at(addDays(today, 20), 0), endsAt: at(addDays(today, 22), 23, 59), reason: "Matrimonio di mia sorella" },
        { barId: bar.id, employeeId: reviewer.id, type: "PERMISSION", status: "APPROVED", ownerStatus: "APPROVED", startsAt: at(addDays(today, -10), 9), endsAt: at(addDays(today, -10), 12), reviewedById: owner.id, reviewedAt: addDays(today, -12) },
      ],
    });

    await tx.note.createMany({
      data: [
        { barId: bar.id, authorId: owner.id, content: "Venerdì arriva la fornitura del vino: qualcuno la controlli prima di firmare.", isPinned: true },
        { barId: bar.id, authorId: owner.id, content: "Da lunedì il caffè decaffeinato si prende dal macinino a destra." },
      ],
    });

    await tx.task.createMany({
      data: [
        { barId: bar.id, title: "Pulizia macchina del caffè", dueDate: at(today, 23), assignedToAll: true, createdById: owner.id, repeatEvery: 1, repeatUnit: "DAY" },
        { barId: bar.id, title: "Controllo scadenze frigo", dueDate: at(addDays(today, 1), 12), assignedToId: reviewer.id, createdById: owner.id },
      ],
    });

    await tx.course.create({
      data: { barId: bar.id, title: "Aggiornamento HACCP", kind: "HACCP", startsAt: at(addDays(today, 7), 9), endsAt: at(addDays(today, 7), 13), location: "Sala corsi, via Tortona 15", assignedToAll: true, createdById: owner.id, expiresAt: addDays(today, 7 + 3 * 365) },
    });
  }, { timeout: 120_000 });

  console.log("Demo creata. Da incollare nelle note per i revisori:\n");
  console.log(`Titolare   ${OWNER_EMAIL}   ${ownerPassword}`);
  console.log(`Dipendente ${EMPLOYEE_EMAIL}   ${employeePassword}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (!args.includes("--confirm") && !args.includes("--remove")) {
    console.log("Aggiungi --confirm per creare la demo, o --remove per toglierla.");
    return;
  }

  const prisma = new PrismaClient();

  try {
    if (args.includes("--remove")) {
      await remove(prisma);
    } else {
      await create(prisma);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
