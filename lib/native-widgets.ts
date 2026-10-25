"use client";

/**
 * The phone's widgets and the Live Activity of a stamp in progress.
 *
 * The page fetches what they show (app/api/widgets) and hands it to the
 * WorkbitWidgets plugin, written into the app itself (ios/App/App and
 * android/app/src/main/java/it/workbit/app). The native side keeps it, the
 * widgets read it, and an open entry starts the Live Activity - an ended one
 * stops it.
 *
 * The plugin also says when the app was opened from one of them - "Esci" on
 * the Live Activity or on Android's "In servizio" notification - so the page
 * can stamp straight away.
 *
 * An app installed before the widgets existed has no such plugin: then
 * nothing happens, as in a browser.
 */

import type { ClockDirection } from "./clock-request";
import { isNativeApp } from "./native-app";

type OpenEvent = { path?: string };

type WorkbitWidgetsPlugin = {
  update(options: { snapshot: string }): Promise<void>;
  clear(): Promise<void>;
  takeOpen(): Promise<OpenEvent>;
  addListener(event: "open", handler: (event: OpenEvent) => void): Promise<{ remove: () => Promise<void> }>;
  /** Android, from the app that shows the shift reminders with a button. */
  drawsReminders(): Promise<{ value: boolean }>;
  /** iPhone 17.2+: the token that lets the server start the shift's Live Activity. */
  liveActivityToken(): Promise<{ token?: string }>;
  addListener(event: "liveActivityToken", handler: (event: { token: string }) => void): Promise<{ remove: () => Promise<void> }>;
};

export async function nativeWidgets() {
  if (!isNativeApp()) return null;
  const { Capacitor, registerPlugin } = await import("@capacitor/core");
  if (!Capacitor.isPluginAvailable("WorkbitWidgets")) return null;
  return registerPlugin<WorkbitWidgetsPlugin>("WorkbitWidgets");
}

export async function refreshNativeWidgets() {
  try {
    const widgets = await nativeWidgets();
    if (!widgets) return;
    const response = await fetch("/api/widgets", { cache: "no-store" });
    if (!response.ok) return;
    await widgets.update({ snapshot: await response.text() });
  } catch (error) {
    console.error("[widgets] not refreshed", error);
  }
}

export async function appDrawsReminders() {
  try {
    const widgets = await nativeWidgets();
    return Boolean(widgets && (await widgets.drawsReminders()).value);
  } catch {
    return false;
  }
}

/** Hands the server the iPhone's Live Activity start token, now and whenever it changes. */
export async function registerLiveActivityToken() {
  const widgets = await nativeWidgets().catch(() => null);
  if (!widgets) return () => undefined;
  const send = (token?: string) => {
    if (!token) return;
    void fetch("/api/push/live-activity-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => undefined);
  };
  try {
    send((await widgets.liveActivityToken()).token);
  } catch {
    // An app from before the Live Activity start: nothing to hand over.
  }
  const handle = await widgets.addListener("liveActivityToken", (event) => send(event.token)).catch(() => null);
  return () => void handle?.remove();
}

export async function clearNativeWidgets() {
  try {
    await (await nativeWidgets())?.clear();
  } catch {
    // Nothing shown, nothing to clear.
  }
}

/** Told by whatever stamps, so the Live Activity starts or ends at once. */
export const CLOCK_CHANGED_EVENT = "workbit:clock-changed";

export function announceClockChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CLOCK_CHANGED_EVENT));
}

/**
 * A stamp asked for from outside the page: the icon's "Timbra", "Entra" or
 * "Esci" on a notification. Kept until the clock on Oggi takes it - it may
 * not be on screen yet - and only for a minute, so an old request never
 * stamps by surprise later.
 */
export const CLOCK_REQUEST_EVENT = "workbit:clock-request";

let clockRequest: { at: number; direction: ClockDirection } | null = null;

export function requestClock(direction: ClockDirection = "any") {
  clockRequest = { at: Date.now(), direction };
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CLOCK_REQUEST_EVENT));
}

export function takeClockRequest(): ClockDirection | null {
  const request = clockRequest && Date.now() - clockRequest.at < 60_000 ? clockRequest.direction : null;
  clockRequest = null;
  return request;
}
