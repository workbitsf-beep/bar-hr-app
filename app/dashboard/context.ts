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

function isMissingColumnError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2022"
  );
}

async function getDashboardFeatureSettings(barId: string) {
  try {
    return await prisma.barSettings.findUnique({
      where: { barId },
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
    });
  } catch (error) {
    if (!isMissingColumnError(error)) {
      throw error;
    }
  }

  const expectedColumns = [
    "timeTrackingEnabled",
    "shiftsEnabled",
    "requestsEnabled",
    "availabilityEnabled",
    "overtimeEnabled",
    "tasksEnabled",
    "noticeBoardEnabled",
    "coursesEnabled",
    "documentsEnabled",
    "reportsEnabled",
    "companyShiftsEnabled",
  ];
  const availableColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'BarSettings'
      AND column_name IN (
        'timeTrackingEnabled',
        'shiftsEnabled',
        'requestsEnabled',
        'availabilityEnabled',
        'overtimeEnabled',
        'tasksEnabled',
        'noticeBoardEnabled',
        'coursesEnabled',
        'documentsEnabled',
        'reportsEnabled',
        'companyShiftsEnabled'
      )
  `;
  const columnSet = new Set(availableColumns.map((column) => column.column_name));
  const selectedColumns = expectedColumns.filter((column) => columnSet.has(column));

  if (selectedColumns.length === 0) {
    return null;
  }

  const quotedColumns = selectedColumns.map((column) => `"${column}"`).join(", ");
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, boolean | null>>>(
    `SELECT ${quotedColumns} FROM "BarSettings" WHERE "barId" = $1 LIMIT 1`,
    barId
  );

  return rows[0] ?? null;
}

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
      ? getDashboardFeatureSettings(activeBar.id)
      : Promise.resolve(null),
  ]);
  const rawFeatures = getFeatureFlags(featureSettings);
  const features =
    activeBar?.activityType === ActivityType.COMPANY
      ? {
          ...rawFeatures,
          shifts: featureSettings?.companyShiftsEnabled === false ? false : rawFeatures.shifts,
          timeTracking: false,
        }
      : rawFeatures;
  const ownerNeedsSubscriptionActivation =
    role === Role.OWNER && Boolean(billingStatus?.requiresActivation);
  const isCompany = activeBar?.activityType === ActivityType.COMPANY;
  const notesEnabled = features.tasks || features.noticeBoard;
  const requestsNavLabel = features.requests ? t.requests : t.availability;
  const calendarNavLabel = t.shifts;

  const navItems: DashboardNavItem[] =
    String(role) === "SUPER_ADMIN"
      ? [
          { label: "Panoramica", href: "/dashboard/super-admin" },
          { label: "Titolari", href: "/dashboard/super-admin/owners" },
          { label: "Attività", href: "/dashboard/super-admin/bars" },
          { label: "Abbonamenti", href: "/dashboard/super-admin/billing" },
          { label: "GPS globale", href: "/dashboard/super-admin/gps" },
          { label: "Documenti legali", href: "/dashboard/super-admin/legal" },
          { label: "Utilizzo", href: "/dashboard/super-admin/system" },
          { label: "Impostazioni", href: "/dashboard/super-admin/settings" },
        ]
      : [
          { label: "Profilo", href: "/dashboard" },
          ...(features.shifts ||
          features.requests ||
          features.availability ||
          notesEnabled ||
          features.courses
            ? [{ label: calendarNavLabel, href: "/dashboard/calendar" }]
            : []),
          ...(notesEnabled
            ? [{ label: "Note", href: "/dashboard/tasks" }]
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
