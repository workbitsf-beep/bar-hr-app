import { Department, DepartmentMode, Role } from "@prisma/client";
import { cache } from "react";
import { entitlementsOf } from "@/lib/plans";
import { prisma } from "@/lib/prisma";

/**
 * Departments: banco, cucina, sala, and one the owner names.
 *
 * A Pro venue only. The shifts are the same whichever way the owner looks at
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
};

const FIXED_NAMES: Record<Exclude<Department, "CUSTOM">, string> = {
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
  mode: DepartmentMode;
  list: DepartmentInfo[];
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
    mode: DepartmentMode.UNIFIED,
    list: [],
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
      },
    }),
    prisma.employeeBar.findFirst({
      where: { barId, userId, isActive: true },
      select: { department: true, helpsIn: true, isDepartmentLead: true },
    }),
  ]);

  // Departments come with Pro, or as an extra on Base.
  if (!bar || !entitlementsOf(bar).departments) return off;

  return {
    enabled: true,
    mode: bar.departmentMode,
    list: venueDepartments(bar.customDepartmentName),
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
