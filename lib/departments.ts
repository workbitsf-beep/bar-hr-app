import { ActivityType, Department, DepartmentMode, Role } from "@prisma/client";
import { cache } from "react";
import { entitlementsOf, siteLimitOf } from "@/lib/plans";
import { prisma } from "@/lib/prisma";

/**
 * Departments: banco, cucina, sala, and one the owner names. For a company
 * the same separation is by site: its main site plus up to three paid on
 * Base, up to six in all on Pro, each with its own name and clock-in point.
 *
 * Pro, or the Reparti / Sedi extra on Base. The shifts are the same whichever way the owner looks at
 * them: one weekly calendar split by department, or one calendar per
 * department run by its lead. A Base venue sees the app exactly as before.
 */

export const FIXED_DEPARTMENTS = [Department.BANCO, Department.CUCINA, Department.SALA] as const;

/**
 * Banco is blue, not violet: violet is Workbit's own colour, and it stays on
 * the shifts that belong to no department. Each colour has a light end and a
 * deep one, for the gradients of the chips and the week's bars.
 */
export const DEPARTMENT_COLORS: Record<Department, { ink: string; soft: string; light: string }> = {
  BANCO: { ink: "#3b5bdb", soft: "#e7edff", light: "#5b7cfa" },
  CUCINA: { ink: "#e8700c", soft: "#fff1e3", light: "#ffa04a" },
  SALA: { ink: "#0f9784", soft: "#ddf7f2", light: "#2fc4ae" },
  CUSTOM: { ink: "#c2257a", soft: "#fde6f2", light: "#f06bb0" },
  // Jolly: graphite, apart from every department and from the violet of
  // shifts with no department.
  JOLLY: { ink: "#2a2540", soft: "#ecebf3", light: "#6b6488" },
  SEDE_1: { ink: "#3b5bdb", soft: "#e7edff", light: "#5b7cfa" },
  SEDE_2: { ink: "#e8700c", soft: "#fff1e3", light: "#ffa04a" },
  SEDE_3: { ink: "#0f9784", soft: "#ddf7f2", light: "#2fc4ae" },
  SEDE_4: { ink: "#c2257a", soft: "#fde6f2", light: "#f06bb0" },
  SEDE_5: { ink: "#a16207", soft: "#fdf3d7", light: "#d4a017" },
  SEDE_6: { ink: "#0e7490", soft: "#dcf3f9", light: "#22a6c6" },
  SEDE_7: { ink: "#4d7c0f", soft: "#ecf7d8", light: "#7cb518" },
  SEDE_8: { ink: "#be123c", soft: "#fde4ea", light: "#f04f74" },
  SEDE_9: { ink: "#6d28d9", soft: "#efe7ff", light: "#9b6cf5" },
  SEDE_10: { ink: "#9a3412", soft: "#fbe7dd", light: "#d4602c" },
  SEDE_11: { ink: "#1e40af", soft: "#e2e9fc", light: "#4a6fdc" },
  SEDE_12: { ink: "#0f766e", soft: "#d9f2ef", light: "#2aa497" },
};

export const SITE_SLOTS = [
  Department.SEDE_1,
  Department.SEDE_2,
  Department.SEDE_3,
  Department.SEDE_4,
  Department.SEDE_5,
  Department.SEDE_6,
  Department.SEDE_7,
  Department.SEDE_8,
  Department.SEDE_9,
  Department.SEDE_10,
  Department.SEDE_11,
  Department.SEDE_12,
] as const;

export function isSiteSlot(value: Department | null | undefined) {
  return Boolean(value && (SITE_SLOTS as readonly Department[]).includes(value));
}

export { DEPARTMENT_WORDS, SITE_WORDS, type DepartmentWords } from "@/lib/department-words";
import { DEPARTMENT_WORDS, SITE_WORDS, type DepartmentWords } from "@/lib/department-words";

export function departmentWordsFor(activityType: ActivityType | string | null | undefined) {
  return activityType === ActivityType.COMPANY ? SITE_WORDS : DEPARTMENT_WORDS;
}

const FIXED_NAMES: Record<"BANCO" | "CUCINA" | "SALA" | "JOLLY", string> = {
  BANCO: "Banco",
  CUCINA: "Cucina",
  SALA: "Sala",
  JOLLY: "Jolly",
};

export type DepartmentInfo = {
  id: Department;
  name: string;
  /** What sits inside the dot on a shift: one letter, two for the owner's own when its first is taken. */
  initials: string;
  ink: string;
  soft: string;
  light: string;
};

export function departmentInitials(id: Department, name: string) {
  if (id !== Department.CUSTOM) return name.charAt(0).toUpperCase();
  const clean = name.trim();
  const first = clean.charAt(0).toUpperCase();
  const taken = Object.values(FIXED_NAMES).some((fixed) => fixed.charAt(0) === first);
  return taken ? first + clean.charAt(1).toLowerCase() : first;
}

export type SiteInfo = DepartmentInfo & {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  /** The company's own place: always first, never removed. */
  isMain: boolean;
};

/**
 * A company's sites: the main one first, then the others in slot order. Two
 * sites starting with the same letter get two letters each in their dot.
 */
export function venueSites(
  sites: Array<{
    slot: Department;
    name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    isMain?: boolean;
  }>
): SiteInfo[] {
  const ordered = [...sites].sort(
    (a, b) =>
      Number(Boolean(b.isMain)) - Number(Boolean(a.isMain)) ||
      (SITE_SLOTS as readonly Department[]).indexOf(a.slot) - (SITE_SLOTS as readonly Department[]).indexOf(b.slot)
  );
  return ordered.map((site) => {
    const clean = site.name.trim();
    const first = clean.charAt(0).toUpperCase();
    const shared = ordered.filter((other) => other.name.trim().charAt(0).toUpperCase() === first).length > 1;
    return {
      id: site.slot,
      name: clean,
      initials: shared ? first + clean.charAt(1).toLowerCase() : first,
      address: site.address,
      latitude: site.latitude,
      longitude: site.longitude,
      isMain: Boolean(site.isMain),
      ...DEPARTMENT_COLORS[site.slot],
    };
  });
}

/**
 * The company's main site: the company itself, with its name, address and
 * clock-in point. Made the first time the sites are read, in the first free
 * slot; with none free, the first site becomes the main one.
 */
async function ensureMainSite(barId: string, sites: Array<{ slot: Department; isMain: boolean }>) {
  if (sites.some((site) => site.isMain)) return false;

  const free = SITE_SLOTS.find((slot) => !sites.some((site) => site.slot === slot));
  if (!free) {
    const first = venueSites(sites.map((site) => ({ ...site, name: "", address: null, latitude: null, longitude: null })))[0];
    await prisma.site.updateMany({ where: { barId, slot: first.id }, data: { isMain: true } });
    return true;
  }

  const bar = await prisma.bar.findUnique({
    where: { id: barId },
    select: {
      name: true,
      addressLine1: true,
      city: true,
      latitude: true,
      longitude: true,
      settings: { select: { gpsLatitude: true, gpsLongitude: true } },
    },
  });
  if (!bar) return false;

  const point =
    bar.settings?.gpsLatitude != null && bar.settings.gpsLongitude != null
      ? { latitude: bar.settings.gpsLatitude, longitude: bar.settings.gpsLongitude }
      : { latitude: bar.latitude, longitude: bar.longitude };

  // Two pages loading at once may both try: the unique slot keeps one.
  await prisma.site
    .create({
      data: {
        barId,
        slot: free,
        isMain: true,
        name: bar.name.trim().slice(0, 28) || "Sede principale",
        address: [bar.addressLine1, bar.city].filter(Boolean).join(", ").slice(0, 160) || null,
        ...point,
      },
    })
    .catch(() => null);
  return true;
}

/** The departments a venue shows: the three fixed ones, plus its own once named. */
export function venueDepartments(customName: string | null | undefined): DepartmentInfo[] {
  const list: DepartmentInfo[] = FIXED_DEPARTMENTS.map((id) => ({
    id,
    name: FIXED_NAMES[id],
    initials: FIXED_NAMES[id].charAt(0),
    ...DEPARTMENT_COLORS[id],
  }));
  const name = customName?.trim();
  if (name) {
    list.push({ id: Department.CUSTOM, name, initials: departmentInitials(Department.CUSTOM, name), ...DEPARTMENT_COLORS.CUSTOM });
  }
  // Jolly last: not a department of its own but a mark on a shift or a note,
  // which then shows in every department.
  list.push({ id: Department.JOLLY, name: FIXED_NAMES.JOLLY, initials: "J", ...DEPARTMENT_COLORS.JOLLY });
  return list;
}

/**
 * The real departments: the ones people work in and the calendar has a tab
 * for. Jolly is left out - it has no calendar, page or section of its own.
 */
export function staffDepartments(list: DepartmentInfo[]) {
  return list.filter((entry) => entry.id !== Department.JOLLY);
}

/** Whether something filed under `department` shows in the view of `active`: its own, or Jolly, which is in all of them. */
export function showsInDepartment(department: Department | null | undefined, active: Department | null) {
  return !active || department === active || department === Department.JOLLY;
}

export function parseDepartment(value: FormDataEntryValue | string | null | undefined): Department | null {
  const raw = String(value ?? "").trim().toUpperCase();
  return (Object.values(Department) as string[]).includes(raw) ? (raw as Department) : null;
}

export type VenueDepartments = {
  /** False on a Base venue: nothing about departments shows anywhere. */
  enabled: boolean;
  /** Departments for a venue, sites for a company. */
  kind: "departments" | "sites";
  words: DepartmentWords;
  mode: DepartmentMode;
  list: DepartmentInfo[];
  /** A company's sites with their address and clock-in point. */
  sites: SiteInfo[];
  /** How many sites the plan allows (3 with the extra, 6 on Pro); 0 for a venue. */
  siteLimit: number;
  customName: string | null;
  /** The person looking: where they work and where they help. */
  mine: { department: Department | null; helpsIn: Department[] };
};

/** Departments of a venue as seen by one person. Cached per request. */
export const getVenueDepartments = cache(async function getVenueDepartments(
  barId: string | null,
  userId: string
): Promise<VenueDepartments> {
  const off: VenueDepartments = {
    enabled: false,
    kind: "departments",
    words: DEPARTMENT_WORDS,
    mode: DepartmentMode.UNIFIED,
    list: [],
    sites: [],
    siteLimit: 0,
    customName: null,
    mine: { department: null, helpsIn: [] },
  };

  if (!barId) return off;

  const [bar, membership] = await Promise.all([
    prisma.bar.findUnique({
      where: { id: barId },
      select: {
        plan: true,
        departmentsAddon: true,
        extraSeatPacks: true,
        brandingAddon: true,
        departmentMode: true,
        customDepartmentName: true,
        activityType: true,
        extraSites: true,
        customSeatLimit: true,
        customSiteLimit: true,
        sites: { select: { slot: true, name: true, address: true, latitude: true, longitude: true, isMain: true } },
      },
    }),
    prisma.employeeBar.findFirst({
      where: { barId, userId, isActive: true },
      select: { department: true, helpsIn: true },
    }),
  ]);

  // Departments come with Pro, or as an extra on Base.
  if (!bar) return off;
  const entitlements = entitlementsOf(bar);
  if (!entitlements.departments) return off;

  const company = bar.activityType === ActivityType.COMPANY;
  const siteLimit = company ? siteLimitOf(entitlements) : 0;
  const stored =
    company && (await ensureMainSite(barId, bar.sites))
      ? await prisma.site.findMany({
          where: { barId },
          select: { slot: true, name: true, address: true, latitude: true, longitude: true, isMain: true },
        })
      : bar.sites;
  // A plan that went down keeps the main site and the first others it allows.
  const sites = company ? venueSites(stored).slice(0, siteLimit) : [];

  return {
    enabled: true,
    kind: company ? "sites" : "departments",
    words: company ? SITE_WORDS : DEPARTMENT_WORDS,
    mode: bar.departmentMode,
    list: company ? sites : venueDepartments(bar.customDepartmentName),
    sites,
    siteLimit,
    customName: bar.customDepartmentName,
    mine: {
      department: membership?.department ?? null,
      helpsIn: membership?.helpsIn ?? [],
    },
  };
});

