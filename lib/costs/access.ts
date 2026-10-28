/**
 * Costs and suppliers is new: it shows only where it is switched on -
 * COSTS_ENABLED=1 for every owner, otherwise only to the super admin in the
 * venues they own, to try it on real invoices first.
 */
export function costsEnabledFor(userRole: string | null | undefined) {
  return process.env.COSTS_ENABLED?.trim() === "1" || String(userRole) === "SUPER_ADMIN";
}
