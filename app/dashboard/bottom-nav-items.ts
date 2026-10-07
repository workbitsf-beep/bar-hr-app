import type { DashboardNavItem } from "./context";

/**
 * Which sections get a tab in the bottom bar; the rest go in the menu. Shared
 * by the server shell, which builds the menu, and the client bar, which marks
 * the active tab, so the two always agree. A super admin inside a venue has
 * the Console tab at the end, so `slots` is 4 there.
 */
export function getBottomNavItems(navItems: DashboardNavItem[], slots = 5) {
  const preferredHrefs = [
    "/dashboard",
    "/dashboard/calendar",
    "/dashboard/tasks",
    "/dashboard/documents",
    "/dashboard/timelogs",
    "/dashboard/requests",
  ];
  const preferred = preferredHrefs
    .map((href) => navItems.find((item) => item.href === href))
    .filter((item): item is DashboardNavItem => Boolean(item));
  const fill = navItems.filter((item) => !preferred.some((selected) => selected.href === item.href));

  return [...preferred, ...fill].slice(0, slots);
}
