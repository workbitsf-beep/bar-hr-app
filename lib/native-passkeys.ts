"use client";

import { isNativeApp } from "./native-app";

/**
 * Makes passkeys work inside the installed app.
 *
 * A browser offers passkeys through `navigator.credentials`, but the web view
 * the app runs in does not implement that API at all — which is why the
 * biometric login worked on the site and was missing in the app. The plugin
 * puts the same API back in place and forwards each call to the phone's own
 * credential manager, so every piece of passkey code in this project keeps
 * working unchanged.
 *
 * The install runs once per page and is awaited by whoever needs it, because
 * the checks in the passkey components run on mount and would otherwise read a
 * web view that has not been patched yet.
 */
let installation: Promise<void> | null = null;

export function ensureNativePasskeySupport(): Promise<void> {
  if (!isNativeApp()) {
    return Promise.resolve();
  }

  installation ??= install();

  return installation;
}

async function install() {
  try {
    const { CapacitorPasskey } = await import("@capgo/capacitor-passkey");

    await CapacitorPasskey.autoShimWebAuthn();
  } catch (error) {
    // Nothing to recover: the passkey buttons find no support and stay
    // disabled, leaving email and password as the way in.
    console.error("[passkey] native bridge unavailable", error);
  }
}
