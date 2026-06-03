import { cache } from "react";
import { ActivityType, AppLanguage, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getBillingStatus, type BillingStatusResult } from "@/lib/billing";
import { getActiveBarAccess, getPostLoginDestination } from "@/lib/permissions";
import { getTranslation } from "@/lib/i18n";

export type DashboardNavItem = {
  label: string;
  href: string;
};

export type DashboardContext = {
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
  role: Role | string;
  language: AppLanguage;
  t: ReturnType<typeof getTranslation>;
  activeBarId: string | null;
  activeBarName: string | null;
  activeBarActivityType: ActivityType | null;
  billingStatus: BillingStatusResult | null;
  ownerNeedsSubscriptionActivation: boolean;
  navItems: DashboardNavItem[];
  accessibleBars: {
    id: string;
    name: string;
    role: Role;
    activityType: ActivityType;
  }[];
};

export const getDashboardContext = cache(async function getDashboardContext(
  allowBillingDestination = false
): Promise<DashboardContext> {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const redirectTo = await getPostLoginDestination({
    userId: session.user.id,
    role: session.user.role,
    mustChangePwd: session.user.mustChangePwd,
    activeBarId: session.activeBarId,
  });

  if (
    !redirectTo.startsWith("/dashboard") &&
    !(allowBillingDestination && redirectTo === "/billing")
  ) {
    redirect(redirectTo);
  }
  const { activeBar, accessibleBars, role } = await getActiveBarAccess(session);
  const language = session.user.language ?? AppLanguage.it;
  const t = getTranslation(language);

  const billingStatus =
    activeBar?.id && String(role) !== "SUPER_ADMIN"
      ? await getBillingStatus(activeBar.id)
      : null;
  const ownerNeedsSubscriptionActivation =
    role === Role.OWNER && Boolean(billingStatus?.requiresActivation);
  const isCompany = activeBar?.activityType === ActivityType.COMPANY;

  const navItems: DashboardNavItem[] =
    String(role) === "SUPER_ADMIN"
      ? [
          { label: "Dashboard", href: "/dashboard/super-admin" },
          { label: "Responsabili", href: "/dashboard/super-admin/owners" },
          { label: "Strutture", href: "/dashboard/super-admin/bars" },
          { label: "Abbonamenti", href: "/dashboard/super-admin/billing" },
          { label: "GPS", href: "/dashboard/super-admin/gps" },
        ]
      : isCompany
        ? [
          { label: t.calendar, href: "/dashboard/calendar" },
          { label: t.dashboard, href: "/dashboard" },
          { label: t.tasks, href: "/dashboard/tasks" },
          { label: "Corsi", href: "/dashboard/courses" },
          { label: t.requests, href: "/dashboard/requests" },
        ]
        : [
          { label: t.calendar, href: "/dashboard/calendar" },
          { label: t.dashboard, href: "/dashboard" },
          { label: t.shifts, href: "/dashboard/shifts" },
          { label: t.tasks, href: "/dashboard/tasks" },
          { label: "Corsi", href: "/dashboard/courses" },
          { label: t.timelogs, href: "/dashboard/timelogs" },
          { label: t.requests, href: "/dashboard/requests" },
        ];

  if (role === Role.OWNER) {
    navItems.push({ label: t.people, href: "/dashboard/people" });
    navItems.push({ label: t.settings, href: "/dashboard/settings" });
  } else if (String(role) !== "SUPER_ADMIN") {
    navItems.push({ label: t.settings, href: "/dashboard/settings" });
  }

  if (role !== Role.OWNER && String(role) !== "SUPER_ADMIN") {
    navItems.push({ label: t.personalPdf, href: "/dashboard/export" });
  } else if (role === Role.OWNER) {
    navItems.push({ label: t.exportPdf, href: "/dashboard/export" });
  }

  return {
    session,
    role,
    language,
    t,
    activeBarId: activeBar?.id ?? null,
    activeBarName: activeBar?.name ?? null,
    activeBarActivityType: activeBar?.activityType ?? null,
    billingStatus,
    ownerNeedsSubscriptionActivation,
    navItems,
    accessibleBars,
  };
});
