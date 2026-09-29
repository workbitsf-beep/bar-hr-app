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
let installation: Promise<boolean> | null = null;

/**
 * Resolves true when passkeys can actually be used here.
 *
 * In a browser that is always the case. In the app it depends on the installed
 * build carrying the plugin, which an older build does not — and an Android web
 * view answers yes to the usual support checks while failing every real call,
 * so without this the buttons would look available and then refuse.
 */
export function ensureNativePasskeySupport(): Promise<boolean> {
  if (!isNativeApp()) {
    return Promise.resolve(true);
  }

  installation ??= install();

  return installation;
}

async function install() {
  try {
    const { CapacitorPasskey } = await import("@capgo/capacitor-passkey");

    await CapacitorPasskey.autoShimWebAuthn();

    return true;
  } catch (error) {
    console.error("[passkey] native bridge unavailable", error);

    return false;
  }
}

/**
 * Turns a failed passkey call into something worth reading.
 *
 * Where the detail sits depends on who refused. A browser throws a
 * DOMException whose name is the whole story and whose message is often empty;
 * a native plugin throws a plain Error named "Error" and puts the story in the
 * message. Keeping only one of the two loses the answer half the time, so both
 * are shown when they differ.
 */
/**
 * True when the person simply dismissed the prompt.
 *
 * A browser says so with a NotAllowedError. Android says so with a plain Error
 * whose message carries code 16, ERROR_USER_CANCELED, or 13 for the "cancel"
 * button - so without reading the message the app took a deliberate act for a
 * fault and showed the name of an Android class in red.
 */
export function isPasskeyCancelled(error: unknown) {
  if (error instanceof Error && error.name === "NotAllowedError") {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error ?? "");

  return /\[(10|13|16)\]|cancel|annull|abort/i.test(message);
}

export function describePasskeyFailure(error: unknown, action: "registrazione" | "accesso") {
  if (isPasskeyCancelled(error)) {
    return action === "registrazione"
      ? "Registrazione annullata."
      : "Accesso annullato. Entra con la password.";
  }

  const sentence =
    action === "registrazione"
      ? "Il dispositivo non ha completato la registrazione biometrica"
      : "Il dispositivo non ha completato l'accesso biometrico";

  const detail = describeError(error);

  return detail ? `${sentence} (${detail}).` : `${sentence}.`;
}

function describeError(error: unknown) {
  if (!(error instanceof Error)) {
    return typeof error === "string" ? error : "";
  }

  const parts = [error.name, error.message].filter(Boolean);

  return [...new Set(parts)].join(": ");
}
