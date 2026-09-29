"use client";

const PERSISTENT_SESSION_KEY = "token";
const PERSISTENT_SESSION_MARKER = "cookie-session";
const REMEMBERED_EMAIL_KEY = "remembered-email";
const REMEMBERED_NAME_KEY = "workbit-remembered-name";
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

/**
 * The first name of whoever logged in last on this device.
 *
 * Kept beside the remembered address so the login screen can greet the person
 * by name instead of showing them a form to fill in with what it already
 * knows. It is a courtesy, never a credential: an empty one only costs a
 * plainer greeting.
 */
export function rememberLoginName(firstName: string) {
  try {
    const normalized = firstName.trim();

    if (!normalized) {
      localStorage.removeItem(REMEMBERED_NAME_KEY);
      return;
    }

    localStorage.setItem(REMEMBERED_NAME_KEY, normalized);
  } catch {
    // Keep login working even if storage is unavailable.
  }
}

export function getRememberedLoginName() {
  try {
    return localStorage.getItem(REMEMBERED_NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function clearRememberedLoginName() {
  try {
    localStorage.removeItem(REMEMBERED_NAME_KEY);
  } catch {
    // Ignore storage cleanup failures.
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
