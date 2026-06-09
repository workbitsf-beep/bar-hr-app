import "server-only";

export type FirebasePublicConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
  measurementId?: string;
};

function parseJsonConfig(raw: string): FirebasePublicConfig | null {
  try {
    const parsed = JSON.parse(raw) as Partial<FirebasePublicConfig>;

    if (
      typeof parsed.apiKey === "string" &&
      typeof parsed.authDomain === "string" &&
      typeof parsed.projectId === "string" &&
      typeof parsed.messagingSenderId === "string" &&
      typeof parsed.appId === "string" &&
      typeof parsed.vapidKey === "string"
    ) {
      return {
        apiKey: parsed.apiKey.trim(),
        authDomain: parsed.authDomain.trim(),
        projectId: parsed.projectId.trim(),
        messagingSenderId: parsed.messagingSenderId.trim(),
        appId: parsed.appId.trim(),
        vapidKey: parsed.vapidKey.trim(),
        measurementId: typeof parsed.measurementId === "string" ? parsed.measurementId.trim() : undefined,
      };
    }
  } catch (error) {
    console.error("[push] Invalid Firebase web config JSON.", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return null;
}

export function getFirebasePublicConfig(): FirebasePublicConfig | null {
  const jsonConfig =
    process.env.FIREBASE_WEB_CONFIG_JSON?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_CONFIG_JSON?.trim();

  if (jsonConfig) {
    const parsed = parseJsonConfig(jsonConfig);

    if (parsed) {
      return parsed;
    }
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim();
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim();
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
  const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim();

  if (
    !apiKey ||
    !authDomain ||
    !projectId ||
    !messagingSenderId ||
    !appId ||
    !vapidKey
  ) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    messagingSenderId,
    appId,
    vapidKey,
    ...(measurementId ? { measurementId } : {}),
  };
}
