import "server-only";

import { sendPushNotification, type PushTokenRecord } from "@/lib/push";
import { prisma } from "@/lib/prisma";

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
  // Before a certificate runs out, and when one is added by the person.
  COURSE_EXPIRING: "course.expiring",
  COURSE_CERTIFICATE_ADDED: "course.certificate-added",
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
  SHOPPING_LIST_ITEM_ADDED: "shopping-list.item-added",
  AVAILABILITY_CREATED: "availability.created",
  AVAILABILITY_REVIEWED: "availability.reviewed",
  TIMELOG_CLOCK_IN_REMINDER_BEFORE: "timelog.clock-in.before",
  TIMELOG_CLOCK_IN_REMINDER_START: "timelog.clock-in.start",
  TIMELOG_CLOCK_OUT_REMINDER_BEFORE: "timelog.clock-out.before",
  TIMELOG_CLOCK_OUT_REMINDER_END: "timelog.clock-out.end",
  TIMELOG_AUTO_CLOCK_OUT: "timelog.auto-clock-out",
  // To the owner and the managers: who clocked in or out, as it happens.
  TIMELOG_CLOCKED_IN: "timelog.clocked-in",
  TIMELOG_CLOCKED_OUT: "timelog.clocked-out",
  // Nobody's hours change quietly: cancelling a stamp tells the person it
  // belonged to.
  TIMELOG_CANCELLED: "timelog.cancelled",
  BILLING_ACTIVE: "billing.active",
  BILLING_PAST_DUE: "billing.past_due",
  BILLING_CANCELED: "billing.canceled",
  LEGAL_DOCUMENT_REQUIRED: "legal-document.required",
  GENERIC_REQUEST_CREATED: "generic-request.created",
  GENERIC_REQUEST_REVIEWED: "generic-request.reviewed",
  // To the owner, on the day they chose: last month's attendance to check and send.
  PAYROLL_READY: "payroll.ready",
  // To the owner: a bonifico due soon, or one past its day with no word yet.
  SUPPLIER_PAYMENT: "supplier-payment.due",
  // To the super admins, early in the month: last month's market prices to type in.
  MARKET_PRICES: "market-prices.due",
  // To the super admins: the month's search of public price lists is done.
  ONLINE_LISTS: "online-lists.done",
  // To the super admins: a business in the free pilot told us what it thinks.
  PILOT_FEEDBACK: "pilot-feedback.received",
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
  payload: NotificationPayload,
  options?: { preloadedTokens?: PushTokenRecord[] }
) {
  const recipients = normalizeRecipients(users);

  if (recipients.length === 0) {
    return {
      createdCount: 0,
      pushResult: null as Awaited<ReturnType<typeof sendPushNotification>> | null,
    };
  }

  // Kept as well as pushed, so the bell in the menu can show them again to
  // someone who missed the push or has it switched off. One insert for all.
  try {
    await prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        userId: recipient.id,
        barId: payload.barId ?? null,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        actionUrl: payload.actionUrl ?? null,
      })),
    });
  } catch (error) {
    console.error("[notifications] Failed to store notifications.", {
      type: payload.type,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const pushResult = await sendPushNotification(
    {
      userIds: recipients.map((recipient) => recipient.id),
      title: payload.title,
      body: payload.message,
      data: {
        type: payload.type,
        actionUrl: payload.actionUrl ?? "",
        barId: payload.barId ?? "",
      },
    },
    options?.preloadedTokens
  );

  return {
    createdCount: recipients.length,
    pushResult,
  };
}
