"use server";

import bcrypt from "bcrypt";
import {
  ActivityType,
  AppLanguage,
  BillingInterval,
  PlanType,
  Prisma,
  RequestStatus,
  RequestType,
  Role,
  SubscriptionStatus,
  TaskStatus,
} from "@prisma/client";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  sendEmployeeWelcomeEmail,
  sendLeaveRequestEmail,
  sendLeaveRequestResultEmail,
  sendNoticeBoardEmail,
  sendOwnerWelcomeEmail,
  sendShiftSwapRequestEmail,
  sendShiftSwapResultEmail,
  sendTaskAssignedEmail,
  sendUnavailabilityEmail,
} from "@/lib/email/notifications";
import {
  canAccessBar as canAccessBillingBar,
  createDefaultTrialEndsAt,
  invalidateBillingStatusCache,
} from "@/lib/billing";
import { LANGUAGE_COOKIE_NAME } from "@/lib/language";
import { prisma } from "@/lib/prisma";
import { invalidateReportingCache } from "@/lib/reporting";
import { requireStripe } from "@/lib/stripe";
import { parseTaskDueDate } from "@/lib/task-dates";
import {
  canManageOperations,
  canManagePeople,
  getActiveBarAccess,
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
  const date = new Date(String(value ?? ""));

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }

  return date;
}

function parseOptionalNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function normalizeIds(entries: FormDataEntryValue[]): string[] {
  return Array.from(
    new Set(
      entries
        .map((entry) => String(entry).trim())
        .filter((entry) => entry.length > 0)
    )
  );
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
  redirect(
    appendStatusToPath(returnPath, {
      success: welcomeEmailSent ? "owner-created" : "owner-created-email-failed",
    })
  );
}

export async function createBarBySuperAdminAction(formData: FormData) {
  await getSuperAdminContext();

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
}

export async function updateBarSubscriptionAction(formData: FormData) {
  await getSuperAdminContext();

  const barId = String(formData.get("barId") ?? "").trim();
  const ownerId = String(formData.get("ownerId") ?? "").trim();
  const planType = parsePlanType(formData.get("planType"));
  const billingInterval = parseBillingInterval(formData.get("billingInterval"));
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

  const bar = await prisma.bar.update({
    where: { id: barId },
    data: {
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

  await prisma.subscription.upsert({
    where: { barId },
    update: {
      planType,
      billingInterval,
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

  invalidateBillingStatusCache(barId);

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/super-admin");
  revalidatePath("/dashboard/super-admin/billing");
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
    const stripe = requireStripe();

    try {
      await stripe.subscriptions.cancel(bar.subscription.stripeSubscriptionId);
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Unable to cancel Stripe subscription"
      );
    }
  }

  await prisma.bar.delete({
    where: { id: bar.id },
  });

  const [remainingOwnedBars, remainingMemberships] = await Promise.all([
    prisma.bar.count({
      where: {
        ownerId: bar.ownerId,
      },
    }),
    prisma.employeeBar.count({
      where: {
        userId: bar.ownerId,
        isActive: true,
      },
    }),
  ]);

  if (remainingOwnedBars === 0 && remainingMemberships === 0) {
    await prisma.user.delete({
      where: {
        id: bar.ownerId,
      },
    });
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/super-admin");
  revalidatePath("/dashboard/super-admin/billing");
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

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const dueDate = parseTaskDueDate(String(formData.get("dueDate") ?? ""));
  const assignedToId = String(formData.get("assignedToId") ?? "").trim();
  const assignedToAll = formData.get("assignedToAll") === "on";
  const isUrgent = formData.get("isUrgent") === "on";

  if (!title) {
    throw new Error("Missing title");
  }

  if (!dueDate) {
    throw new Error("Invalid due date");
  }

  if (!assignedToAll && assignedToId) {
    await ensureUsersBelongToBar(activeBarId, [assignedToId]);
  }

  const task = await prisma.task.create({
    data: {
      title,
      description: description || null,
      dueDate,
      assignedToAll,
      assignedToId: assignedToAll ? null : assignedToId || null,
      barId: activeBarId,
      createdById: session.user.id,
      status: TaskStatus.TODO,
      isUrgent,
    },
  });

  await runEmailNotification(async () => {
    const notificationContext = await getBarNotificationContext(activeBarId);

    if (!notificationContext) {
      return;
    }

    const recipients = assignedToAll
      ? notificationContext.users.filter((user) => user.role !== Role.OWNER)
      : notificationContext.users.filter((user) => user.id === assignedToId);

    await Promise.all(
      recipients.map((recipient) =>
        sendTaskAssignedEmail(
          recipient.email,
          recipient.firstName,
          task.title,
          notificationContext.barName
        )
      )
    );
  });

  revalidatePath("/dashboard");
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
  revalidatePath("/dashboard/tasks");
}

export async function createShiftAction(formData: FormData) {
  const { session, role, activeBarId } = await getActionContext();
  ensureOperationRole(role);

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  const title = String(formData.get("title") ?? "").trim();
  const startTime = parseRequiredDate(formData.get("startTime"));
  const endTime = parseRequiredDate(formData.get("endTime"));
  const employeeIds = normalizeIds(formData.getAll("employeeIds"));

  if (employeeIds.length === 0) {
    throw new Error("Select at least one employee");
  }

  if (endTime <= startTime) {
    throw new Error("Invalid shift range");
  }

  await ensureUsersBelongToBar(activeBarId, employeeIds);

  await prisma.shift.create({
    data: {
      title: title || null,
      startTime,
      endTime,
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
  const { role, activeBarId } = await getActionContext();
  ensureOperationRole(role);

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  const shiftId = String(formData.get("shiftId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const startTime = parseRequiredDate(formData.get("startTime"));
  const endTime = parseRequiredDate(formData.get("endTime"));
  const employeeIds = normalizeIds(formData.getAll("employeeIds"));

  if (!shiftId || employeeIds.length === 0) {
    throw new Error("Missing shift data");
  }

  if (endTime <= startTime) {
    throw new Error("Invalid shift range");
  }

  await ensureUsersBelongToBar(activeBarId, employeeIds);

  await prisma.shift.update({
    where: {
      id: shiftId,
      barId: activeBarId,
    },
    data: {
      title: title || null,
      assignedToId: employeeIds[0],
      startTime,
      endTime,
      confirmedAt: null,
      confirmedById: null,
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

export async function deleteShiftAction(formData: FormData) {
  const { role, activeBarId } = await getActionContext();
  ensureOperationRole(role);

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

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

  const content = String(formData.get("content") ?? "").trim();
  const isPinned = canManageOperations(role) && formData.get("isPinned") === "on";

  if (!content) {
    throw new Error("Missing content");
  }

  await prisma.note.create({
    data: {
      barId: activeBarId,
      authorId: session.user.id,
      content,
      isPinned,
    },
  });

  await runEmailNotification(async () => {
    const notificationContext = await getBarNotificationContext(activeBarId);

    if (!notificationContext) {
      return;
    }

    const authorName = getFullName(session.user);
    const recipients = notificationContext.users.filter(
      (user) => user.id !== session.user.id
    );

    await Promise.all(
      recipients.map((recipient) =>
        sendNoticeBoardEmail(
          recipient.email,
          recipient.firstName,
          authorName,
          notificationContext.barName
        )
      )
    );
  });

  revalidatePath("/dashboard");
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

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/tasks");
}

export async function createAvailabilityAction(formData: FormData) {
  const { session, activeBarId } = await getActionContext();

  if (!activeBarId) {
    throw new Error("No active bar selected");
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

    const recipients = notificationContext.users.filter(
      (user) =>
        user.id !== session.user.id &&
        (user.id === notificationContext.owner.id || user.role === Role.MANAGER)
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

  revalidatePath("/dashboard/requests");
  revalidatePath("/dashboard/shifts");
  revalidatePath("/dashboard/calendar");
}

export async function createCourseAction(formData: FormData) {
  const { session, role, activeBarId } = await getActionContext();
  ensureOperationRole(role);

  if (!activeBarId) {
    throw new Error("No active bar selected");
  }

  const bar = await prisma.bar.findUnique({
    where: { id: activeBarId },
    select: { activityType: true },
  });

  if (bar?.activityType !== ActivityType.COMPANY) {
    throw new Error("Courses are available only for company activity type");
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

  const gpsLatitude = parseOptionalNumber(formData.get("gpsLatitude"));
  const gpsLongitude = parseOptionalNumber(formData.get("gpsLongitude"));
  const gpsRadius = await getGlobalGpsRadius();
  const roundingEnabled = formData.get("roundingEnabled") === "on";
  const roundingMinutes = 15;
  const roundingMode = "NEAREST";

  if (gpsLatitude === null || gpsLongitude === null) {
    throw new Error("Missing GPS settings");
  }

  await prisma.$transaction([
    prisma.bar.update({
      where: { id: activeBarId },
      data: {
        latitude: gpsLatitude,
        longitude: gpsLongitude,
        radiusMeters: Math.round(gpsRadius),
        roundingEnabled,
        roundingStepMin: roundingMinutes,
      },
    }),
    prisma.barSettings.upsert({
      where: { barId: activeBarId },
      update: {
        gpsLatitude,
        gpsLongitude,
        gpsRadius: Math.round(gpsRadius),
        roundingEnabled,
        roundingMinutes,
        roundingMode,
      },
      create: {
        barId: activeBarId,
        gpsLatitude,
        gpsLongitude,
        gpsRadius: Math.round(gpsRadius),
        roundingEnabled,
        roundingMinutes,
        roundingMode,
      },
    }),
  ]);

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/timelogs");
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

  revalidatePath("/dashboard/timelogs");
  revalidatePath("/dashboard/export");
}

export async function createTimeOffRequestAction(formData: FormData) {
  const { session, role, activeBarId } = await getActionContext();

  if (!activeBarId || role === Role.OWNER) {
    throw new Error("Unauthorized");
  }

  const typeRaw = String(formData.get("type") ?? "").trim();
  const startsAt = parseRequiredDate(formData.get("startsAt"));
  const endsAt = parseRequiredDate(formData.get("endsAt"));
  const reason = String(formData.get("reason") ?? "").trim();
  const certificateCode = String(formData.get("certificateCode") ?? "").trim();
  const type =
    typeRaw === RequestType.PERMISSION
      ? RequestType.PERMISSION
      : typeRaw === RequestType.SICKNESS
        ? RequestType.SICKNESS
        : RequestType.VACATION;

  if (endsAt <= startsAt) {
    throw new Error("Invalid date range");
  }

  if (type === RequestType.SICKNESS && !certificateCode) {
    throw new Error("Missing certificate code");
  }

  const autoApproved = type === RequestType.SICKNESS;

  await prisma.request.create({
    data: {
      barId: activeBarId,
      employeeId: session.user.id,
      type,
      status: autoApproved ? RequestStatus.APPROVED : RequestStatus.PENDING,
      ownerStatus: autoApproved ? RequestStatus.APPROVED : RequestStatus.PENDING,
      reason: reason || null,
      certificateCode: certificateCode || null,
      startsAt,
      endsAt,
      ...(autoApproved
        ? {
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

    await sendLeaveRequestEmail(
      notificationContext.owner.email,
      getFullName(session.user),
      getLeaveTypeLabel(type),
      notificationContext.barName
    );
  });

  revalidatePath("/dashboard/requests");
  revalidatePath("/dashboard/export");
  revalidatePath("/dashboard/calendar");
}

export async function createShiftChangeRequestAction(formData: FormData) {
  const { session, role, activeBarId } = await getActionContext();

  if (!activeBarId || role === Role.OWNER) {
    throw new Error("Unauthorized");
  }

  const shiftId = String(formData.get("shiftId") ?? "").trim();
  const swapWithUserId = String(formData.get("swapWithUserId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!shiftId || !swapWithUserId) {
    throw new Error("Missing shift change data");
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

    const recipients = dedupeUsers([
      notificationContext.owner,
      notificationContext.users.find((user) => user.id === swapWithUserId),
    ]);

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
        recipients: dedupeUsers([
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
        ]).map((user) => ({
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
          recipients: dedupeUsers([
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
          ]).map((user) => ({
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

  revalidatePath("/dashboard/requests");
  revalidatePath("/dashboard/export");
  revalidatePath("/dashboard/shifts");
  revalidatePath("/dashboard/calendar");
}
