"use client";

import { isNativeApp } from "./native-app";
import { registerNativePush } from "./native-push";

/**
 * Asks the phone for what Workbit needs, once someone is actually inside.
 *
 * Nothing is asked at launch any more. A permission request that arrives
 * before the login screen has no context: the person has not yet seen what the
 * app does, and the easiest answer to a question you do not understand is no —
 * which on Android is close to permanent.
 *
 * The two requests are made one after the other on purpose. Android shows a
 * single system dialog at a time and quietly drops whatever arrives while one
 * is open, so firing both together loses one of them.
 */
export async function requestNativePermissionsAfterLogin() {
  if (!isNativeApp()) {
    return;
  }

  // Notifications first: this also refreshes the device token, so it runs on
  // every sign-in rather than only the first.
  await registerNativePush().catch(() => undefined);

  await requestLocationIfStillUndecided();
}

/**
 * The operating system already remembers the answer, so it is the only record
 * worth consulting — asking again after a refusal would show nothing anyway.
 */
async function requestLocationIfStillUndecided() {
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    const current = await Geolocation.checkPermissions();

    if (current.location === "prompt" || current.location === "prompt-with-rationale") {
      await Geolocation.requestPermissions({ permissions: ["location"] });
    }
  } catch (error) {
    // Clock-in asks again at the moment it needs a position, so a failure here
    // costs nothing.
    console.error("[permissions] location request failed", error);
  }
}
