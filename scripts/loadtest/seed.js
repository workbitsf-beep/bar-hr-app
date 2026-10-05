/**
 * Fills a TEST database with fake bars, so the app can be pushed to its limit
 * without touching a single real venue.
 *
 *   LOADTEST_DATABASE_URL=postgres://... node scripts/loadtest/seed.js --bars 100
 *   LOADTEST_DATABASE_URL=postgres://... node scripts/loadtest/seed.js --cleanup
 *
 * It reads its own variable, never DATABASE_URL, and refuses to run when the
 * two are the same: the .env on this machine points at production, and one
 * mistyped command would have filled it with a hundred invented bars.
 *
 * Everything it creates has an email under @loadtest.workbit.invalid, so
 * --cleanup removes exactly that and nothing else.
 *
 * Writes scripts/loadtest/sessions.json: one ready session per person, which
 * the k6 script uses to act as them without going through the login.
 */
// The dates below are local wall-clock times, and the server runs on
// Europe/Rome: set before the first Date is made.
process.env.TZ = process.env.TZ || "Europe/Rome";

// Only to read DATABASE_URL from .env and refuse it. dotenv arrives through
// Prisma; without it, the comparison simply has nothing to compare against.
try {
  require("dotenv").config({ quiet: true });
} catch {}

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const DOMAIN = "loadtest.workbit.invalid";
const PASSWORD = "Loadtest2026!";
const OUT_FILE = path.join(__dirname, "sessions.json");

function readArgs() {
  const args = process.argv.slice(2);
  const value = (name, fallback) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? Number(args[index + 1]) : fallback;
  };

  return {
    cleanup: args.includes("--cleanup"),
    bars: value("bars", 100),
    staff: value("staff", 12),
    months: value("months", 3),
    // Adds bars after the ones already there instead of starting over.
    append: args.includes("--append"),
  };
}

function connect() {
  const url = process.env.LOADTEST_DATABASE_URL?.trim();

  if (!url) {
    throw new Error("Manca LOADTEST_DATABASE_URL: l'indirizzo del database di PROVA.");
  }

  if (process.env.DATABASE_URL && url === process.env.DATABASE_URL.trim()) {
    throw new Error(
      "LOADTEST_DATABASE_URL è uguale a DATABASE_URL. Mi fermo: non riempio il database di produzione."
    );
  }

  return new PrismaClient({ datasourceUrl: url });
}

const FIRST = ["Luca", "Giulia", "Marco", "Sara", "Davide", "Elena", "Matteo", "Chiara", "Andrea", "Marta", "Paolo", "Anna", "Simone", "Laura", "Fabio"];
const LAST = ["Rossi", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Conti", "Costa", "Fontana"];

const pick = (list, n) => list[n % list.length];
const id = () => crypto.randomUUID();
const token = () => `lt_${crypto.randomBytes(24).toString("hex")}`;

// Local wall-clock time on a given day. The server runs on Europe/Rome and
// so does this script when run from Italy; TZ is pinned to be sure.
function at(day, hours, minutes = 0) {
  const date = new Date(day);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function jitter(date, maxMinutes) {
  const delta = Math.round((Math.random() * 2 - 1) * maxMinutes);
  return new Date(date.getTime() + delta * 60_000);
}

async function insert(prisma, model, rows, batch = 5000) {
  for (let index = 0; index < rows.length; index += batch) {
    await prisma[model].createMany({ data: rows.slice(index, index + batch) });
  }
}

async function cleanup(prisma) {
  const owners = await prisma.user.findMany({
    where: { email: { endsWith: `@${DOMAIN}` }, role: "OWNER" },
    select: { id: true },
  });
  const bars = await prisma.bar.deleteMany({ where: { ownerId: { in: owners.map((owner) => owner.id) } } });
  const users = await prisma.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });

  if (fs.existsSync(OUT_FILE)) {
    fs.unlinkSync(OUT_FILE);
  }

  console.log(`Rimossi ${bars.count} bar e ${users.count} persone di prova.`);
}

async function seed(prisma, { bars, staff, months, append }) {
  const existing = await prisma.user.count({ where: { email: { endsWith: `@${DOMAIN}` }, role: "OWNER" } });

  if (existing > 0 && !append) {
    throw new Error("Ci sono già dati di prova. Prima lancia con --cleanup, o aggiungi --append.");
  }

  const first = append ? existing : 0;

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const legalDocuments = await prisma.legalDocument.findMany({
    where: { isActive: true, isRequired: true },
    select: { id: true, version: true, revision: true },
  });

  const today = at(new Date(), 0);
  const firstDay = new Date(today);
  firstDay.setMonth(firstDay.getMonth() - months);
  const lastDay = new Date(today);
  lastDay.setDate(lastDay.getDate() + 14);

  const sessions = append && fs.existsSync(OUT_FILE) ? JSON.parse(fs.readFileSync(OUT_FILE, "utf8")) : [];
  const sessionExpiry = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  let totals = { shifts: 0, timeLogs: 0 };

  for (let b = first; b < first + bars; b += 1) {
    const rows = {
      user: [], bar: [], barSettings: [], subscription: [], employeeBar: [], shift: [],
      shiftAssignment: [], timeLog: [], request: [], note: [], task: [], notification: [],
      course: [], session: [], legalAcceptance: [],
    };
    const barId = id();
    // Spread over northern Italy, so no two bars share a position.
    const latitude = 45.0 + (b % 20) * 0.05;
    const longitude = 9.0 + Math.floor(b / 20) * 0.05;

    const ownerId = id();
    rows.user.push({
      id: ownerId, email: `titolare-${b}@${DOMAIN}`, passwordHash, firstName: "Titolare",
      lastName: `Bar ${b}`, role: "OWNER", mustChangePwd: false,
    });
    rows.bar.push({ id: barId, name: `Bar Prova ${String(b).padStart(3, "0")}`, latitude, longitude, ownerId, activityType: "RESTAURANT" });
    rows.barSettings.push({
      barId, gpsLatitude: latitude, gpsLongitude: longitude, gpsRadius: 150,
      roundingEnabled: true, roundingMinutes: 15, roundingMode: "NEAREST",
    });
    rows.subscription.push({ barId, planType: "LIFETIME", status: "ACTIVE" });
    rows.employeeBar.push({ userId: ownerId, barId, role: "OWNER" });

    for (const document of legalDocuments) {
      rows.legalAcceptance.push({ documentId: document.id, userId: ownerId, barId, version: document.version, revision: document.revision });
    }

    const staffIds = [];
    for (let s = 0; s < staff; s += 1) {
      const userId = id();
      const role = s === 0 ? "MANAGER" : "EMPLOYEE";
      staffIds.push(userId);
      rows.user.push({
        id: userId, email: `persona-${b}-${s}@${DOMAIN}`, passwordHash,
        firstName: pick(FIRST, b + s), lastName: pick(LAST, b * 3 + s), role, mustChangePwd: false,
      });
      rows.employeeBar.push({ userId, barId, role, hiredAt: firstDay });
      const sessionToken = token();
      rows.session.push({ token: sessionToken, userId, activeBarId: barId, expiresAt: sessionExpiry });
      sessions.push({ token: sessionToken, role, bar: b, barId, latitude, longitude });
    }

    const ownerToken = token();
    rows.session.push({ token: ownerToken, userId: ownerId, activeBarId: barId, expiresAt: sessionExpiry });
    sessions.push({ token: ownerToken, role: "OWNER", bar: b, barId, latitude, longitude });

    // Two services a day, lunch and dinner, the team split between them and
    // rotating, so everyone has five or six days on. From today onward everyone
    // is on every day: the test needs whoever it picks to have a shift to
    // clock into.
    for (let day = new Date(firstDay); day <= lastDay; day.setDate(day.getDate() + 1)) {
      const dayIndex = Math.round((day - firstDay) / 86_400_000);
      const isPast = day < today;
      const services = [
        { from: [11, 30], to: [15, 30] },
        { from: [18, 0], to: [23, 30] },
      ];

      services.forEach((service, serviceIndex) => {
        const shiftId = id();
        const startTime = at(day, ...service.from);
        const endTime = at(day, ...service.to);
        const members = staffIds.filter((_, index) =>
          isPast ? (index + dayIndex + serviceIndex) % 2 === 0 && (index + dayIndex) % 7 !== 0 : (index + serviceIndex) % 2 === 0
        );

        if (members.length === 0) {
          return;
        }

        rows.shift.push({ id: shiftId, barId, startTime, endTime, assignedToId: members[0], createdById: ownerId, confirmedAt: isPast ? startTime : null });

        for (const userId of members) {
          rows.shiftAssignment.push({ shiftId, userId });

          if (isPast) {
            const clockIn = jitter(startTime, 8);
            const clockOut = jitter(endTime, 15);
            rows.timeLog.push({ userId, barId, shiftId, type: "IN", timestamp: clockIn, latitude, longitude });
            rows.timeLog.push({ userId, barId, shiftId, type: "OUT", timestamp: clockOut, latitude, longitude });
          }
        }
      });
    }

    // A month's worth of the rest: requests, notes, tasks, notifications.
    staffIds.forEach((userId, index) => {
      for (let m = 0; m < months; m += 1) {
        const startsAt = at(new Date(today.getFullYear(), today.getMonth() - m, 5 + (index % 20)), 0);
        const endsAt = at(new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate() + 1), 23, 59);
        rows.request.push({ barId, employeeId: userId, type: "VACATION", status: "APPROVED", ownerStatus: "APPROVED", startsAt, endsAt, reviewedById: ownerId, reviewedAt: startsAt });
      }
      rows.request.push({ barId, employeeId: userId, type: "PERMISSION", status: "PENDING", startsAt: at(lastDay, 9), endsAt: at(lastDay, 12) });

      for (let n = 0; n < 30; n += 1) {
        rows.notification.push({ userId, barId, title: "Turno pubblicato", message: "La settimana è online.", type: "SHIFT_PUBLISHED", read: n > 3, actionUrl: "/dashboard/calendar", createdAt: new Date(Date.now() - n * 86_400_000) });
      }
    });

    for (let n = 0; n < months * 10; n += 1) {
      rows.note.push({ barId, authorId: ownerId, content: `Nota di servizio ${n}: controllare le scorte del frigo bar.`, isPinned: n === 0, createdAt: new Date(Date.now() - n * 3 * 86_400_000) });
      rows.task.push({ barId, title: `Pulizia ${n}`, dueDate: new Date(Date.now() + (n - 10) * 86_400_000), assignedToAll: true, createdById: ownerId, status: n < 10 ? "DONE" : "TODO" });
    }

    rows.course.push({ barId, title: "HACCP aggiornamento", kind: "HACCP", startsAt: at(today, 9), endsAt: at(today, 13), assignedToAll: true, createdById: ownerId });

    await insert(prisma, "user", rows.user);
    await insert(prisma, "bar", rows.bar);
    for (const model of ["barSettings", "subscription", "employeeBar", "legalAcceptance", "session", "shift", "shiftAssignment", "timeLog", "request", "note", "task", "notification", "course"]) {
      await insert(prisma, model, rows[model]);
    }

    totals.shifts += rows.shift.length;
    totals.timeLogs += rows.timeLog.length;
    process.stdout.write(`\rBar ${b + 1}/${first + bars} · turni ${totals.shifts} · timbrature ${totals.timeLogs}`);
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(sessions));
  console.log(`\nFatto. ${sessions.length} sessioni in ${path.relative(process.cwd(), OUT_FILE)}.`);
  console.log(`Per entrare a mano: titolare-0@${DOMAIN} / ${PASSWORD}`);
}

async function main() {
  const options = readArgs();
  const prisma = connect();

  try {
    if (options.cleanup) {
      await cleanup(prisma);
    } else {
      await seed(prisma, options);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
