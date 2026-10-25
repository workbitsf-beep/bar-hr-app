import "server-only";

import { getVenueDepartments } from "@/lib/departments";
import { getMessagingService } from "@/lib/firebase-admin";
import { prisma } from "@/lib/prisma";

/**
 * The iPhone's Live Activity started from the server, five minutes before a
 * shift: "Il turno inizia alle 18:00" with a round ENTRA button on the lock
 * screen, which then becomes "In servizio" once the entry is stamped
 * (ios/App/WorkbitWidget/ShiftLiveActivity.swift).
 *
 * The phone hands over a push-to-start token (iOS 17.2+), kept as a push
 * token of its own platform; Firebase delivers the start, next to the
 * phone's usual notification token.
 */

export const LIVE_ACTIVITY_PLATFORM = "ios-liveactivity";

// ActivityKit reads dates as seconds since 1 January 2001.
const APPLE_EPOCH_S = 978_307_200;
const appleDate = (date: Date) => date.getTime() / 1000 - APPLE_EPOCH_S;

export async function startShiftLiveActivity(input: { userId: string; shiftId: string }) {
  const messaging = getMessagingService();
  if (!messaging) return false;

  const tokens = await prisma.pushToken.findMany({
    where: { userId: input.userId, platform: { in: [LIVE_ACTIVITY_PLATFORM, "ios-native"] } },
    select: { token: true, platform: true },
  });
  const liveActivityToken = tokens.find((entry) => entry.platform === LIVE_ACTIVITY_PLATFORM)?.token;
  const deviceToken = tokens.find((entry) => entry.platform === "ios-native")?.token;
  if (!liveActivityToken || !deviceToken) return false;

  const shift = await prisma.shift.findUnique({
    where: { id: input.shiftId },
    select: { barId: true, startTime: true, endTime: true, department: true, bar: { select: { name: true } } },
  });
  if (!shift) return false;

  const departments = await getVenueDepartments(shift.barId, input.userId);
  const area =
    departments.enabled && shift.department
      ? [...departments.list, ...departments.sites].find((entry) => entry.id === shift.department)?.name ?? ""
      : "";

  try {
    await messaging.send({
      token: deviceToken,
      apns: {
        liveActivityToken,
        headers: { "apns-priority": "10" },
        payload: {
          aps: {
            timestamp: Math.floor(Date.now() / 1000),
            event: "start",
            "content-state": {
              since: appleDate(shift.startTime),
              end: appleDate(shift.endTime),
              pending: true,
            },
            "attributes-type": "ShiftActivityAttributes",
            attributes: { venue: shift.bar.name, area },
            // Gone by itself an hour after the start if nobody stamps.
            "stale-date": Math.floor(shift.startTime.getTime() / 1000) + 60 * 60,
            alert: { title: "Tra 5 minuti inizi", body: "Tocca ENTRA per timbrare." },
          },
        },
      },
    });
    return true;
  } catch (error) {
    console.error("[live-activity] start not sent", {
      userId: input.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
