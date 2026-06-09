"use client";

const PERSISTENT_SESSION_KEY = "token";
const PERSISTENT_SESSION_MARKER = "cookie-session";
const REMEMBERED_EMAIL_KEY = "remembered-email";
const PASSKEY_PREFERRED_KEY = "workbit-passkey-preferred";
const PASSKEY_SETUP_PENDING_KEY = "workbit-passkey-setup-pending";

export function markPersistentSession() {
  try {
    localStorage.setItem(PERSISTENT_SESSION_KEY, PERSISTENT_SESSION_MARKER);
  } catch {
    // Storage can be unavailable in private browsing or restricted webviews.
  }
}

export function clearPersistentSession() {
  try {
    localStorage.removeItem(PERSISTENT_SESSION_KEY);
  } catch {
    // Logout still revokes the httpOnly server session even if storage fails.
  }
}

export function hasPersistentSessionMarker() {
  try {
    return localStorage.getItem(PERSISTENT_SESSION_KEY) === PERSISTENT_SESSION_MARKER;
  } catch {
    return false;
  }
}

export function rememberLoginEmail(email: string) {
  try {
    const normalized = email.trim().toLowerCase();

    if (!normalized) {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      return;
    }

    localStorage.setItem(REMEMBERED_EMAIL_KEY, normalized);
  } catch {
    // Keep login working even if storage is unavailable.
  }
}

export function clearRememberedLoginEmail() {
  try {
    localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function getRememberedLoginEmail() {
  try {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function markPasskeyPreferred() {
  try {
    localStorage.setItem(PASSKEY_PREFERRED_KEY, "1");
  } catch {
    // Ignore storage failures.
  }
}

export function clearPasskeyPreferred() {
  try {
    localStorage.removeItem(PASSKEY_PREFERRED_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function hasPasskeyPreferred() {
  try {
    return localStorage.getItem(PASSKEY_PREFERRED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markPasskeySetupPending() {
  try {
    localStorage.setItem(PASSKEY_SETUP_PENDING_KEY, "1");
  } catch {
    // Ignore storage failures.
  }
}

export function clearPasskeySetupPending() {
  try {
    localStorage.removeItem(PASSKEY_SETUP_PENDING_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function hasPasskeySetupPending() {
  try {
    return localStorage.getItem(PASSKEY_SETUP_PENDING_KEY) === "1";
  } catch {
    return false;
  }
}
