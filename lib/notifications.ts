import "server-only";

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
  DOCUMENT_CREATED: "document.created",
  AVAILABILITY_CREATED: "availability.created",
  AVAILABILITY_REVIEWED: "availability.reviewed",
  TIMELOG_CLOCK_IN_REMINDER_BEFORE: "timelog.clock-in.before",
  TIMELOG_CLOCK_IN_REMINDER_START: "timelog.clock-in.start",
  TIMELOG_CLOCK_OUT_REMINDER_BEFORE: "timelog.clock-out.before",
  TIMELOG_CLOCK_OUT_REMINDER_END: "timelog.clock-out.end",
  TIMELOG_AUTO_CLOCK_OUT: "timelog.auto-clock-out",
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

  const pushResult = await sendPushNotification({
    userIds: recipients.map((recipient) => recipient.id),
    title: payload.title,
    body: payload.message,
    data: {
      type: payload.type,
      actionUrl: payload.actionUrl ?? "",
      barId: payload.barId ?? "",
    },
  });

  return {
    createdCount: recipients.length,
    pushResult,
  };
}
