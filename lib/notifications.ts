import "server-only";

import { prisma } from "@/lib/prisma";
import { sendPushNotification } from "@/lib/push";

export const INTERNAL_NOTIFICATION_TYPES = {
  SHIFT_PUBLISHED: "shift.published",
  SHIFT_UPDATED: "shift.updated",
  SHIFT_DELETED: "shift.deleted",
  TASK_ASSIGNED: "task.assigned",
  TASK_COMPLETED: "task.completed",
  BOARD_MESSAGE: "board.message",
  COURSE_CREATED: "course.created",
  COURSE_UPDATED: "course.updated",
  COURSE_DELETED: "course.deleted",
  REQUEST_CREATED: "request.created",
  REQUEST_REVIEWED: "request.reviewed",
  SHIFT_CHANGE_REQUESTED: "shift-change.requested",
  SHIFT_CHANGE_REVIEWED: "shift-change.reviewed",
  REPERIBILITY_REQUESTED: "reperibility.requested",
  REPERIBILITY_REVIEWED: "reperibility.reviewed",
  CLOSURE_CREATED: "closure.created",
  CLOSURE_UPDATED: "closure.updated",
  CLOSURE_DELETED: "closure.deleted",
  AVAILABILITY_CREATED: "availability.created",
  AVAILABILITY_REVIEWED: "availability.reviewed",
  BILLING_ACTIVE: "billing.active",
  BILLING_PAST_DUE: "billing.past_due",
  BILLING_CANCELED: "billing.canceled",
  LEGAL_DOCUMENT_REQUIRED: "legal-document.required",
  GENERIC_REQUEST_CREATED: "generic-request.created",
  GENERIC_REQUEST_REVIEWED: "generic-request.reviewed",
} as const;

export type InternalNotificationType =
  (typeof INTERNAL_NOTIFICATION_TYPES)[keyof typeof INTERNAL_NOTIFICATION_TYPES];

export type NotificationRecipient = {
  id: string;
};

export type NotificationPayload = {
  barId?: string | null;
  title: string;
  message: string;
  type: InternalNotificationType | string;
  actionUrl?: string | null;
};

function normalizeRecipients(users: Array<NotificationRecipient | string | null | undefined>) {
  const byId = new Map<string, NotificationRecipient>();

  for (const user of users) {
    const id = typeof user === "string" ? user.trim() : user?.id?.trim();

    if (!id) {
      continue;
    }

    byId.set(id, { id });
  }

  return Array.from(byId.values());
}

function logNotificationError(input: {
  userId: string;
  barId?: string | null;
  title: string;
  type: string;
  error: unknown;
}) {
  console.error("[notifications] Failed to create notification.", {
    userId: input.userId,
    barId: input.barId ?? null,
    type: input.type,
    title: input.title,
    error: input.error instanceof Error ? input.error.message : String(input.error),
  });
}

export async function createNotification(input: {
  userId: string;
  barId?: string | null;
  title: string;
  message: string;
  type: InternalNotificationType | string;
  actionUrl?: string | null;
}) {
  try {
    const duplicateWindowStart = new Date(Date.now() - 30_000);
    const existingDuplicate = await prisma.notification.findFirst({
      where: {
        userId: input.userId,
        barId: input.barId ?? null,
        title: input.title,
        message: input.message,
        type: input.type,
        actionUrl: input.actionUrl ?? null,
        createdAt: {
          gte: duplicateWindowStart,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingDuplicate) {
      return null;
    }

    return await prisma.notification.create({
      data: {
        userId: input.userId,
        barId: input.barId ?? null,
        title: input.title,
        message: input.message,
        type: input.type,
        actionUrl: input.actionUrl ?? null,
      },
    });
  } catch (error) {
    logNotificationError({
      userId: input.userId,
      barId: input.barId,
      title: input.title,
      type: input.type,
      error,
    });

    return null;
  }
}

export async function notifyUsers(
  users: Array<NotificationRecipient | string | null | undefined>,
  payload: NotificationPayload
) {
  const recipients = normalizeRecipients(users);

  if (recipients.length === 0) {
    return {
      createdCount: 0,
      pushResult: null as Awaited<ReturnType<typeof sendPushNotification>> | null,
    };
  }

  const created = await Promise.all(
    recipients.map((recipient) =>
      createNotification({
        userId: recipient.id,
        barId: payload.barId ?? null,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        actionUrl: payload.actionUrl ?? null,
      })
    )
  );

  const notificationIds = created.filter((notification): notification is NonNullable<typeof notification> =>
    Boolean(notification)
  );

  if (notificationIds.length === 0) {
    return {
      createdCount: 0,
      pushResult: null as Awaited<ReturnType<typeof sendPushNotification>> | null,
    };
  }

  const pushResult = await sendPushNotification({
    userIds: notificationIds.map((notification) => notification.userId),
    title: payload.title,
    body: payload.message,
    data: {
      type: payload.type,
      actionUrl: payload.actionUrl ?? "",
      barId: payload.barId ?? "",
    },
  });

  return {
    createdCount: notificationIds.length,
    pushResult,
  };
}
