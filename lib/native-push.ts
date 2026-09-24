"use client";

/**
 * Push inside the native shell.
 *
 * Web push runs on a browser API that does not exist inside an Android or iOS
 * web view, so the installed app has to register with the operating system
 * instead. The server is unchanged: it already sends a generic notification
 * block, which Firebase delivers to native devices as well as browsers.
 */

export type NativePushOutcome =
  | { status: "not-native" }
  | { status: "no-bridge" }
  | { status: "denied" }
  | { status: "registered"; token: string }
  | { status: "failed"; reason: string };

/** True only inside the installed app, never in a normal browser tab. */
export function isNativeApp() {
  if (typeof window === "undefined") {
    return false;
  }

  const capacitor = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;

  return Boolean(capacitor?.isNativePlatform?.());
}

export async function registerNativePush(): Promise<NativePushOutcome> {
  if (!isNativeApp()) {
    return { status: "not-native" };
  }

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const current = await PushNotifications.checkPermissions();
    const decision =
      current.receive === "granted" ? current : await PushNotifications.requestPermissions();

    if (decision.receive !== "granted") {
      return { status: "denied" };
    }

    const token = await new Promise<string | null>((resolve) => {
      // The token arrives through an event rather than a return value, so give
      // the registration a bounded window before reporting it as failed.
      const timer = window.setTimeout(() => resolve(null), 15000);

      void PushNotifications.addListener("registration", (value) => {
        window.clearTimeout(timer);
        resolve(value.value);
      });

      void PushNotifications.addListener("registrationError", () => {
        window.clearTimeout(timer);
        resolve(null);
      });

      void PushNotifications.register();
    });

    if (!token) {
      return { status: "failed", reason: "Nessun token restituito dal sistema." };
    }

    const response = await fetch("/api/push/register-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ token, platform: "android-native" }),
    });

    if (!response.ok) {
      return { status: "failed", reason: `Il server ha risposto ${response.status}.` };
    }

    return { status: "registered", token };
  } catch (error) {
    // Most likely the native bridge is not reachable from this page, which is
    // worth surfacing rather than silently having no notifications.
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "Errore imprevisto.",
    };
  }
}
