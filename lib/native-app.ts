"use client";

/**
 * True only inside the installed app, never in a normal browser tab.
 *
 * The bridge is injected by the native shell, so this is the one reliable
 * signal that device capabilities are reachable.
 */
export function isNativeApp() {
  if (typeof window === "undefined") {
    return false;
  }

  const capacitor = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;

  return Boolean(capacitor?.isNativePlatform?.());
}
