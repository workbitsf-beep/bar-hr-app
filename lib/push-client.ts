"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

type PublicPushConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
  measurementId?: string;
};

type PushRegistrationResult = {
  ok: boolean;
  enabled: boolean;
  registered: boolean;
  message: string;
};

type PushConfigResponse = {
  ok: boolean;
  enabled: boolean;
  config?: PublicPushConfig | null;
  message?: string;
};

let registrationPromise: Promise<PushRegistrationResult> | null = null;
const PUSH_DISABLED_STORAGE_KEY = "workbit.push.disabled";

export function isWorkbitPushDisabled() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(PUSH_DISABLED_STORAGE_KEY) === "1";
}

export function getWorkbitPushPermissionState() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  return Notification.permission;
}

function setWorkbitPushDisabled(disabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  if (disabled) {
    window.localStorage.setItem(PUSH_DISABLED_STORAGE_KEY, "1");
    return;
  }

  window.localStorage.removeItem(PUSH_DISABLED_STORAGE_KEY);
}

async function loadPushConfig() {
  const response = await fetch("/api/push/config", {
    credentials: "same-origin",
  });
  const payload = (await response.json().catch(() => null)) as PushConfigResponse | null;

  if (!response.ok || !payload?.ok || !payload.enabled || !payload.config) {
    return null;
  }

  return payload.config;
}

function getOrCreateFirebaseApp(config: PublicPushConfig) {
  return getApps().length > 0
    ? getApp()
    : initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
        measurementId: config.measurementId,
      });
}

function getBrowserPlatform() {
  if (typeof navigator === "undefined") {
    return "web";
  }

  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes("iphone") || userAgent.includes("ipad") || userAgent.includes("ipod")) {
    return "ios";
  }

  if (userAgent.includes("android")) {
    return "android";
  }

  return "web";
}

async function registerToken(token: string) {
  setWorkbitPushDisabled(false);

  const response = await fetch("/api/push/register-token", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({
      token,
      platform: getBrowserPlatform(),
    }),
  });

  if (!response.ok) {
    throw new Error("Impossibile registrare il token push.");
  }
}

export async function disableWorkbitPushRegistration(): Promise<PushRegistrationResult> {
  setWorkbitPushDisabled(true);

  const response = await fetch("/api/push/register-token", {
    method: "DELETE",
    credentials: "same-origin",
  });

  if (!response.ok) {
    return {
      ok: false,
      enabled: false,
      registered: false,
      message: "Impossibile disattivare le notifiche push.",
    };
  }

  return {
    ok: true,
    enabled: false,
    registered: false,
    message: "Notifiche push disattivate su questo dispositivo.",
  };
}

export async function ensureWorkbitPushRegistration(options?: {
  requestPermission?: boolean;
}): Promise<PushRegistrationResult> {
  if (typeof window === "undefined") {
    return {
      ok: false,
      enabled: false,
      registered: false,
      message: "Push non disponibili.",
    };
  }

  if (registrationPromise) {
    return registrationPromise;
  }

  registrationPromise = (async () => {
    const wantPermission = options?.requestPermission ?? false;

    if (isWorkbitPushDisabled() && !wantPermission) {
      return {
        ok: true,
        enabled: false,
        registered: false,
        message: "Notifiche push disattivate su questo dispositivo.",
      };
    }

    if (wantPermission) {
      setWorkbitPushDisabled(false);
    }

    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
      return {
        ok: false,
        enabled: false,
        registered: false,
        message: "Push non supportate da questo browser.",
      };
    }

    if (Notification.permission !== "granted") {
      if (!wantPermission) {
        return {
          ok: true,
          enabled: false,
          registered: false,
          message: "Notifiche push non abilitate.",
        };
      }

      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        return {
          ok: false,
          enabled: false,
          registered: false,
          message:
            permission === "denied"
              ? "Notifiche bloccate dal browser. Riattivale dalle impostazioni del sito e riprova."
              : "Permesso notifiche non concesso.",
        };
      }
    }

    const config = await loadPushConfig();

    if (!config) {
      return {
        ok: true,
        enabled: false,
        registered: false,
        message: "Firebase non configurato. Restano attive le notifiche interne.",
      };
    }

    const supported = await isSupported().catch(() => false);

    if (!supported) {
      return {
        ok: false,
        enabled: true,
        registered: false,
        message: "Messaging non supportato in questo browser.",
      };
    }

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
    });
    const app = getOrCreateFirebaseApp(config);
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      return {
        ok: false,
        enabled: true,
        registered: false,
        message: "Impossibile ottenere il token push.",
      };
    }

    await registerToken(token);

    return {
      ok: true,
      enabled: true,
      registered: true,
      message: "Notifiche push attive.",
    };
  })().finally(() => {
    registrationPromise = null;
  });

  return registrationPromise;
}
