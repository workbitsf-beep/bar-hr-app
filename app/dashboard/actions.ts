"use server";

import bcrypt from "bcrypt";
import {
  ActivityType,
  AppLanguage,
  BillingInterval,
  CalendarClosureType,
  PlanType,
  Prisma,
  RequestStatus,
  RequestType,
  Role,
  SubscriptionStatus,
  TaskStatus,
} from "@prisma/client";
import type Stripe from "stripe";
import { cookies, headers } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  sendEmployeeWelcomeEmail,
  sendLeaveRequestEmail,
  sendLeaveRequestResultEmail,
  sendNoticeBoardDigestEmail,
  sendNoticeBoardEmail,
  sendOwnerWelcomeEmail,
  sendShiftSwapRequestEmail,
  sendShiftSwapResultEmail,
  sendTaskAssignedDigestEmail,
  sendTaskAssignedEmail,
  sendUnavailabilityEmail,
} from "@/lib/email/notifications";
import {
  barNeedsSubscriptionActivation,
  canAccessBar as canAccessBillingBar,
  createDefaultTrialEndsAt,
  invalidateBillingStatusCache,
} from "@/lib/billing";
import { LANGUAGE_COOKIE_NAME } from "@/lib/language";
import { parseDateTimeLocal } from "@/lib/date-time-local";
import { prisma } from "@/lib/prisma";
import { invalidateReportingCache } from "@/lib/reporting";
import { cancelStripeSubscriptionSafely, requireStripe } from "@/lib/stripe";
import { parseTaskDueDate } from "@/lib/task-dates";
import {
  canManageOperations,
  canManagePeople,
  getActiveBarAccess,
  getAccessibleBarsForUser,
  userCanAccessBar,
} from "@/lib/permissions";
import {
  getSession,
  SESSION_COOKIE_NAME,
  SESSION_PERSIST_COOKIE_NAME,
} from "@/lib/auth";
import { applyGlobalGpsRadius, getGlobalGpsRadius } from "@/lib/gps-settings";
import { deleteShiftWithCleanup } from "@/lib/shiftCleanup";
import { createTemporaryPassword } from "@/lib/temporary-password";
import { SUPER_ADMIN_OVERVIEW_CACHE_TAG } from "@/lib/super-admin-overview";
import { parseFeatureFlags } from "@/lib/features";

type PlanTypeValue = "FREE" | "TRIAL" | "PAID" | "LIFETIME";
type BillingIntervalValue = "MONTHLY" | "YEARLY";
type BillingStatusValue =
  | "ACTIVE"
  | "TRIALING"
  | "PAST_DUE"
  | "CANCELED"
  | "UNPAID"
  | "INACTIVE";

type NotificationUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
};

type BarNotificationContext = {
  barName: string;
  owner: NotificationUser;
  users: NotificationUser[];
};

function getFullName(user: { firstName: string; lastName: string }) {
  return `${user.firstName} ${user.lastName}`.trim();
}

function getLeaveTypeLabel(type: RequestType) {
  if (type === RequestType.OVERTIME) {
    return "straordinario";
  }

  if (type === RequestType.PERMISSION) {
    return "permesso";
  }

  if (type === RequestType.SICKNESS) {
    return "malattia";
  }

  return "ferie";
}

function formatRangeLabel(startsAt: Date, endsAt: Date) {
  const formatter = new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `${formatter.format(startsAt)} - ${formatter.format(endsAt)}`;
}

function dedupeUsers(users: Array<NotificationUser | null | undefined>) {
  const byId = new Map<string, NotificationUser>();

  for (const user of users) {
    if (!user) {
      continue;
    }

    byId.set(user.id, user);
  }

  return Array.from(byId.values());
}

function excludeActorFromUsers<T extends { id: string }>(users: T[], actorId: string) {
  return users.filter((user) => user.id !== actorId);
}

async function runEmailNotification(task: () => Promise<void>) {
  try {
    await task();
  } catch (error) {
    console.error("[email] Failed to process notification flow.", error);
  }
}

async function getBarNotificationContext(
  barId: string
): Promise<BarNotificationContext | null> {
  const bar = await prisma.bar.findUnique({
    where: { id: barId },
    select: {
      name: true,
      owner: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      memberships: {
        where: {
          isActive: true,
        },
        select: {
          role: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  if (!bar) {
    return null;
  }

  const owner: NotificationUser = {
    id: bar.owner.id,
    email: bar.owner.email,
    firstName: bar.owner.firstName,
    lastName: bar.owner.lastName,
    role: Role.OWNER,
  };

  const users = dedupeUsers([
    owner,
    ...bar.memberships.map((membership) => ({
      id: membership.user.id,
      email: membership.user.email,
      firstName: membership.user.firstName,
      lastName: membership.user.lastName,
      role: membership.role,
    })),
  ]);

  return {
    barName: bar.name,
    owner,
    users,
  };
}

function parseRequiredDate(value: FormDataEntryValue | null): Date {
  return parseDateTimeLocal(String(value ?? ""));
}

function parseOptionalNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalTime(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    return null;
  }

  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(normalized) ? normalized : null;
}

function parseShiftPresetPair(
  startValue: FormDataEntryValue | null,
  endValue: FormDataEntryValue | null
) {
  const startTime = parseOptionalTime(startValue);
  const endTime = parseOptionalTime(endValue);

  if (!startTime || !endTime) {
    return { startTime: null, endTime: null };
  }

  return { startTime, endTime };
}

function parseRole(value: FormDataEntryValue | null): Role {
  const raw = String(value ?? "");

  if (raw === Role.OWNER || raw === Role.MANAGER || raw === Role.EMPLOYEE) {
    return raw;
  }

  return Role.EMPLOYEE;
}

function parseRequestStatus(value: FormDataEntryValue | null): RequestStatus {
  return String(value ?? "") === RequestStatus.REJECTED
    ? RequestStatus.REJECTED
    : RequestStatus.APPROVED;
}

function parseCalendarClosureType(value: FormDataEntryValue | null): CalendarClosureType {
  const raw = String(value ?? "");

  if (
    raw === CalendarClosureType.HOLIDAY ||
    raw === CalendarClosureType.VACATION
  ) {
    return raw;
  }

  return CalendarClosureType.CLOSURE;
}

function normalizeIds(entries: FormDataEntryValue[]): string[] {
  return Array.from(
    new Set(
      entries
        .map((entry) => String(entry).trim())
        .filter((entry) => entry.length > 0)
    )
  );
}

function shouldAutoConfirmOwnShift(actorUserId: string, employeeIds: string[]) {
  return employeeIds.length === 1 && employeeIds[0] === actorUserId;
}

function getShiftConflictLabel(type: "AVAILABILITY" | RequestType) {
  if (type === "AVAILABILITY") {
    return "indisponibilita";
  }

  if (type === RequestType.OVERTIME) {
    return "straordinario";
  }

  if (type === RequestType.PERMISSION) {
    return "permesso";
  }

  if (type === RequestType.SICKNESS) {
    return "malattia";
  }

  return "ferie";
}

async function assertNoShiftAssignmentConflicts(input: {
  barId: string;
  employeeIds: string[];
  startTime: Date;
  endTime: Date;
}) {
  const [availabilityConflicts, requestConflicts] = await Promise.all([
    prisma.availability.findMany({
      where: {
        barId: input.barId,
        userId: {
          in: input.employeeIds,
        },
        startsAt: {
          lt: input.endTime,
        },
        endsAt: {
          gt: input.startTime,
        },
      },
      select: {
        userId: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    prisma.request.findMany({
      where: {
        barId: input.barId,
        employeeId: {
          in: input.employeeIds,
        },
        status: RequestStatus.APPROVED,
        type: {
          in: [RequestType.VACATION, RequestType.PERMISSION, RequestType.SICKNESS],
        },
        startsAt: {
          not: null,
          lt: input.endTime,
        },
        endsAt: {
          not: null,
          gt: input.startTime,
        },
      },
      select: {
        employeeId: true,
        type: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
  ]);

  const conflicts = new Map<string, { name: string; reasons: Set<string> }>();

  for (const availability of availabilityConflicts) {
    conflicts.set(availability.userId, {
      name: `${availability.user.firstName} ${availability.user.lastName}`.trim(),
      reasons:
        conflicts.get(availability.userId)?.reasons ?? new Set<string>([getShiftConflictLabel("AVAILABILITY")]),
    });
    conflicts.get(availability.userId)?.reasons.add(getShiftConflictLabel("AVAILABILITY"));
  }

  for (const request of requestConflicts) {
    conflicts.set(request.employeeId, {
      name: `${request.employee.firstName} ${request.employee.lastName}`.trim(),
      reasons:
        conflicts.get(request.employeeId)?.reasons ?? new Set<string>([getShiftConflictLabel(request.type)]),
    });
    conflicts.get(request.employeeId)?.reasons.add(getShiftConflictLabel(request.type));
  }

  if (conflicts.size === 0) {
    return;
  }

  const details = Array.from(conflicts.values()).map(
    (entry) => `${entry.name} (${Array.from(entry.reasons).join(", ")})`
  );

  throw new Error(`Non puoi assegnare questo turno a: ${details.join("; ")}`);
}

function splitBulkTextEntries(value: string) {
  return value
    .split(/\r?\n+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function collectBulkTextEntries(formData: FormData, fieldName: string) {
  return formData
    .getAll(fieldName)
    .flatMap((entry) => splitBulkTextEntries(String(entry ?? "")));
}

type ParsedTaskDraft = {
  title: string;
  assignedToAll: boolean;
  assignedToId: string;
  isUrgent: boolean;
};

function parseTaskDrafts(formData: FormData): ParsedTaskDraft[] {
  const entryIds = formData
    .getAll("taskEntryId")
    .map((entry) => String(entry).trim())
    .filter(Boolean);

  if (entryIds.length === 0) {
    const assignedToId = String(formData.get("assignedToId") ?? "").trim();
    const assignedToAll = formData.get("assignedToAll") === "on";
    const isUrgent = formData.get("isUrgent") === "on";

    return collectBulkTextEntries(formData, "title").map((title) => ({
      title,
      assignedToAll,
      assignedToId,
      isUrgent,
    }));
  }

  return entryIds
    .map((entryId) => {
      const title = String(formData.get(`title_${entryId}`) ?? "").trim();
      const assignedToAll = formData.get(`assignedToAll_${entryId}`) === "on";
      const assignedToId = String(formData.get(`assignedToId_${entryId}`) ?? "").trim();
      const isUrgent = formData.get(`isUrgent_${entryId}`) === "on";

      return {
        title,
        assignedToAll,
        assignedToId,
        isUrgent,
      };
    })
    .filter((entry) => entry.title.length > 0);
}

type ParsedBoardDraft = {
  content: string;
  isPinned: boolean;
  assignedToAll: boolean;
  assignedToId: string;
};

function parseBoardDrafts(formData: FormData, canPin: boolean): ParsedBoardDraft[] {
  const entryIds = formData
    .getAll("boardEntryId")
    .map((entry) => String(entry).trim())
    .filter(Boolean);

  if (entryIds.length === 0) {
    const assignedToAll = formData.get("assignedToAll") === "on";
    const assignedToId = String(formData.get("assignedToId") ?? "").trim();
    const isPinned = canPin && formData.get("isPinned") === "on";

    return collectBulkTextEntries(formData, "content").map((content) => ({
      content,
      isPinned,
      assignedToAll,
      assignedToId,
    }));
  }

  return entryIds
    .map((entryId) => ({
      content: String(formData.get(`content_${entryId}`) ?? "").trim(),
      isPinned: canPin && formData.get(`isPinned_${entryId}`) === "on",
      assignedToAll: formData.get(`assignedToAll_${entryId}`) === "on",
      assignedToId: String(formData.get(`assignedToId_${entryId}`) ?? "").trim(),
    }))
    .filter((entry) => entry.content.length > 0);
}

function ensureOperationRole(role: Role) {
  if (!canManageOperations(role)) {
    throw new Error("Unauthorized");
  }
}

function ensureOwnerRole(role: Role) {
  if (!canManagePeople(role)) {
    throw new Error("Unauthorized");
  }
}

function ensureSuperAdminRole(role: Role | string) {
  if (String(role) !== "SUPER_ADMIN") {
    throw new Error("Unauthorized");
  }
}

async function ensureCompanyShiftsEnabled(
  activeBarId: string,
  activityType: ActivityType | null
) {
  if (activityType !== ActivityType.COMPANY) {
    return;
  }

  const settings = await prisma.barSettings.findUnique({
    where: { barId: activeBarId },
    select: {
      companyShiftsEnabled: true,
    },
  });

  if (!settings?.companyShiftsEnabled) {
    throw new Error("Shifts not enabled");
  }
}

async function getRequestFeatureSettings(activeBarId: string) {
  return prisma.barSettings.findUnique({
    where: { barId: activeBarId },
    select: {
      requestsEnabled: true,
      availabilityEnabled: true,
      overtimeEnabled: true,
    },
  });
}

async function getDocumentFeatureSettings(activeBarId: string) {
  return prisma.barSettings.findUnique({
    where: { barId: activeBarId },
    select: {
      documentsEnabled: true,
    },
  });
}

async function getActionContext() {
  const session = await getSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  const { activeBar, role } = await getActiveBarAccess(session);

  if (activeBar?.id && String(role) !== "SUPER_ADMIN") {
    const hasBillingAccess = await canAccessBillingBar(activeBar.id);

    if (!hasBillingAccess) {
      throw new Error("Subscription required");
    }
  }

  return {
    session,
    role,
    activeBarId: activeBar?.id ?? null,
    activeBarActivityType: activeBar?.activityType ?? null,
  };
}

async function getSuperAdminContext() {
  const session = await getSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  ensureSuperAdminRole(session.user.role);

  return { session };
}

function parseLanguage(value: FormDataEntryValue | null): AppLanguage {
  const raw = String(value ?? "");

  if (
    raw === AppLanguage.it ||
    raw === AppLanguage.en ||
    raw === AppLanguage.es ||
    raw === AppLanguage.fr
  ) {
    return raw;
  }

  return AppLanguage.it;
}

function parseActivityType(value: FormDataEntryValue | null): ActivityType {
  return String(value ?? "") === ActivityType.COMPANY
    ? ActivityType.COMPANY
    : ActivityType.RESTAURANT;
}

async function getReturnPathFromReferer(fallbackPath = "/dashboard") {
  const headerStore = await headers();
  const referer = headerStore.get("referer");

  if (!referer) {
    return fallbackPath;
  }

  try {
    const url = new URL(referer);
    const pathname = url.pathname.startsWith("/") ? url.pathname : fallbackPath;
    const search = url.search ?? "";
    return `${pathname}${search}`;
  } catch {
    return fallbackPath;
  }
}

function appendStatusToPath(
  path: string,
  status: {
    error?: string;
    success?: string;
  }
) {
  const [pathname, existingSearch = ""] = path.split("?");
  const params = new URLSearchParams(existingSearch);

  params.delete("error");
  params.delete("success");

  if (status.error) {
    params.set("error", status.error);
  }

  if (status.success) {
    params.set("success", status.success);
  }

  const nextSearch = params.toString();
  return nextSearch ? `${pathname}?${nextSearch}` : pathname;
}

function parsePlanType(value: FormDataEntryValue | null): PlanTypeValue {
  const raw = String(value ?? "");

  if (raw === "FREE" || raw === "TRIAL" || raw === "PAID" || raw === "LIFETIME") {
    return raw;
  }

  return "PAID";
}

function parseBillingInterval(
  value: FormDataEntryValue | null
): BillingIntervalValue | null {
  const raw = String(value ?? "");

  if (raw === "MONTHLY" || raw === "YEARLY") {
    return raw;
  }

  return null;
}

function parseBillingStatus(value: FormDataEntryValue | null): BillingStatusValue {
  const raw = String(value ?? "");

  if (
    raw === "ACTIVE" ||
    raw === "TRIALING" ||
    raw === "PAST_DUE" ||
    raw === "CANCELED" ||
    raw === "UNPAID" ||
    raw === "INACTIVE"
  ) {
    return raw;
  }

  return "INACTIVE";
}

function normalizeMonthlyDiscountPercent(value: FormDataEntryValue | null) {
  const parsed = parseOptionalNumber(value);

  if (parsed === null) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function wantsSuccessRedirect(formData: FormData) {
  return String(formData.get("notifySuccess") ?? "") === "1";
}

async function syncStripeMonthlyDiscount(input: {
  barId: string;
  stripeSubscriptionId: string | null;
  planType: PlanType;
  billingInterval: BillingInterval | null;
  monthlyDiscountPercent: number;
}) {
  if (!input.stripeSubscriptionId) {
    return;
  }

  const stripe = requireStripe();

  if (
    input.planType === PlanType.PAID &&
    input.billingInterval === BillingInterval.MONTHLY &&
    input.monthlyDiscountPercent > 0
  ) {
    const coupon = await stripe.coupons.create({
      percent_off: input.monthlyDiscountPercent,
      duration: "forever",
      name: `Workbit sconto mensile ${input.monthlyDiscountPercent}%`,
      metadata: {
        barId: input.barId,
        kind: "MONTHLY_DISCOUNT",
      },
    });

    await stripe.subscriptions.update(input.stripeSubscriptionId, {
      discounts: [
        {
          coupon: coupon.id,
        },
      ],
    });

    await prisma.subscription.update({
      where: {
        barId: input.barId,
      },
      data: {
        stripeDiscountCouponId: coupon.id,
      },
    });

    return;
  }

  await stripe.subscriptions.update(input.stripeSubscriptionId, {
    discounts: [] as Stripe.SubscriptionUpdateParams.Discount[],
  });

  await prisma.subscription.update({
    where: {
      barId: input.barId,
    },
    data: {
      stripeDiscountCouponId: null,
    },
  });
}

async function ensureUsersBelongToBar(barId: string, userIds: string[]) {
  if (userIds.length === 0) {
    return;
  }

  const memberships = await prisma.employeeBar.findMany({
    where: {
      barId,
      userId: {
        in: userIds,
      },
      isActive: true,
    },
    select: {
      userId: true,
    },
  });

  const found = new Set(memberships.map((membership) => membership.userId));

  for (const userId of userIds) {
    if (!found.has(userId)) {
      throw new Error("User not linked to active bar");
    }
  }
}

async function applyShiftChangeIfApproved(requestId: string) {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      shift: {
        include: {
          assignments: true,
        },
      },
    },
  });

  if (
    !request ||
    request.type !== RequestType.SHIFT_CHANGE ||
    request.status !== RequestStatus.APPROVED ||
    request.appliedAt ||
    !request.shift ||
    !request.swapWithUserId
  ) {
    return;
  }

  const currentAssignmentIds = request.shift.assignments.map((assignment) => assignment.userId);

  if (!currentAssignmentIds.includes(request.employeeId)) {
    await prisma.request.update({
      where: { id: request.id },
      data: {
        appliedAt: new Date(),
      },
    });
    return;
  }

  const nextAssignmentIds = Array.from(
    new Set(
      currentAssignmentIds
        .filter((userId) => userId !== request.employeeId)
        .concat(request.swapWithUserId)
    )
  );

  await prisma.$transaction([
    prisma.shift.update({
      where: { id: request.shift.id },
      data: {
        assignedToId: nextAssignmentIds[0] ?? request.swapWithUserId,
        assignments: {
          deleteMany: {},
          createMany: {
            data: nextAssignmentIds.map((userId) => ({ userId })),
          },
        },
      },
    }),
    prisma.request.update({
      where: { id: request.id },
      data: {
        appliedAt: new Date(),
      },
    }),
  ]);
}

export async function selectBarAction(formData: FormData) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const barId = String(formData.get("barId") ?? "").trim();

  if (!barId || !(await userCanAccessBar(session.user.id, barId))) {
    throw new Error("Unauthorized bar");
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { activeBarId: barId },
  });

  const [accessibleBars, needsSubscriptionActivation] = await Promise.all([
    getAccessibleBarsForUser(session.user.id, session.user.role),
    barNeedsSubscriptionActivation(barId),
  ]);
  const selectedBar = accessibleBars.find((bar) => bar.id === barId);

  if (selectedBar?.role === Role.OWNER && needsSubscriptionActivation) {
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    redirect("/dashboard/settings");
  }

  const returnPath = await getReturnPathFromReferer("/dashboard");

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  redirect(returnPath);
}

export async function logoutAction() {
  const session = await getSession();

  if (session) {
    await prisma.session.updateMany({
      where: {
        userId: session.user.id,
        token: session.token,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(SESSION_PERSIST_COOKIE_NAME);
  redirect("/login");
}

export async function setLanguageAction(formData: FormData) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const language = parseLanguage(formData.get("language"));

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      language,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(LANGUAGE_COOKIE_NAME, language, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  const returnPath = await getReturnPathFromReferer("/dashboard");

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/onboarding");
  redirect(returnPath);
}

export async function createOwnerBySuperAdminAction(formData: FormData) {
  await getSuperAdminContext();

  const returnPath = await getReturnPathFromReferer("/dashboard/super-admin");

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const language = parseLanguage(formData.get("language"));

  if (!firstName || !lastName || !email) {
    throw new Error("Missing owner data");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    redirect(appendStatusToPath(returnPath, { error: "owner-exists" }));
  }

  const temporaryPassword = createTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      passwordHash,
      role: Role.OWNER,
      language,
      mustChangePwd: true,
    },
  });

  let welcomeEmailSent = false;

  try {
    const emailResult = await sendOwnerWelcomeEmail(
      email,
      `${firstName} ${lastName}`.trim(),
      null,
      email,
      temporaryPassword
    );

    welcomeEmailSent = emailResult.ok;
  } catch (error) {
    console.error("[welcome-email] owner failed", {
      recipient: email,
      error:
        error instanceof Error
          ? error.message
          : "Unexpected owner welcome email error.",
    });
  }

  revalidatePath("/dashboard/super-admin");
  revalidatePath("/dashboard/super-admin/owners");
  revalidatePath("/dashboard/super-admin/bars");
  revalidatePath("/dashboard/super-admin/billing");
  revalidateTag(SUPER_ADMIN_OVERVIEW_CACHE_TAG, "max");
  redirect(
    appendStatusToPath(returnPath, {
      success: welcomeEmailSent ? "owner-created" : "owner-created-email-failed",
    })
  );
}

export async function createBarBySuperAdminAction(formData: FormData) {
  await getSuperAdminContext();
  const returnPath = await getReturnPathFromReferer("/dashboard/super-admin/bars");

  const ownerId = String(formData.get("ownerId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const addressLine1 = String(formData.get("addressLine1") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const postalCode = String(formData.get("postalCode") ?? "").trim();
  const activityType = parseActivityType(formData.get("activityType"));

  if (!ownerId || !name) {
    throw new Error("Missing bar data");
  }

  const owner = await prisma.user.findFirst({
    where: {
      id: ownerId,
      role: Role.OWNER,
    },
    select: {
      id: true,
      email: true,
    },
  });

  if (!owner) {
    throw new Error("Owner not found");
  }

  const globalGpsRadius = await getGlobalGpsRadius();

  const bar = await prisma.bar.create({
    data: {
      name,
      email: email || null,
      phone: phone || null,
      addressLine1: addressLine1 || null,
      city: city || null,
      postalCode: postalCode || null,
      latitude: 0,
      longitude: 0,
      radiusMeters: globalGpsRadius,
      activityType,
      ownerId,
    },
  });

  await prisma.employeeBar.upsert({
    where: {
      userId_barId: {
        userId: ownerId,
        barId: bar.id,
      },
    },
    update: {
      role: Role.OWNER,
      isActive: true,
      endedAt: null,
    },
    create: {
      userId: ownerId,
      barId: bar.id,
      role: Role.OWNER,
      isActive: true,
    },
  });

  await prisma.barSettings.create({
    data: {
      barId: bar.id,
      gpsLatitude: null,
      gpsLongitude: null,
      gpsRadius: globalGpsRadius,
      roundingEnabled: false,
    },
  });

  await prisma.subscription.create({
    data: {
      barId: bar.id,
      planType: PlanType.TRIAL,
      status: SubscriptionStatus.TRIALING,
      trialEndsAt: createDefaultTrialEndsAt(),
    },
  });

  invalidateBillingStatusCache(bar.id);

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/super-admin");
  revalidatePath("/dashboard/super-admin/bars");
  revalidatePath("/dashboard/super-admin/billing");
  revalidateTag(SUPER_ADMIN_OVERVIEW_CACHE_TAG, "max");
  redirect(appendStatusToPath(returnPath, { success: "bar-created" }));
}

export async function updateBarSubscriptionAction(formData: FormData) {
  await getSuperAdminContext();

  const barId = String(formData.get("barId") ?? "").trim();
  const ownerId = String(formData.get("ownerId") ?? "").trim();
  const planType = parsePlanType(formData.get("planType"));
  const billingInterval = parseBillingInterval(formData.get("billingInterval"));
  const monthlyDiscountPercent = normalizeMonthlyDiscountPercent(
    formData.get("monthlyDiscountPercent")
  );
  const status = parseBillingStatus(formData.get("status"));
  const currentPeriodEndRaw = String(formData.get("currentPeriodEnd") ?? "").trim();
  const trialEndsAtRaw = String(formData.get("trialEndsAt") ?? "").trim();

  if (!barId || !ownerId) {
    throw new Error("Missing billing data");
  }

  const owner = await prisma.user.findFirst({
    where: {
      id: ownerId,
      role: Role.OWNER,
    },
    select: { id: true },
  });

  if (!owner) {
    throw new Error("Owner not found");
  }

  const currentPeriodEnd = currentPeriodEndRaw
    ? parseRequiredDate(currentPeriodEndRaw)
    : null;
  const trialEndsAt = trialEndsAtRaw ? parseRequiredDate(trialEndsAtRaw) : null;

  const [currentSubscription, bar] = await Promise.all([
    prisma.subscription.findUnique({
      where: { barId },
      select: {
        stripeSubscriptionId: true,
      },
    }),
    prisma.bar.update({
      where: { id: barId },
      data: {
        ownerId,
      },
    }),
  ]);

  await prisma.employeeBar.upsert({
    where: {
      userId_barId: {
        userId: ownerId,
        barId: bar.id,
      },
    },
    update: {
      role: Role.OWNER,
      isActive: true,
      endedAt: null,
    },
    create: {
      userId: ownerId,
      barId: bar.id,
      role: Role.OWNER,
      isActive: true,
    },
  });

  await prisma.subscription.upsert({
    where: { barId },
    update: {
      planType,
      billingInterval,
      monthlyDiscountPercent,
      status:
        planType === PlanType.FREE || planType === PlanType.LIFETIME
          ? SubscriptionStatus.ACTIVE
          : planType === PlanType.TRIAL
            ? SubscriptionStatus.TRIALING
            : status,
      currentPeriodEnd: planType === PlanType.PAID ? currentPeriodEnd : null,
      trialEndsAt: planType === PlanType.TRIAL ? trialEndsAt : null,
    },
    create: {
      barId,
      planType,
      billingInterval,
      monthlyDiscountPercent,
      status:
        planType === PlanType.FREE || planType === PlanType.LIFETIME
          ? SubscriptionStatus.ACTIVE
          : planType === PlanType.TRIAL
            ? SubscriptionStatus.TRIALING
            : status,
      currentPeriodEnd: planType === PlanType.PAID ? currentPeriodEnd : null,
      trialEndsAt: planType === PlanType.TRIAL ? trialEndsAt : null,
    },
  });

  try {
    await syncStripeMonthlyDiscount({
      barId,
      stripeSubscriptionId: currentSubscription?.stripeSubscriptionId ?? null,
      planType: planType as PlanType,
      billingInterval: billingInterval as BillingInterval | null,
      monthlyDiscountPercent,
    });
  } catch (error) {
    console.error("[billing-discount] Failed to sync Stripe monthly discount.", {
      barId,
      error: error instanceof Error ? error.message : "Unexpected sync error.",
    });
  }

  invalidateBillingStatusCache(barId);

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/super-admin");
  revalidatePath("/dashboard/super-admin/billing");
  revalidateTag(SUPER_ADMIN_OVERVIEW_CACHE_TAG, "max");
}

export async function deleteBarBySuperAdminAction(formData: FormData) {
  await getSuperAdminContext();

  const barId = String(formData.get("barId") ?? "").trim();

  if (!barId) {
    throw new Error("Missing bar data");
  }

  const bar = await prisma.bar.findUnique({
    where: { id: barId },
    select: {
      id: true,
      ownerId: true,
      memberships: {
        select: {
          userId: true,
        },
      },
      subscription: {
        select: {
          stripeSubscriptionId: true,
        },
      },
    },
  });

  if (!bar) {
    throw new Error("Bar not found");
  }

  if (bar.subscription?.stripeSubscriptionId) {
    try {
      await cancelStripeSubscriptionSafely(bar.subscription.stripeSubscriptionId);
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Unable to cancel Stripe subscription"
      );
    }
  }

  const userIdsToCheck = Array.from(
    new Set([bar.ownerId, ...bar.memberships.map((membership) => membership.userId)])
  );

  await prisma.$transaction(async (tx) => {
    await tx.bar.delete({
      where: { id: bar.id },
    });

    const remainingUsers = await tx.user.findMany({
      where: {
        id: {
          in: userIdsToCheck,
        },
      },
      select: {
        id: true,
        _count: {
          select: {
            ownedBars: true,
            barMemberships: true,
          },
        },
      },
    });

    const usersToDelete = remainingUsers
      .filter(
        (user) =>
          user._count.ownedBars === 0 && user._count.barMemberships === 0
      )
      .map((user) => user.id);

    if (usersToDelete.length > 0) {
      await tx.user.deleteMany({
        where: {
          id: {
            in: usersToDelete,
          },
        },
      });
    }
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/super-admin");
  revalidatePath("/dashboard/super-admin/owners");
  revalidatePath("/dashboard/super-admin/billing");
  revalidatePath("/dashboard/super-admin/bars");
  revalidateTag(SUPER_ADMIN_OVERVIEW_CACHE_TAG, "max");
}

export async function confirmVisibleShiftsAction(formData: FormData) {
  const { session, role, activeBarId } = await getActionContext();
  ensureOperationRole(role);

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  const rangeStart = parseRequiredDate(formData.get("rangeStart"));
  const rangeEnd = parseRequiredDate(formData.get("rangeEnd"));

  if (rangeEnd < rangeStart) {
    throw new Error("Invalid range");
  }

  await prisma.shift.updateMany({
    where: {
      barId: activeBarId,
      confirmedAt: null,
      isOnCall: false,
      startTime: {
        gte: rangeStart,
        lte: rangeEnd,
      },
    },
    data: {
      confirmedAt: new Date(),
      confirmedById: session.user.id,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/shifts");
}

export async function createTaskAction(formData: FormData) {
  const { session, role, activeBarId } = await getActionContext();
  ensureOperationRole(role);

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  const description = String(formData.get("description") ?? "").trim();
  const dueDate = parseTaskDueDate(String(formData.get("dueDate") ?? ""));
  const taskDrafts = parseTaskDrafts(formData);

  if (taskDrafts.length === 0) {
    throw new Error("Missing title");
  }

  if (!dueDate) {
    throw new Error("Invalid due date");
  }

  const assignedUserIds = normalizeIds(
    taskDrafts
      .filter((draft) => !draft.assignedToAll && draft.assignedToId)
      .map((draft) => draft.assignedToId)
  );

  if (assignedUserIds.length > 0) {
    await ensureUsersBelongToBar(activeBarId, assignedUserIds);
  }

  await prisma.task.createMany({
    data: taskDrafts.map((taskDraft) => ({
      title: taskDraft.title,
      description: description || null,
      dueDate,
      assignedToAll: taskDraft.assignedToAll,
      assignedToId: taskDraft.assignedToAll ? null : taskDraft.assignedToId || null,
      barId: activeBarId,
      createdById: session.user.id,
      status: TaskStatus.TODO,
      isUrgent: taskDraft.isUrgent,
    })),
  });

  await runEmailNotification(async () => {
    const notificationContext = await getBarNotificationContext(activeBarId);

    if (!notificationContext) {
      return;
    }

    const tasksByRecipientId = new Map<string, string[]>();

    for (const taskDraft of taskDrafts) {
      const recipients = taskDraft.assignedToAll
        ? notificationContext.users.filter((user) => user.role !== Role.OWNER)
        : notificationContext.users.filter((user) => user.id === taskDraft.assignedToId);

      for (const recipient of excludeActorFromUsers(recipients, session.user.id)) {
        const current = tasksByRecipientId.get(recipient.id) ?? [];
        current.push(taskDraft.title);
        tasksByRecipientId.set(recipient.id, current);
      }
    }

    await Promise.all(
      Array.from(tasksByRecipientId.entries()).map(([recipientId, taskTitles]) => {
        const recipient = notificationContext.users.find((user) => user.id === recipientId);

        if (!recipient) {
          return Promise.resolve();
        }

        return taskTitles.length === 1
          ? sendTaskAssignedEmail(
              recipient.email,
              recipient.firstName,
              taskTitles[0],
              notificationContext.barName
            )
          : sendTaskAssignedDigestEmail(
              recipient.email,
              recipient.firstName,
              taskTitles,
              notificationContext.barName
            );
      })
    );
  });

  if (wantsSuccessRedirect(formData)) {
    const returnPath = await getReturnPathFromReferer("/dashboard/tasks");

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/tasks");
    redirect(appendStatusToPath(returnPath, { success: "task-created" }));
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/tasks");
}

export async function completeTaskAction(formData: FormData) {
  const { session, role, activeBarId } = await getActionContext();

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  const taskId = String(formData.get("taskId") ?? "").trim();

  if (!taskId) {
    throw new Error("Missing task id");
  }

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      barId: activeBarId,
    },
    select: {
      id: true,
      assignedToId: true,
      assignedToAll: true,
    },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  if (
    role === Role.EMPLOYEE &&
    !task.assignedToAll &&
    task.assignedToId !== session.user.id
  ) {
    throw new Error("Unauthorized");
  }

  await prisma.$transaction([
    prisma.taskCompletion.upsert({
      where: {
        taskId_userId: {
          taskId,
          userId: session.user.id,
        },
      },
      update: {
        completedAt: new Date(),
      },
      create: {
        taskId,
        userId: session.user.id,
      },
    }),
    prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.DONE,
        completedAt: new Date(),
        completedById: session.user.id,
      },
    }),
  ]);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/tasks");
}

export async function deleteCompletedTaskAction(formData: FormData) {
  const { role, activeBarId } = await getActionContext();
  ensureOperationRole(role);

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  const taskId = String(formData.get("taskId") ?? "").trim();

  if (!taskId) {
    throw new Error("Missing task id");
  }

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      barId: activeBarId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  if (task.status !== TaskStatus.DONE) {
    throw new Error("Only completed tasks can be deleted");
  }

  await prisma.task.delete({
    where: {
      id: task.id,
    },
  });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/tasks");
  }

export async function deleteAllCompletedTasksAction() {
  const { role, activeBarId } = await getActionContext();
  ensureOperationRole(role);

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  await prisma.task.deleteMany({
    where: {
      barId: activeBarId,
      status: TaskStatus.DONE,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/tasks");
}

export async function createShiftAction(formData: FormData) {
  const { session, role, activeBarId, activeBarActivityType } = await getActionContext();
  ensureOperationRole(role);

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  await ensureCompanyShiftsEnabled(activeBarId, activeBarActivityType);

  const title = String(formData.get("title") ?? "").trim();
  const startTime = parseRequiredDate(formData.get("startTime"));
  const endTime = parseRequiredDate(formData.get("endTime"));
  const employeeIds = normalizeIds(formData.getAll("employeeIds"));
  const isOnCall = formData.get("isOnCall") === "on";

  if (employeeIds.length === 0) {
    throw new Error("Select at least one employee");
  }

  if (endTime <= startTime) {
    throw new Error("Invalid shift range");
  }

  await ensureUsersBelongToBar(activeBarId, employeeIds);
  await assertNoShiftAssignmentConflicts({
    barId: activeBarId,
    employeeIds,
    startTime,
    endTime,
  });
  const autoConfirm = shouldAutoConfirmOwnShift(session.user.id, employeeIds);

  await prisma.shift.create({
    data: {
      title: title || null,
      startTime,
      endTime,
      isOnCall,
      confirmedAt: autoConfirm && !isOnCall ? new Date() : null,
      confirmedById: autoConfirm && !isOnCall ? session.user.id : null,
      assignedToId: employeeIds[0],
      barId: activeBarId,
      createdById: session.user.id,
      assignments: {
        createMany: {
          data: employeeIds.map((userId) => ({ userId })),
        },
      },
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/shifts");
}

export async function updateShiftAction(formData: FormData) {
  const { session, role, activeBarId, activeBarActivityType } = await getActionContext();
  ensureOperationRole(role);

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  await ensureCompanyShiftsEnabled(activeBarId, activeBarActivityType);

  const shiftId = String(formData.get("shiftId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const startTime = parseRequiredDate(formData.get("startTime"));
  const endTime = parseRequiredDate(formData.get("endTime"));
  const employeeIds = normalizeIds(formData.getAll("employeeIds"));
  const isOnCall = formData.get("isOnCall") === "on";

  if (!shiftId || employeeIds.length === 0) {
    throw new Error("Missing shift data");
  }

  if (endTime <= startTime) {
    throw new Error("Invalid shift range");
  }

  await ensureUsersBelongToBar(activeBarId, employeeIds);
  await assertNoShiftAssignmentConflicts({
    barId: activeBarId,
    employeeIds,
    startTime,
    endTime,
  });
  const autoConfirm = shouldAutoConfirmOwnShift(session.user.id, employeeIds);

  await prisma.shift.update({
    where: {
      id: shiftId,
    },
    data: {
      title: title || null,
      assignedToId: employeeIds[0],
      startTime,
      endTime,
      isOnCall,
      confirmedAt: autoConfirm && !isOnCall ? new Date() : null,
      confirmedById: autoConfirm && !isOnCall ? session.user.id : null,
      assignments: {
        deleteMany: {},
        createMany: {
          data: employeeIds.map((userId) => ({ userId })),
        },
      },
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/shifts");
}

export async function confirmShiftAction(formData: FormData) {
  const { session, role, activeBarId } = await getActionContext();

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  const shiftId = String(formData.get("shiftId") ?? "").trim();

  if (!shiftId) {
    throw new Error("Missing shift id");
  }

  const shift = await prisma.shift.findFirst({
    where: {
      id: shiftId,
      barId: activeBarId,
    },
    select: {
      id: true,
      isOnCall: true,
      confirmedAt: true,
      assignments: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!shift) {
    throw new Error("Shift not found");
  }

  if (!shift.isOnCall) {
    throw new Error("Reperibilita non richiesta per questo turno");
  }

  if (shift.confirmedAt) {
    return;
  }

  const isAssigned = shift.assignments.some((assignment) => assignment.userId === session.user.id);

  if (!isAssigned) {
    throw new Error("Puoi approvare solo la reperibilita assegnata a te");
  }

  await prisma.shift.update({
    where: { id: shift.id },
    data: {
      confirmedAt: new Date(),
      confirmedById: session.user.id,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/shifts");
}

export async function deleteShiftAction(formData: FormData) {
  const { role, activeBarId, activeBarActivityType } = await getActionContext();
  ensureOperationRole(role);

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  await ensureCompanyShiftsEnabled(activeBarId, activeBarActivityType);

  const shiftId = String(formData.get("shiftId") ?? "").trim();

  if (!shiftId) {
    throw new Error("Missing shift id");
  }

  const result = await deleteShiftWithCleanup(shiftId, { barId: activeBarId });

  if (!result.deleted) {
    throw new Error("Shift not found");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/shifts");
  revalidatePath("/dashboard/requests");
}

export async function createBoardNoteAction(formData: FormData) {
  const { session, role, activeBarId } = await getActionContext();

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  const noteEntries = parseBoardDrafts(formData, canManageOperations(role));

  if (noteEntries.length === 0) {
    throw new Error("Missing content");
  }

  if (noteEntries.some((entry) => !entry.assignedToAll && !entry.assignedToId)) {
    throw new Error("Missing board recipient");
  }

  await ensureUsersBelongToBar(
    activeBarId,
    noteEntries
      .filter((entry) => !entry.assignedToAll && entry.assignedToId)
      .map((entry) => entry.assignedToId)
  );

  await prisma.note.createMany({
    data: noteEntries.map((entry) => ({
      barId: activeBarId,
      authorId: session.user.id,
      content: entry.content,
      isPinned: entry.isPinned,
      employeeId: entry.assignedToAll ? null : entry.assignedToId,
    })),
  });

  await runEmailNotification(async () => {
    const notificationContext = await getBarNotificationContext(activeBarId);

    if (!notificationContext) {
      return;
    }

    const authorName = getFullName(session.user);
    const recipientsByEmail = new Map<
      string,
      { email: string; firstName: string; count: number }
    >();

    for (const entry of noteEntries) {
      const recipients = entry.assignedToAll
        ? notificationContext.users.filter((user) => user.id !== session.user.id)
        : notificationContext.users.filter(
            (user) => user.id === entry.assignedToId && user.id !== session.user.id
          );

      for (const recipient of recipients) {
        const current = recipientsByEmail.get(recipient.email);

        if (current) {
          current.count += 1;
          continue;
        }

        recipientsByEmail.set(recipient.email, {
          email: recipient.email,
          firstName: recipient.firstName,
          count: 1,
        });
      }
    }

    await Promise.all(
      Array.from(recipientsByEmail.values()).map((recipient) =>
        recipient.count === 1
          ? sendNoticeBoardEmail(
              recipient.email,
              recipient.firstName,
              authorName,
              notificationContext.barName
            )
          : sendNoticeBoardDigestEmail(
              recipient.email,
              recipient.firstName,
              authorName,
              notificationContext.barName,
              recipient.count
            )
      )
    );
  });

  if (wantsSuccessRedirect(formData)) {
    const returnPath = await getReturnPathFromReferer("/dashboard/tasks");

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/tasks");
    redirect(appendStatusToPath(returnPath, { success: "board-created" }));
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/tasks");
}

export async function deleteAllBoardNotesAction() {
  const { role, activeBarId } = await getActionContext();
  ensureOperationRole(role);

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  await prisma.note.deleteMany({
    where: {
      barId: activeBarId,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/tasks");
}

export async function deleteBoardNoteAction(formData: FormData) {
  const { activeBarId } = await getActionContext();

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  const noteId = String(formData.get("noteId") ?? "").trim();

  if (!noteId) {
    throw new Error("Missing note id");
  }

  await prisma.note.deleteMany({
    where: {
      id: noteId,
      barId: activeBarId,
    },
  });

  if (wantsSuccessRedirect(formData)) {
    const returnPath = await getReturnPathFromReferer("/dashboard/tasks");

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/tasks");
    redirect(appendStatusToPath(returnPath, { success: "task-completed" }));
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/tasks");
}

export async function createAvailabilityAction(formData: FormData) {
  const { session, activeBarId, activeBarActivityType } = await getActionContext();

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  if (activeBarActivityType === ActivityType.COMPANY) {
    throw new Error("Availability not allowed");
  }

  const requestFeatures = await getRequestFeatureSettings(activeBarId);

  if (requestFeatures?.availabilityEnabled === false) {
    throw new Error("Availability not enabled");
  }

  const startsAt = parseRequiredDate(formData.get("startsAt"));
  const endsAt = parseRequiredDate(formData.get("endsAt"));
  const reason = String(formData.get("reason") ?? "").trim();

  if (endsAt <= startsAt) {
    throw new Error("Invalid date range");
  }

  await prisma.availability.create({
    data: {
      barId: activeBarId,
      userId: session.user.id,
      startsAt,
      endsAt,
      reason: reason || null,
    },
  });

  await runEmailNotification(async () => {
    const notificationContext = await getBarNotificationContext(activeBarId);

    if (!notificationContext) {
      return;
    }

    const recipients = excludeActorFromUsers(
      notificationContext.users.filter(
        (user) => user.role === Role.OWNER || user.role === Role.MANAGER
      ),
      session.user.id
    );

    if (recipients.length === 0) {
      return;
    }

    const employeeName = getFullName(session.user);
    const dateLabel = formatRangeLabel(startsAt, endsAt);

    await Promise.all(
      recipients.map((recipient) =>
        sendUnavailabilityEmail(
          recipient.email,
          employeeName,
          notificationContext.barName,
          dateLabel
        )
      )
    );
  });

  if (wantsSuccessRedirect(formData)) {
    const returnPath = await getReturnPathFromReferer("/dashboard/requests");

    revalidatePath("/dashboard/requests");
    revalidatePath("/dashboard/shifts");
    revalidatePath("/dashboard/calendar");
    redirect(appendStatusToPath(returnPath, { success: "availability-created" }));
  }

  revalidatePath("/dashboard/requests");
  revalidatePath("/dashboard/shifts");
  revalidatePath("/dashboard/calendar");
}

export async function createCalendarClosureAction(formData: FormData) {
  const { session, role, activeBarId } = await getActionContext();
  ensureOperationRole(role);

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  const requestFeatures = await getRequestFeatureSettings(activeBarId);

  if (requestFeatures?.requestsEnabled === false) {
    throw new Error("Requests not enabled");
  }

  const type = parseCalendarClosureType(formData.get("type"));
  const titleRaw = String(formData.get("title") ?? "").trim();
  const startsAt = parseRequiredDate(formData.get("startsAt"));
  const endsAt = parseRequiredDate(formData.get("endsAt"));

  if (endsAt <= startsAt) {
    throw new Error("Invalid date range");
  }

  const fallbackTitle =
    type === CalendarClosureType.HOLIDAY
      ? "Festivita"
      : type === CalendarClosureType.VACATION
        ? "Ferie aziendali"
        : "Chiusura";

  await prisma.calendarClosure.create({
    data: {
      barId: activeBarId,
      createdById: session.user.id,
      title: titleRaw || fallbackTitle,
      type,
      startsAt,
      endsAt,
    },
  });

  if (wantsSuccessRedirect(formData)) {
    const returnPath = await getReturnPathFromReferer("/dashboard/requests");

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/calendar");
    redirect(appendStatusToPath(returnPath, { success: "closure-created" }));
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
}

export async function createCourseAction(formData: FormData) {
  const { session, role, activeBarId } = await getActionContext();
  ensureOperationRole(role);

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const startsAt = parseRequiredDate(formData.get("startsAt"));
  const endsAt = parseRequiredDate(formData.get("endsAt"));
  const assignedToAll = formData.get("assignedToAll") === "on";
  const assignedToId = String(formData.get("assignedToId") ?? "").trim();

  if (!title) {
    throw new Error("Missing course title");
  }

  if (endsAt <= startsAt) {
    throw new Error("Invalid course range");
  }

  if (!assignedToAll && assignedToId) {
    await ensureUsersBelongToBar(activeBarId, [assignedToId]);
  }

  await prisma.course.create({
    data: {
      barId: activeBarId,
      title,
      description: description || null,
      startsAt,
      endsAt,
      location: location || null,
      assignedToAll,
      assignedToId: assignedToAll || !assignedToId ? null : assignedToId,
      createdById: session.user.id,
    },
  });

  if (wantsSuccessRedirect(formData)) {
    const returnPath = await getReturnPathFromReferer("/dashboard/courses");

    revalidatePath("/dashboard/courses");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/export");
    redirect(appendStatusToPath(returnPath, { success: "course-created" }));
  }

  revalidatePath("/dashboard/courses");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/export");
}

export async function deleteCourseAction(formData: FormData) {
  const { role, activeBarId } = await getActionContext();
  ensureOperationRole(role);

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  const courseId = String(formData.get("courseId") ?? "").trim();

  if (!courseId) {
    throw new Error("Missing course id");
  }

  await prisma.course.deleteMany({
    where: {
      id: courseId,
      barId: activeBarId,
    },
  });

  revalidatePath("/dashboard/courses");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/export");
}

export async function createDocumentAction(formData: FormData) {
  const { session, role, activeBarId } = await getActionContext();
  ensureOperationRole(role);

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  const featureSettings = await getDocumentFeatureSettings(activeBarId);

  if (featureSettings?.documentsEnabled === false) {
    throw new Error("Documents not enabled");
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const audience = String(formData.get("audience") ?? "ALL").trim().toUpperCase();
  const assignedToAll = audience !== "USER";
  const assignedToId = String(formData.get("assignedToId") ?? "").trim();
  const fileEntry = formData.get("file");

  if (!title) {
    throw new Error("Missing document title");
  }

  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    throw new Error("Missing document file");
  }

  if (fileEntry.size > 8 * 1024 * 1024) {
    throw new Error("File too large");
  }

  if (!assignedToAll && !assignedToId) {
    throw new Error("Missing document recipient");
  }

  if (!assignedToAll) {
    await ensureUsersBelongToBar(activeBarId, [assignedToId]);
  }

  const content = Buffer.from(await fileEntry.arrayBuffer());

  await prisma.document.create({
    data: {
      barId: activeBarId,
      title,
      description: description || null,
      fileName: fileEntry.name || title,
      mimeType: fileEntry.type || "application/octet-stream",
      fileSize: fileEntry.size,
      content,
      assignedToAll,
      assignedToId: assignedToAll ? null : assignedToId,
      createdById: session.user.id,
    },
  });

  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard");
}

export async function toggleDocumentActiveAction(formData: FormData) {
  const { session, role, activeBarId } = await getActionContext();
  ensureOperationRole(role);

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  const featureSettings = await getDocumentFeatureSettings(activeBarId);

  if (featureSettings?.documentsEnabled === false) {
    throw new Error("Documents not enabled");
  }

  const documentId = String(formData.get("documentId") ?? "").trim();
  const nextActive = String(formData.get("nextActive") ?? "").trim() === "1";

  if (!documentId) {
    throw new Error("Missing document id");
  }

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      barId: activeBarId,
    },
    select: {
      id: true,
      isActive: true,
    },
  });

  if (!document) {
    throw new Error("Document not found");
  }

  await prisma.document.update({
    where: { id: documentId },
    data: {
      isActive: nextActive,
      deactivatedAt: nextActive ? null : new Date(),
      deactivatedById: nextActive ? null : session.user.id,
    },
  });

  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard");
}

export async function createEmployeeAction(formData: FormData) {
  const { role, activeBarId } = await getActionContext();
  ensureOwnerRole(role);

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  const returnPath = await getReturnPathFromReferer("/dashboard/people");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const userRole = parseRole(formData.get("role"));
  const hourlyRate = parseOptionalNumber(formData.get("hourlyRate"));

  if (!email || !firstName || !lastName) {
    throw new Error("Missing employee fields");
  }

  const [bar, existingUser] = await Promise.all([
    prisma.bar.findUnique({
      where: { id: activeBarId },
      select: {
        name: true,
      },
    }),
    prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
      },
    }),
  ]);

  if (!bar) {
    throw new Error("Bar not found");
  }

  if (existingUser) {
    redirect(appendStatusToPath(returnPath, { error: "employee-exists" }));
  }

  const temporaryPassword = createTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        firstName,
        lastName,
        role: userRole,
        mustChangePwd: true,
        passwordHash,
      },
    });

    await tx.employeeBar.upsert({
      where: {
        userId_barId: {
          userId: user.id,
          barId: activeBarId,
        },
      },
      update: {
        role: userRole,
        isActive: true,
        endedAt: null,
        hourlyRate:
          hourlyRate === null ? undefined : new Prisma.Decimal(hourlyRate),
      },
      create: {
        userId: user.id,
        barId: activeBarId,
        role: userRole,
        isActive: true,
        hourlyRate:
          hourlyRate === null ? undefined : new Prisma.Decimal(hourlyRate),
      },
    });
  });

  await runEmailNotification(async () => {
    if (userRole === Role.OWNER) {
      await sendOwnerWelcomeEmail(
        email,
        `${firstName} ${lastName}`.trim(),
        bar.name,
        email,
        temporaryPassword
      );
      return;
    }

    await sendEmployeeWelcomeEmail(
      email,
      `${firstName} ${lastName}`.trim(),
      bar.name,
      email,
      temporaryPassword
    );
  });

  revalidatePath("/dashboard/people");
  redirect(appendStatusToPath(returnPath, { success: "employee-created" }));
}

export async function removeEmployeeAction(formData: FormData) {
  const { role, activeBarId } = await getActionContext();
  ensureOwnerRole(role);

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  const returnPath = await getReturnPathFromReferer("/dashboard/people");

  const membershipId = String(formData.get("membershipId") ?? "").trim();

  if (!membershipId) {
    throw new Error("Missing membership");
  }

  const membership = await prisma.employeeBar.findFirst({
    where: {
      id: membershipId,
      barId: activeBarId,
      isActive: true,
    },
    select: {
      id: true,
      userId: true,
      role: true,
    },
  });

  if (!membership) {
    throw new Error("Membership not found");
  }

  if (membership.role === Role.OWNER) {
    throw new Error("Owner cannot be removed");
  }

  await prisma.user.delete({
    where: {
      id: membership.userId,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/people");
  revalidatePath("/dashboard/shifts");
  revalidatePath("/dashboard/requests");
  redirect(appendStatusToPath(returnPath, { success: "employee-deleted" }));
}

export async function updateSettingsAction(formData: FormData) {
  const { role, activeBarId } = await getActionContext();
  ensureOwnerRole(role);

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  const currentBar = await prisma.bar.findUnique({
    where: { id: activeBarId },
    select: {
      activityType: true,
      latitude: true,
      longitude: true,
    },
  });

  if (!currentBar) {
    throw new Error("Bar not found");
  }

  if (currentBar.activityType === ActivityType.COMPANY) {
    const featureFlags = parseFeatureFlags(formData);
    const companyShiftsEnabled =
      formData.has("shiftsEnabled")
        ? Boolean(featureFlags.shiftsEnabled)
        : formData.get("companyShiftsEnabled") === "on";

    await prisma.barSettings.upsert({
      where: { barId: activeBarId },
      update: {
        companyShiftsEnabled,
        ...featureFlags,
      },
      create: {
        barId: activeBarId,
        companyShiftsEnabled,
        ...featureFlags,
      },
    });
  } else {
    const featureFlags = parseFeatureFlags(formData);
    const gpsLatitude = parseOptionalNumber(formData.get("gpsLatitude"));
    const gpsLongitude = parseOptionalNumber(formData.get("gpsLongitude"));
    const gpsRadius = await getGlobalGpsRadius();
    const roundingEnabled = formData.get("roundingEnabled") === "on";
    const roundingMinutes = 15;
    const roundingMode = "NEAREST";
    const morningPreset = parseShiftPresetPair(
      formData.get("morningStartTime"),
      formData.get("morningEndTime")
    );
    const afternoonPreset = parseShiftPresetPair(
      formData.get("afternoonStartTime"),
      formData.get("afternoonEndTime")
    );
    const eveningPreset = parseShiftPresetPair(
      formData.get("eveningStartTime"),
      formData.get("eveningEndTime")
    );

    const resolvedLatitude = gpsLatitude ?? currentBar.latitude ?? null;
    const resolvedLongitude = gpsLongitude ?? currentBar.longitude ?? null;

    if (resolvedLatitude === null || resolvedLongitude === null) {
      throw new Error("Missing GPS settings");
    }

    await prisma.$transaction([
      prisma.bar.update({
        where: { id: activeBarId },
        data: {
          latitude: resolvedLatitude,
          longitude: resolvedLongitude,
          radiusMeters: Math.round(gpsRadius),
          roundingEnabled,
          roundingStepMin: roundingMinutes,
        },
      }),
      prisma.barSettings.upsert({
        where: { barId: activeBarId },
        update: {
          gpsLatitude: resolvedLatitude,
          gpsLongitude: resolvedLongitude,
          gpsRadius: Math.round(gpsRadius),
          roundingEnabled,
          roundingMinutes,
          roundingMode,
          ...featureFlags,
          morningStartTime: morningPreset.startTime,
          morningEndTime: morningPreset.endTime,
          afternoonStartTime: afternoonPreset.startTime,
          afternoonEndTime: afternoonPreset.endTime,
          eveningStartTime: eveningPreset.startTime,
          eveningEndTime: eveningPreset.endTime,
        },
        create: {
          barId: activeBarId,
          gpsLatitude: resolvedLatitude,
          gpsLongitude: resolvedLongitude,
          gpsRadius: Math.round(gpsRadius),
          roundingEnabled,
          roundingMinutes,
          roundingMode,
          ...featureFlags,
          morningStartTime: morningPreset.startTime,
          morningEndTime: morningPreset.endTime,
          afternoonStartTime: afternoonPreset.startTime,
          afternoonEndTime: afternoonPreset.endTime,
          eveningStartTime: eveningPreset.startTime,
          eveningEndTime: eveningPreset.endTime,
        },
      }),
    ]);
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/timelogs");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/shifts");
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard/requests");
  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard/courses");
  revalidatePath("/dashboard/export");
  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
}

export async function updateGlobalGpsRadiusAction(nextRadius: number) {
  await getSuperAdminContext();

  if (!Number.isFinite(nextRadius)) {
    return {
      ok: false,
      gpsRadius: await getGlobalGpsRadius(),
      message: "Inserisci un valore valido.",
    };
  }

  const gpsRadius = await applyGlobalGpsRadius(nextRadius);

  revalidatePath("/dashboard/super-admin");
  revalidatePath("/dashboard/super-admin/gps");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/timelogs");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/onboarding");

  return {
    ok: true,
    gpsRadius,
    message: "Range globale aggiornato.",
  };
}

export async function createManualTimeLogAction(formData: FormData) {
  const { session, role, activeBarId } = await getActionContext();
  ensureOwnerRole(role);

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  const userId = String(formData.get("userId") ?? "").trim();
  const typeValue = String(formData.get("type") ?? "").trim();
  const timestamp = parseRequiredDate(formData.get("timestamp"));
  const latitude = parseOptionalNumber(formData.get("latitude"));
  const longitude = parseOptionalNumber(formData.get("longitude"));
  const note = String(formData.get("note") ?? "").trim();

  if (!userId || (typeValue !== "IN" && typeValue !== "OUT")) {
    throw new Error("Missing time log data");
  }

  await ensureUsersBelongToBar(activeBarId, [userId]);

  await prisma.timeLog.create({
    data: {
      userId,
      barId: activeBarId,
      createdById: session.user.id,
      type: typeValue,
      timestamp,
      latitude,
      longitude,
      isManual: true,
      note: note || null,
    },
  });

  invalidateReportingCache(activeBarId, userId);

  if (wantsSuccessRedirect(formData)) {
    const returnPath = await getReturnPathFromReferer("/dashboard/timelogs");

    revalidatePath("/dashboard/timelogs");
    revalidatePath("/dashboard/export");
    redirect(appendStatusToPath(returnPath, { success: "timelog-created" }));
  }

  revalidatePath("/dashboard/timelogs");
  revalidatePath("/dashboard/export");
}

export async function createTimeOffRequestAction(formData: FormData) {
  const { session, role, activeBarId } = await getActionContext();

  const typeRaw = String(formData.get("type") ?? "").trim();
  const targetEmployeeId = String(formData.get("employeeId") ?? "").trim();
  const startsAt = parseRequiredDate(formData.get("startsAt"));
  const endsAt = parseRequiredDate(formData.get("endsAt"));
  const reason = String(formData.get("reason") ?? "").trim();
  const certificateCode = String(formData.get("certificateCode") ?? "").trim();
  const type =
    typeRaw === RequestType.OVERTIME
      ? RequestType.OVERTIME
      : typeRaw === RequestType.PERMISSION
        ? RequestType.PERMISSION
        : typeRaw === RequestType.SICKNESS
          ? RequestType.SICKNESS
          : RequestType.VACATION;
  const isOwnerOvertimeRequest = role === Role.OWNER && type === RequestType.OVERTIME;

  if (!activeBarId || (role === Role.OWNER && !isOwnerOvertimeRequest)) {
    throw new Error("Unauthorized");
  }

  const requestFeatures = await getRequestFeatureSettings(activeBarId);

  if (requestFeatures?.requestsEnabled === false) {
    throw new Error("Requests not enabled");
  }

  if (type === RequestType.OVERTIME && requestFeatures?.overtimeEnabled === false) {
    throw new Error("Overtime not enabled");
  }

  const employeeId = isOwnerOvertimeRequest ? targetEmployeeId : session.user.id;

  if (!employeeId) {
    throw new Error("Missing employee");
  }

  if (isOwnerOvertimeRequest) {
    await ensureUsersBelongToBar(activeBarId, [employeeId]);
  }

  if (endsAt <= startsAt) {
    throw new Error("Invalid date range");
  }

  if (type === RequestType.SICKNESS && !certificateCode) {
    throw new Error("Missing certificate code");
  }

  const autoApproved = type === RequestType.SICKNESS || isOwnerOvertimeRequest;

  await prisma.request.create({
    data: {
      barId: activeBarId,
      employeeId,
      type,
      status: autoApproved ? RequestStatus.APPROVED : RequestStatus.PENDING,
      ownerStatus: autoApproved ? RequestStatus.APPROVED : RequestStatus.PENDING,
      reason: reason || null,
      certificateCode: certificateCode || null,
      startsAt,
      endsAt,
      ...(autoApproved
        ? {
            reviewedById: isOwnerOvertimeRequest ? session.user.id : null,
            reviewedAt: new Date(),
          }
        : {}),
    },
  });

  await runEmailNotification(async () => {
    const notificationContext = await getBarNotificationContext(activeBarId);

    if (!notificationContext) {
      return;
    }

    if (isOwnerOvertimeRequest) {
      return;
    }

    const ownerRecipients = excludeActorFromUsers(
      notificationContext.users.filter((user) => user.role === Role.OWNER),
      session.user.id
    );

    await Promise.all(
      ownerRecipients.map((recipient) =>
        sendLeaveRequestEmail(
          recipient.email,
          getFullName(session.user),
          getLeaveTypeLabel(type),
          notificationContext.barName
        )
      )
    );
  });

  if (wantsSuccessRedirect(formData)) {
    const returnPath = await getReturnPathFromReferer("/dashboard/requests");

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/requests");
    revalidatePath("/dashboard/export");
    revalidatePath("/dashboard/calendar");
    redirect(appendStatusToPath(returnPath, { success: "request-created" }));
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/requests");
  revalidatePath("/dashboard/export");
  revalidatePath("/dashboard/calendar");
}

export async function createShiftChangeRequestAction(formData: FormData) {
  const { session, role, activeBarId } = await getActionContext();

  if (!activeBarId || role === Role.OWNER) {
    throw new Error("Unauthorized");
  }

  const requestFeatures = await getRequestFeatureSettings(activeBarId);

  if (requestFeatures?.requestsEnabled === false) {
    throw new Error("Requests not enabled");
  }

  const shiftId = String(formData.get("shiftId") ?? "").trim();
  const swapWithUserId = String(formData.get("swapWithUserId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!shiftId || !swapWithUserId) {
    throw new Error("Missing shift change data");
  }

  if (swapWithUserId === session.user.id) {
    throw new Error("Seleziona un collega diverso da te");
  }

  const shift = await prisma.shift.findFirst({
    where: {
      id: shiftId,
      barId: activeBarId,
      assignments: {
        some: {
          userId: session.user.id,
        },
      },
    },
    select: {
      id: true,
      startTime: true,
      endTime: true,
    },
  });

  if (!shift) {
    throw new Error("Shift not found");
  }

  await ensureUsersBelongToBar(activeBarId, [swapWithUserId]);

  await prisma.request.create({
    data: {
      barId: activeBarId,
      employeeId: session.user.id,
      shiftId: shift.id,
      swapWithUserId,
      type: RequestType.SHIFT_CHANGE,
      status: RequestStatus.PENDING,
      peerStatus: RequestStatus.PENDING,
      ownerStatus: RequestStatus.PENDING,
      reason: reason || null,
      startsAt: shift.startTime,
      endsAt: shift.endTime,
    },
  });

  await runEmailNotification(async () => {
    const notificationContext = await getBarNotificationContext(activeBarId);

    if (!notificationContext) {
      return;
    }

    const recipients = excludeActorFromUsers(
      dedupeUsers([
        ...notificationContext.users.filter((user) => user.role === Role.OWNER),
        notificationContext.users.find((user) => user.id === swapWithUserId),
      ]),
      session.user.id
    );

    if (recipients.length === 0) {
      return;
    }

    const requesterName = getFullName(session.user);

    await Promise.all(
      recipients.map((recipient) =>
        sendShiftSwapRequestEmail(
          recipient.email,
          recipient.firstName,
          requesterName,
          notificationContext.barName
        )
      )
    );
  });

  if (wantsSuccessRedirect(formData)) {
    const returnPath = await getReturnPathFromReferer("/dashboard/requests");

    revalidatePath("/dashboard/requests");
    redirect(appendStatusToPath(returnPath, { success: "shift-change-created" }));
  }

  revalidatePath("/dashboard/requests");
}

export async function reviewRequestAction(formData: FormData) {
  const { session, role, activeBarId } = await getActionContext();

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  const requestId = String(formData.get("requestId") ?? "").trim();
  const decision = parseRequestStatus(formData.get("decision"));

  const request = await prisma.request.findFirst({
    where: {
      id: requestId,
      barId: activeBarId,
    },
    include: {
      bar: {
        select: {
          ownerId: true,
          name: true,
        },
      },
      employee: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      swapWith: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!request) {
    throw new Error("Request not found");
  }

  let shiftChangeNotification:
    | {
        approved: boolean;
        barName: string;
        recipients: Array<{
          email: string;
          firstName: string;
          lastName: string;
        }>;
      }
    | null = null;
  let leaveNotification:
    | {
        approved: boolean;
        barName: string;
        employeeEmail: string;
        type: string;
      }
    | null = null;

  if (request.type === RequestType.SHIFT_CHANGE) {
    const isPeerReviewer = request.swapWithUserId === session.user.id;
    const isOwnerReviewer = request.bar.ownerId === session.user.id || role === Role.OWNER;

    if (!isPeerReviewer && !isOwnerReviewer) {
      throw new Error("Unauthorized");
    }

    if (decision === RequestStatus.REJECTED) {
      await prisma.request.update({
        where: { id: request.id },
        data: {
          status: RequestStatus.REJECTED,
          ...(isPeerReviewer
            ? {
                peerStatus: RequestStatus.REJECTED,
                peerReviewedAt: new Date(),
                peerReviewedById: session.user.id,
              }
            : {
                ownerStatus: RequestStatus.REJECTED,
                reviewedAt: new Date(),
                reviewedById: session.user.id,
            }),
        },
      });

      shiftChangeNotification = {
        approved: false,
        barName: request.bar.name,
        recipients: excludeActorFromUsers(
          dedupeUsers([
          {
            id: request.employeeId,
            email: request.employee.email,
            firstName: request.employee.firstName,
            lastName: request.employee.lastName,
            role: Role.EMPLOYEE,
          },
          request.swapWith
            ? {
                id: request.swapWithUserId ?? request.swapWith.email,
                email: request.swapWith.email,
                firstName: request.swapWith.firstName,
                lastName: request.swapWith.lastName,
                role: Role.EMPLOYEE,
              }
            : null,
          ]),
          session.user.id
        ).map((user) => ({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        })),
      };
    } else {
      const updated = await prisma.request.update({
        where: { id: request.id },
        data: isPeerReviewer
          ? {
              peerStatus: RequestStatus.APPROVED,
              peerReviewedAt: new Date(),
              peerReviewedById: session.user.id,
            }
          : {
              ownerStatus: RequestStatus.APPROVED,
              reviewedAt: new Date(),
              reviewedById: session.user.id,
            },
      });

      if (
        (isPeerReviewer ? updated.ownerStatus : updated.peerStatus) ===
        RequestStatus.APPROVED
      ) {
        await prisma.request.update({
          where: { id: request.id },
          data: {
            status: RequestStatus.APPROVED,
          },
        });
        await applyShiftChangeIfApproved(request.id);

        shiftChangeNotification = {
          approved: true,
          barName: request.bar.name,
          recipients: excludeActorFromUsers(
            dedupeUsers([
            {
              id: request.employeeId,
              email: request.employee.email,
              firstName: request.employee.firstName,
              lastName: request.employee.lastName,
              role: Role.EMPLOYEE,
            },
            request.swapWith
              ? {
                  id: request.swapWithUserId ?? request.swapWith.email,
                  email: request.swapWith.email,
                  firstName: request.swapWith.firstName,
                  lastName: request.swapWith.lastName,
                  role: Role.EMPLOYEE,
                }
              : null,
            ]),
            session.user.id
          ).map((user) => ({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          })),
        };
      }
    }
  } else {
    const isOwnerReviewer = request.bar.ownerId === session.user.id || role === Role.OWNER;

    if (!isOwnerReviewer) {
      throw new Error("Unauthorized");
    }

    await prisma.request.update({
      where: { id: request.id },
      data: {
        status: decision,
        ownerStatus: decision,
        reviewedAt: new Date(),
        reviewedById: session.user.id,
      },
    });

    leaveNotification = {
      approved: decision === RequestStatus.APPROVED,
      barName: request.bar.name,
      employeeEmail: request.employee.email,
      type: getLeaveTypeLabel(request.type),
    };
  }

  if (shiftChangeNotification) {
    await runEmailNotification(async () => {
      await Promise.all(
        shiftChangeNotification.recipients.map((recipient) =>
          sendShiftSwapResultEmail(
            recipient.email,
            recipient.firstName,
            shiftChangeNotification.approved,
            shiftChangeNotification.barName
          )
        )
      );
    });
  }

  if (leaveNotification) {
    await runEmailNotification(async () => {
      await sendLeaveRequestResultEmail(
        leaveNotification.employeeEmail,
        leaveNotification.approved,
        leaveNotification.type,
        leaveNotification.barName
      );
    });
  }

  if (wantsSuccessRedirect(formData)) {
    const returnPath = await getReturnPathFromReferer("/dashboard/requests");

    revalidatePath("/dashboard/requests");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/export");
    revalidatePath("/dashboard/shifts");
    revalidatePath("/dashboard/calendar");
    redirect(appendStatusToPath(returnPath, { success: "request-reviewed" }));
  }

  revalidatePath("/dashboard/requests");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/export");
  revalidatePath("/dashboard/shifts");
  revalidatePath("/dashboard/calendar");
}
