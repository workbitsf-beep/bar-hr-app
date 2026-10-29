import "server-only";

import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { canAccessBar } from "@/lib/billing";
import { getActiveBarAccess } from "@/lib/permissions";
import { RuleError } from "@/lib/rule-error";
import { can } from "@/lib/staff-permissions";

/**
 * The month's attendance is the owner's and their staff's with the report
 * permission (within their people); who it goes to, and how the file is
 * made, is the owner's alone.
 */
export async function payrollAccess(options: { ownerOnly?: boolean } = {}) {
  const session = await getSession();
  if (!session) throw new RuleError("Accedi di nuovo.");
  const { activeBar, role, staff } = await getActiveBarAccess(session);
  if (!activeBar?.id) throw new RuleError("Scegli prima il locale.");
  const isOwner = role === Role.OWNER;
  if (options.ownerOnly && !isOwner) throw new RuleError("Solo il titolare cambia queste impostazioni.");
  if (!isOwner && !can(staff, "reports")) throw new RuleError("Le presenze per il consulente le prepara il titolare.");
  if (!(await canAccessBar(activeBar.id))) throw new RuleError("Abbonamento non attivo.");
  return { session, barId: activeBar.id, role, staff, isOwner };
}

export function monthKeyOf(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseMonthKey(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  return month >= 1 && month <= 12 && year >= 2020 && year <= 2100 ? { year, month } : null;
}

/** Payroll is closed at the start of the next month: until the 20th, that month comes first. */
export function defaultPayrollMonth(now = new Date()) {
  const date = new Date(now.getFullYear(), now.getMonth() - (now.getDate() <= 20 ? 1 : 0), 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** "a@b.it, c@d.it" into the addresses that look right. */
export function emailList(value: string | null | undefined) {
  return (value ?? "")
    .split(/[\s,;]+/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => EMAIL_PATTERN.test(item));
}
