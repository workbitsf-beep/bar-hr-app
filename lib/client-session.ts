"use client";

const PERSISTENT_SESSION_KEY = "token";
const PERSISTENT_SESSION_MARKER = "cookie-session";

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
