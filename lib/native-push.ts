"use client";

/**
 * Push inside the native shell.
 *
 * Web push runs on a browser API that does not exist inside an Android or iOS
 * web view, so the installed app has to register with the operating system
 * instead. The server is unchanged: it already sends a generic notification
 * block, which Firebase delivers to native devices as well as browsers.
 *
 * Both phones go through the Firebase messaging plugin, which returns a
 * Firebase token on Android and on iOS alike. The plain push plugin handed an
 * iPhone's raw Apple token to a server that can only send through Firebase.
 */

import { isNativeApp } from "./native-app";

export { isNativeApp };

export type NativePushOutcome =
  | { status: "not-native" }
  | { status: "no-bridge" }
  | { status: "denied" }
  | { status: "registered"; token: string }
  | { status: "failed"; reason: string };

/**
 * Only the question, without waiting for the token. The token can take many
 * seconds on an iPhone (it waits for Apple first), and the location question
 * that follows used to wait behind it: by then the person had moved on and
 * never saw it. Ask both, one after the other, then fetch the token.
 */
export async function askNativePushPermission(): Promise<boolean> {
  if (!isNativeApp()) {
    return false;
  }

  try {
    const { Capacitor, registerPlugin } = await import("@capacitor/core");

    if (Capacitor.isPluginAvailable("FirebaseMessaging")) {
      const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
      const current = await FirebaseMessaging.checkPermissions();
      const decision = current.receive === "granted" ? current : await FirebaseMessaging.requestPermissions();
      return decision.receive === "granted";
    }

    if (Capacitor.isPluginAvailable("PushNotifications")) {
      const PushNotifications = registerPlugin<LegacyPushPlugin>("PushNotifications");
      const current = await PushNotifications.checkPermissions();
      const decision = current.receive === "granted" ? current : await PushNotifications.requestPermissions();
      return decision.receive === "granted";
    }
  } catch (error) {
    console.error("[permissions] notification request failed", error);
  }

  return false;
}

export async function registerNativePush(): Promise<NativePushOutcome> {
  if (!isNativeApp()) {
    return { status: "not-native" };
  }

  try {
    const [{ FirebaseMessaging }, { Capacitor }] = await Promise.all([
      import("@capacitor-firebase/messaging"),
      import("@capacitor/core"),
    ]);

    // The page comes from the server, the shell from the store: an app
    // installed before the switch has the old push plugin and not this one.
    // It keeps registering the old way until it is updated.
    if (!Capacitor.isPluginAvailable("FirebaseMessaging")) {
      return registerWithLegacyPlugin(Capacitor);
    }

    const current = await FirebaseMessaging.checkPermissions();
    const decision =
      current.receive === "granted" ? current : await FirebaseMessaging.requestPermissions();

    if (decision.receive !== "granted") {
      return { status: "denied" };
    }

    // Bounded: on an iPhone the token waits for Apple first, and a phone that
    // never gets one should be reported rather than leave the caller hanging.
    const token = await Promise.race([
      FirebaseMessaging.getToken()
        .then((result) => result.token || null)
        .catch(() => null),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 15000)),
    ]);

    return sendToken(token, Capacitor.getPlatform());
  } catch (error) {
    // Most likely the native bridge is not reachable from this page, which is
    // worth surfacing rather than silently having no notifications.
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "Errore imprevisto.",
    };
  }
}

type CapacitorRuntime = typeof import("@capacitor/core").Capacitor;

type LegacyPushPlugin = {
  checkPermissions(): Promise<{ receive: string }>;
  requestPermissions(): Promise<{ receive: string }>;
  register(): Promise<void>;
  addListener(
    event: "registration" | "registrationError",
    callback: (value: { value?: string }) => void
  ): Promise<unknown>;
};

/** The flow of @capacitor/push-notifications, for shells that still carry it. */
async function registerWithLegacyPlugin(capacitor: CapacitorRuntime): Promise<NativePushOutcome> {
  if (!capacitor.isPluginAvailable("PushNotifications")) {
    return { status: "no-bridge" };
  }

  const { registerPlugin } = await import("@capacitor/core");
  const PushNotifications = registerPlugin<LegacyPushPlugin>("PushNotifications");

  const current = await PushNotifications.checkPermissions();
  const decision =
    current.receive === "granted" ? current : await PushNotifications.requestPermissions();

  if (decision.receive !== "granted") {
    return { status: "denied" };
  }

  const token = await new Promise<string | null>((resolve) => {
    const timer = window.setTimeout(() => resolve(null), 15000);

    void PushNotifications.addListener("registration", (value) => {
      window.clearTimeout(timer);
      resolve(value.value ?? null);
    });

    void PushNotifications.addListener("registrationError", () => {
      window.clearTimeout(timer);
      resolve(null);
    });

    void PushNotifications.register();
  });

  return sendToken(token, capacitor.getPlatform());
}

async function sendToken(token: string | null, platform: string): Promise<NativePushOutcome> {
  if (!token) {
    return { status: "failed", reason: "Nessun token restituito dal sistema." };
  }

  const response = await fetch("/api/push/register-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    // Kept apart per platform: the server keeps one token per person and
    // platform, so an iPhone and an Android phone both ring.
    body: JSON.stringify({ token, platform: `${platform}-native` }),
  });

  if (!response.ok) {
    return { status: "failed", reason: `Il server ha risposto ${response.status}.` };
  }

  return { status: "registered", token };
}
