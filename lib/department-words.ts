/**
 * How the app speaks of the separation: departments for a venue, sites for a
 * company. Kept apart from lib/departments so screens on the phone can use it.
 */

export type DepartmentWords = {
  one: string;
  many: string;
  One: string;
  Many: string;
  lead: string;
  Lead: string;
  /** "nel reparto" / "nella sede" */
  inThe: string;
  /** "Un calendario per reparto" / "per sede" */
  perOne: string;
};

export const DEPARTMENT_WORDS: DepartmentWords = {
  one: "reparto",
  many: "reparti",
  One: "Reparto",
  Many: "Reparti",
  lead: "capo reparto",
  Lead: "Capo reparto",
  inThe: "nel reparto",
  perOne: "per reparto",
};

export const SITE_WORDS: DepartmentWords = {
  one: "sede",
  many: "sedi",
  One: "Sede",
  Many: "Sedi",
  lead: "responsabile di sede",
  Lead: "Responsabile di sede",
  inThe: "nella sede",
  perOne: "per sede",
};

