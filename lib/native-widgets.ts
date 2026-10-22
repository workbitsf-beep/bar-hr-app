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

import { isNativeApp } from "./native-app";

type OpenEvent = { path?: string };

type WorkbitWidgetsPlugin = {
  update(options: { snapshot: string }): Promise<void>;
  clear(): Promise<void>;
  takeOpen(): Promise<OpenEvent>;
  addListener(event: "open", handler: (event: OpenEvent) => void): Promise<{ remove: () => Promise<void> }>;
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
let clockRequestedAt = 0;

export function requestClock() {
  clockRequestedAt = Date.now();
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CLOCK_REQUEST_EVENT));
}

export function takeClockRequest() {
  const fresh = Date.now() - clockRequestedAt < 60_000;
  clockRequestedAt = 0;
  return fresh;
}
