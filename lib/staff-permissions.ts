/**
 * What a Responsabile or Amministrazione may do, and where.
 *
 * The owner chooses, person by person: a scope - the whole venue or company,
 * or some departments (a restaurant's Sala) or sites (Monza and Bergamo) - and
 * which of eight permissions they hold there. The owner and the super admin
 * may do everything; an employee nothing of this.
 *
 * Every check about managing goes through `can`, never through the role
 * alone: a Responsabile di Sala with only "Turni" changes Sala's shifts and
 * nothing else.
 */

export const PERMISSIONS = [
  "shifts",
  "requests",
  "timelogs",
  "notes",
  "checklists",
  "people",
  "documents",
  "reports",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, { title: string; lead: string }> = {
  shifts: { title: "Turni", lead: "Crea, modifica e pubblica" },
  requests: { title: "Richieste", lead: "Approva ferie, permessi e cambi turno" },
  timelogs: { title: "Timbrature", lead: "Vede le ore, approva le correzioni" },
  notes: { title: "Note e avvisi", lead: "Scrive note e avvisi" },
  checklists: { title: "Checklist e ordini", lead: "Apertura, chiusura, lista spesa" },
  people: { title: "Persone", lead: "Aggiunge e toglie dipendenti" },
  documents: { title: "Documenti", lead: "Contratti e buste paga" },
  reports: { title: "Report ore", lead: "Scarica il PDF del mese" },
};

export const DEFAULT_PERMISSIONS: Record<"MANAGER" | "AMMINISTRAZIONE", Permission[]> = {
  MANAGER: ["shifts", "requests", "timelogs", "notes", "checklists"],
  AMMINISTRAZIONE: ["timelogs", "documents", "reports", "people"],
};

export type StaffAccess = {
  role: string;
  permissions?: string[] | null;
  /** The departments or sites they cover; empty or absent: the whole venue. */
  managesDepartments?: string[] | null;
};

export function parsePermissions(values: unknown[]): Permission[] {
  const set = new Set(values.map((value) => String(value)));
  return PERMISSIONS.filter((permission) => set.has(permission));
}

function isBoss(role: string) {
  return role === "OWNER" || role === "SUPER_ADMIN";
}

export function isStaffRole(role: string) {
  return role === "MANAGER" || role === "AMMINISTRAZIONE";
}

/**
 * May this person do `permission`? With `department`, only if it is within
 * their scope; a shift or note marked Jolly belongs to every department.
 * `null` means the whole venue: only staff over all of it.
 * Without it, whether they may do it anywhere at all (to show a page).
 */
export function can(access: StaffAccess | null | undefined, permission: Permission, department?: string | null) {
  if (!access) return false;
  if (isBoss(access.role)) return true;
  if (!isStaffRole(access.role)) return false;
  if (!(access.permissions ?? []).includes(permission)) return false;
  const scope = access.managesDepartments ?? [];
  if (department === undefined || scope.length === 0) return true;
  return department === "JOLLY" || (department !== null && scope.includes(department));
}

/** True when the person sees everything, not some departments or sites. */
export function hasWholeScope(access: StaffAccess | null | undefined) {
  if (!access) return false;
  return isBoss(access.role) || (isStaffRole(access.role) && !(access.managesDepartments ?? []).length);
}

/**
 * The departments a scoped person is limited to, for filtering lists: null
 * when they see the whole venue.
 */
export function scopeOf(access: StaffAccess | null | undefined): string[] | null {
  if (!access || isBoss(access.role) || !isStaffRole(access.role)) return null;
  const scope = access.managesDepartments ?? [];
  return scope.length ? scope : null;
}
