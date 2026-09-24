"use client";

import { isNativeApp } from "./native-app";

/**
 * Unlocking the installed app with a fingerprint or face.
 *
 * This is not the same thing as a passkey. A passkey is a credential the
 * server verifies, and Android web views do not expose that API at all. What
 * the device can offer inside an app is a lock: the session stays signed in
 * and the phone checks it is really you before the app is shown. Day to day it
 * is the same gesture; the difference is that the check happens on the device.
 */

const ENABLED_KEY = "workbit.biometric-lock";
const UNLOCKED_KEY = "workbit.biometric-unlocked";

/**
 * Whether this run of the app has already been unlocked. Kept in session
 * storage so it survives the page reloads that every navigation causes, and
 * disappears when the app is closed — asked once on opening, not per screen.
 */
export function wasUnlockedThisRun() {
  try {
    return window.sessionStorage.getItem(UNLOCKED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markUnlockedForThisRun() {
  try {
    window.sessionStorage.setItem(UNLOCKED_KEY, "1");
  } catch {
    // Without storage the lock simply asks again on the next screen.
  }
}

export function isBiometricLockEnabled() {
  try {
    return window.localStorage.getItem(ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setBiometricLockEnabled(enabled: boolean) {
  try {
    if (enabled) {
      window.localStorage.setItem(ENABLED_KEY, "1");
    } else {
      window.localStorage.removeItem(ENABLED_KEY);
    }
  } catch {
    // Storage can be unavailable; the lock simply stays off.
  }
}

export async function getBiometryStatus(): Promise<{ available: boolean; label: string }> {
  if (!isNativeApp()) {
    return { available: false, label: "" };
  }

  try {
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
    const info = await BiometricAuth.checkBiometry();

    return {
      available: Boolean(info.isAvailable),
      label: info.isAvailable ? "" : info.reason || "Nessuna impronta registrata su questo telefono.",
    };
  } catch {
    return { available: false, label: "Sblocco biometrico non disponibile." };
  }
}

export async function verifyBiometry(reason: string) {
  if (!isNativeApp()) {
    return false;
  }

  try {
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");

    await BiometricAuth.authenticate({
      reason,
      androidTitle: "Workbit",
      androidSubtitle: reason,
      cancelTitle: "Annulla",
      // Lets someone who cannot use the sensor fall back to the phone's PIN
      // rather than being locked out of their own shift.
      allowDeviceCredential: true,
    });

    return true;
  } catch {
    return false;
  }
}
