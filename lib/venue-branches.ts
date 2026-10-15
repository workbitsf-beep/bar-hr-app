import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * A restaurant's branches (sedi, 15 October 2026): venues of their own -
 * departments, calendar, clock-in point, people, permissions - under the same
 * name and tax details, billed with the main venue. The main venue holds the
 * subscription; its plan and extras (Reparti, packs, Stile) are copied onto
 * every branch, and the people limit counts all of them together.
 *
 * A company's sites are something else: Site rows inside one venue.
 */

type Db = Prisma.TransactionClient | typeof prisma;

/** The venue that holds the subscription: itself, or the one it is a branch of. */
export async function mainBarIdOf(barId: string, db: Db = prisma) {
  const bar = await db.bar.findUnique({ where: { id: barId }, select: { mainBarId: true } });
  return bar?.mainBarId ?? barId;
}

/** The main venue and its branches, the main one first. */
export async function familyBarIds(barId: string, db: Db = prisma) {
  const mainId = await mainBarIdOf(barId, db);
  const branches = await db.bar.findMany({ where: { mainBarId: mainId }, select: { id: true }, orderBy: { createdAt: "asc" } });
  return [mainId, ...branches.map((branch) => branch.id)];
}

/** What a branch takes from its main venue whenever that changes. */
export async function syncBranchesFromMain(mainId: string, db: Db = prisma) {
  const main = await db.bar.findUnique({
    where: { id: mainId },
    select: {
      plan: true,
      departmentsAddon: true,
      extraSeatPacks: true,
      brandingAddon: true,
      customSeatLimit: true,
      customSiteLimit: true,
      customPriceCents: true,
      customPlanNote: true,
    },
  });
  if (!main) return 0;
  const result = await db.bar.updateMany({
    where: { mainBarId: mainId },
    // A branch pays nothing of its own: its sites count stays 0.
    data: { ...main, extraSites: 0 },
  });
  return result.count;
}

/** The settings a new branch starts from: the main venue's, without its clock-in point. */
const SETTINGS_KEPT = [
  "companyShiftsEnabled",
  "timeTrackingEnabled",
  "shiftsEnabled",
  "requestsEnabled",
  "availabilityEnabled",
  "overtimeEnabled",
  "tasksEnabled",
  "noticeBoardEnabled",
  "coursesEnabled",
  "documentsEnabled",
  "reportsEnabled",
  "shoppingListEnabled",
  "roundingEnabled",
  "roundingMinutes",
  "roundingMode",
  "morningStartTime",
  "morningEndTime",
  "afternoonStartTime",
  "afternoonEndTime",
  "eveningStartTime",
  "eveningEndTime",
  "standardShiftPresets",
] as const;

/**
 * A new branch of a restaurant: same name, legal name, VAT number and owners
 * as the main venue, its own address and clock-in point. Its plan is the
 * main venue's, and it has no subscription of its own.
 */
export async function createBranch(
  mainId: string,
  input: { label: string; addressLine1: string | null; city: string | null; postalCode: string | null },
  db: typeof prisma = prisma
) {
  return db.$transaction(async (tx) => {
    const main = await tx.bar.findUniqueOrThrow({
      where: { id: mainId },
      include: {
        settings: true,
        memberships: { where: { role: "OWNER", isActive: true }, select: { userId: true } },
      },
    });

    const branch = await tx.bar.create({
      data: {
        name: `${main.name} · ${input.label}`,
        legalName: main.legalName,
        email: main.email,
        phone: main.phone,
        addressLine1: input.addressLine1,
        city: input.city,
        postalCode: input.postalCode,
        vatNumber: main.vatNumber,
        latitude: 0,
        longitude: 0,
        radiusMeters: main.radiusMeters,
        entryToleranceMin: main.entryToleranceMin,
        roundingStepMin: main.roundingStepMin,
        exitToleranceMin: main.exitToleranceMin,
        roundingEnabled: main.roundingEnabled,
        activityType: main.activityType,
        plan: main.plan,
        departmentsAddon: main.departmentsAddon,
        extraSeatPacks: main.extraSeatPacks,
        brandingAddon: main.brandingAddon,
        extraSites: 0,
        customPriceCents: main.customPriceCents,
        customSeatLimit: main.customSeatLimit,
        customSiteLimit: main.customSiteLimit,
        customPlanNote: main.customPlanNote,
        logo: main.logo,
        logoType: main.logoType,
        logoUpdatedAt: main.logoUpdatedAt,
        signFont: main.signFont,
        departmentMode: main.departmentMode,
        customDepartmentName: main.customDepartmentName,
        businessDeclaredAt: main.businessDeclaredAt,
        businessDeclaredIp: main.businessDeclaredIp,
        ownerId: main.ownerId,
        mainBarId: main.id,
      },
    });

    const kept: Record<string, unknown> = {};
    for (const key of SETTINGS_KEPT) {
      const value = main.settings?.[key];
      if (value !== undefined && value !== null) kept[key] = value;
    }
    await tx.barSettings.create({
      data: {
        ...(kept as Prisma.BarSettingsUncheckedCreateInput),
        barId: branch.id,
        gpsLatitude: null,
        gpsLongitude: null,
        gpsRadius: main.settings?.gpsRadius ?? main.radiusMeters,
      },
    });

    const ownerIds = new Set([main.ownerId, ...main.memberships.map((membership) => membership.userId)]);
    await tx.employeeBar.createMany({
      data: [...ownerIds].map((userId) => ({ userId, barId: branch.id, role: "OWNER" as const, isActive: true })),
      skipDuplicates: true,
    });

    return branch;
  });
}
