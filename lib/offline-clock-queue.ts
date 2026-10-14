"use client";

/**
 * Stamps made without network, kept on the phone until it comes back.
 *
 * Kept in the app's native store (lib/native-extras.ts) rather than in
 * localStorage, because the offline page the app shows when the site cannot
 * load lives at another address and could not see it. Both pages write the
 * same queue, and the site sends it when it loads or the network returns.
 */

import { nativeGet, nativeSet } from "./native-extras";

export const CLOCK_QUEUE_KEY = "wb-clock-queue";
export const CLOCK_CONTEXT_KEY = "wb-clock-context";

export type QueuedStamp = {
  endpoint: "clock-in" | "clock-out";
  latitude: number;
  longitude: number;
  accuracy: number | null;
  /** When the button was pressed, in ms. */
  at: number;
};

/** What the offline page needs to offer a stamp, saved while online. */
export type ClockContext = {
  firstName: string;
  barName: string;
  points: Array<{ latitude: number; longitude: number }>;
  radius: number;
  /** What the next stamp is. */
  next: "clock-in" | "clock-out";
  savedAt: number;
};

export async function queuedStamps() {
  return (await nativeGet<QueuedStamp[]>(CLOCK_QUEUE_KEY)) ?? [];
}

export async function queueStamp(stamp: QueuedStamp) {
  const queue = await queuedStamps();
  queue.push(stamp);
  await nativeSet(CLOCK_QUEUE_KEY, queue);
}

export async function saveClockContext(context: ClockContext) {
  await nativeSet(CLOCK_CONTEXT_KEY, context);
}

export type FlushResult = { sent: number; refused: string[] };

let flushing = false;

/**
 * Sends the queued stamps in order. A refusal (out of range, too old) is
 * dropped and said; a network failure keeps the rest for next time.
 */
export async function flushQueuedStamps(): Promise<FlushResult> {
  const result: FlushResult = { sent: 0, refused: [] };
  if (flushing) return result;
  flushing = true;
  try {
    const queue = await queuedStamps();
    if (!queue.length) return result;
    const left: QueuedStamp[] = [];
    for (let index = 0; index < queue.length; index += 1) {
      const stamp = queue[index];
      try {
        const response = await fetch(`/api/timelogs/${stamp.endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: stamp.latitude,
            longitude: stamp.longitude,
            accuracy: stamp.accuracy,
            offlineAt: new Date(stamp.at).toISOString(),
          }),
        });
        if (response.status >= 500) {
          left.push(...queue.slice(index));
          break;
        }
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
        if (response.ok && payload?.ok !== false) {
          result.sent += 1;
        } else {
          const what = stamp.endpoint === "clock-in" ? "Entrata" : "Uscita";
          const reason =
            payload?.message === "Outside allowed radius" ? "eri fuori dal luogo di lavoro" : payload?.message || "rifiutata";
          result.refused.push(`${what} senza rete non registrata: ${reason}`);
        }
      } catch {
        // Still no network: everything from here waits.
        left.push(...queue.slice(index));
        break;
      }
    }
    await nativeSet(CLOCK_QUEUE_KEY, left.length ? left : null);
    return result;
  } finally {
    flushing = false;
  }
}
