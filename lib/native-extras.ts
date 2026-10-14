"use client";

/**
 * What the installed app does that a website cannot: a tap felt in the hand,
 * files handed to the phone's own share sheet, the count on the app icon,
 * the "Timbra" shortcut on the icon, and a small store the offline page can
 * read (it is served from the app itself, not from app.workbit.it, so it
 * cannot see the site's localStorage).
 *
 * Every helper does nothing outside the app and never throws: none of this
 * may stand in the way of the action it accompanies.
 */

import { isNativeApp } from "./native-app";

export { isNativeApp };

/** A short vibration: "done" for a stamp, "warning" for a refusal. */
export async function haptic(kind: "success" | "warning" | "light" = "light") {
  if (!isNativeApp()) return;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
    if (kind === "light") {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else {
      await Haptics.notification({ type: kind === "success" ? NotificationType.Success : NotificationType.Warning });
    }
  } catch {
    // A phone without a vibration motor, or an old build: nothing to feel.
  }
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Hands a file to the phone's share sheet (WhatsApp, Mail, File...). Returns
 * false when it could not, so the caller falls back to opening the link.
 */
export async function shareFileFromUrl(url: string, fileName: string, title: string) {
  if (!isNativeApp()) return false;
  try {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) return false;
    const data = await blobToBase64(await response.blob());
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const safeName = fileName.replace(/[^\w.\- ]+/g, "_") || "documento";
    const written = await Filesystem.writeFile({ path: safeName, data, directory: Directory.Cache });
    const { Share } = await import("@capacitor/share");
    await Share.share({ title, files: [written.uri], dialogTitle: title });
    return true;
  } catch (error) {
    // Closing the sheet without choosing is not a failure.
    const message = error instanceof Error ? error.message : String(error);
    return /cancel/i.test(message);
  }
}

/** The red count on the app icon: requests and forgotten stamps to answer. */
export async function setAppBadge(count: number) {
  if (!isNativeApp()) return;
  try {
    const { Badge } = await import("@capawesome/capacitor-badge");
    if (count > 0) {
      const permission = await Badge.checkPermissions();
      if (permission.display !== "granted") await Badge.requestPermissions();
      await Badge.set({ count });
    } else {
      await Badge.clear();
    }
  } catch {
    // The count is a courtesy: no permission, no count.
  }
}

/** A small native key-value store, shared with the offline page. */
export async function nativeGet<T>(key: string): Promise<T | null> {
  if (!isNativeApp()) return null;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key });
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

export async function nativeSet(key: string, value: unknown) {
  if (!isNativeApp()) return;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    if (value === null) await Preferences.remove({ key });
    else await Preferences.set({ key, value: JSON.stringify(value) });
  } catch {
    // Without the store the offline page simply has nothing to offer.
  }
}

/**
 * The "Timbra" action on the app icon (long press). A tap opens Oggi with
 * ?azione=timbra, where the stamp button runs by itself.
 */
export async function setupClockShortcut(enabled: boolean, onClick: () => void) {
  if (!isNativeApp()) return () => {};
  try {
    const { AppShortcuts } = await import("@capawesome/capacitor-app-shortcuts");
    if (enabled) {
      await AppShortcuts.set({
        shortcuts: [{ id: "timbra", title: "Timbra", description: "Entrata o uscita" }],
      });
    } else {
      await AppShortcuts.clear();
    }
    const handle = await AppShortcuts.addListener("click", (event) => {
      if (event.shortcutId === "timbra") onClick();
    });
    return () => void handle.remove();
  } catch {
    return () => {};
  }
}
