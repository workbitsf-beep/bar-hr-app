import { cache } from "react";
import { ActivityType, AppLanguage, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getBillingStatus, type BillingStatusResult } from "@/lib/billing";
import { getFeatureFlags, type FeatureFlags } from "@/lib/features";
import { getActiveBarAccess, getPostLoginDestination } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
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
  features: FeatureFlags;
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

  const [billingStatus, featureSettings] = await Promise.all([
    activeBar?.id && String(role) !== "SUPER_ADMIN"
      ? getBillingStatus(activeBar.id)
      : Promise.resolve(null),
    activeBar?.id && String(role) !== "SUPER_ADMIN"
      ? prisma.barSettings.findUnique({
          where: { barId: activeBar.id },
          select: {
            timeTrackingEnabled: true,
            shiftsEnabled: true,
            requestsEnabled: true,
            availabilityEnabled: true,
            overtimeEnabled: true,
            tasksEnabled: true,
            noticeBoardEnabled: true,
            coursesEnabled: true,
            documentsEnabled: true,
            reportsEnabled: true,
            companyShiftsEnabled: true,
          },
        })
      : Promise.resolve(null),
  ]);
  const rawFeatures = getFeatureFlags(featureSettings);
  const features =
    activeBar?.activityType === ActivityType.COMPANY && featureSettings?.companyShiftsEnabled === false
      ? { ...rawFeatures, shifts: false }
      : rawFeatures;
  const ownerNeedsSubscriptionActivation =
    role === Role.OWNER && Boolean(billingStatus?.requiresActivation);
  const isCompany = activeBar?.activityType === ActivityType.COMPANY;
  const tasksNavLabel = features.tasks ? "Note" : t.board;
  const requestsNavLabel = features.requests ? t.requests : t.availability;

  const navItems: DashboardNavItem[] =
    String(role) === "SUPER_ADMIN"
      ? [
          { label: "Control room", href: "/dashboard/super-admin" },
          { label: "Titolari", href: "/dashboard/super-admin/owners" },
          { label: "Attività", href: "/dashboard/super-admin/bars" },
          { label: "Pagamenti", href: "/dashboard/super-admin/billing" },
          { label: "GPS globale", href: "/dashboard/super-admin/gps" },
        ]
      : [
          { label: "Profilo", href: "/dashboard" },
          ...(features.shifts ||
          features.requests ||
          features.availability ||
          features.tasks ||
          features.courses
            ? [{ label: t.shifts, href: "/dashboard/calendar" }]
            : []),
          ...(features.tasks
            ? [{ label: tasksNavLabel, href: "/dashboard/tasks" }]
            : []),
          ...(features.documents ? [{ label: "Documenti", href: "/dashboard/documents" }] : []),
          ...(features.courses ? [{ label: "Corsi", href: "/dashboard/courses" }] : []),
          ...(features.timeTracking && !isCompany
            ? [{ label: t.timelogs, href: "/dashboard/timelogs" }]
            : []),
          ...(features.requests || features.availability
            ? [{ label: requestsNavLabel, href: "/dashboard/requests" }]
            : []),
        ];

  if (role === Role.OWNER) {
    navItems.push({ label: t.people, href: "/dashboard/people" });
    navItems.push({ label: t.settings, href: "/dashboard/settings" });
  } else if (String(role) !== "SUPER_ADMIN") {
    navItems.push({ label: t.settings, href: "/dashboard/settings" });
  }

  if (role !== Role.OWNER && String(role) !== "SUPER_ADMIN" && features.reports) {
    navItems.push({ label: t.personalPdf, href: "/dashboard/export" });
  } else if (role === Role.OWNER && features.reports) {
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
    features,
    ownerNeedsSubscriptionActivation,
    navItems,
    accessibleBars,
  };
});
