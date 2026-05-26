"use client";

const PERSISTENT_SESSION_KEY = "token";
const PERSISTENT_SESSION_MARKER = "cookie-session";
const REMEMBERED_EMAIL_KEY = "remembered-email";

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
