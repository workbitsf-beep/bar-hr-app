import { ActivityType, Department, DepartmentMode, Role } from "@prisma/client";
import { cache } from "react";
import { entitlementsOf, siteLimitOf } from "@/lib/plans";
import { prisma } from "@/lib/prisma";

/**
 * Departments: banco, cucina, sala, and one the owner names. For a company
 * the same separation is by site: up to three with the Sedi extra, six on
 * Pro, each named by the owner and with its own clock-in point.
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
};

export const SITE_SLOTS = [
  Department.SEDE_1,
  Department.SEDE_2,
  Department.SEDE_3,
  Department.SEDE_4,
  Department.SEDE_5,
  Department.SEDE_6,
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
};

/**
 * A company's sites, in slot order. Two sites starting with the same letter
 * get two letters each in their dot.
 */
export function venueSites(
  sites: Array<{ slot: Department; name: string; address: string | null; latitude: number | null; longitude: number | null }>
): SiteInfo[] {
  const ordered = [...sites].sort(
    (a, b) => (SITE_SLOTS as readonly Department[]).indexOf(a.slot) - (SITE_SLOTS as readonly Department[]).indexOf(b.slot)
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
      ...DEPARTMENT_COLORS[site.slot],
    };
  });
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
  /** The person looking: where they work and whether they lead it. */
  mine: { department: Department | null; helpsIn: Department[]; isLead: boolean };
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
    mine: { department: null, helpsIn: [], isLead: false },
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
        sites: { select: { slot: true, name: true, address: true, latitude: true, longitude: true } },
      },
    }),
    prisma.employeeBar.findFirst({
      where: { barId, userId, isActive: true },
      select: { department: true, helpsIn: true, isDepartmentLead: true },
    }),
  ]);

  // Departments come with Pro, or as an extra on Base.
  if (!bar) return off;
  const entitlements = entitlementsOf(bar);
  if (!entitlements.departments) return off;

  const company = bar.activityType === ActivityType.COMPANY;
  const siteLimit = company ? siteLimitOf(entitlements) : 0;
  // A plan that went down keeps the first sites it allows.
  const sites = company ? venueSites(bar.sites).slice(0, siteLimit) : [];

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
      isLead: Boolean(membership?.isDepartmentLead && membership.department),
    },
  };
});

/**
 * Who may manage the shifts of a department: the owner and managers always,
 * a department lead only their own.
 */
export function canManageDepartment(
  access: { role: Role | string; department: Department | null; isLead: boolean },
  department: Department | null
) {
  if (access.role === Role.OWNER || access.role === Role.MANAGER || String(access.role) === "SUPER_ADMIN") return true;
  return Boolean(access.isLead && access.department && access.department === department);
}
