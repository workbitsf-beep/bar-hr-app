import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

type FirebaseAdminConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  privateKeyId?: string;
};

let cachedApp: App | null = null;

function parseFirebaseAdminConfig(): FirebaseAdminConfig | null {
  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

  if (serviceAccountRaw) {
    try {
      const serviceAccount = JSON.parse(serviceAccountRaw) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
        private_key_id?: string;
      };

      const projectId = serviceAccount.project_id?.trim();
      const clientEmail = serviceAccount.client_email?.trim();
      const privateKey = serviceAccount.private_key?.trim().replace(/\\n/g, "\n");

      if (projectId && clientEmail && privateKey) {
        return {
          projectId,
          clientEmail,
          privateKey,
          privateKeyId: serviceAccount.private_key_id?.trim() || undefined,
        };
      }
    } catch (error) {
      console.error("[push] Invalid FIREBASE_SERVICE_ACCOUNT_JSON.", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim().replace(/\\n/g, "\n");
  const privateKeyId = process.env.FIREBASE_PRIVATE_KEY_ID?.trim() || undefined;

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey,
    privateKeyId,
  };
}

export function getFirebaseAdminApp(): App | null {
  if (cachedApp) {
    return cachedApp;
  }

  const existingApp = getApps()[0];

  if (existingApp) {
    cachedApp = existingApp;
    return cachedApp;
  }

  const config = parseFirebaseAdminConfig();

  if (!config) {
    return null;
  }

  cachedApp = initializeApp({
    credential: cert({
      projectId: config.projectId,
      clientEmail: config.clientEmail,
      privateKey: config.privateKey,
      ...(config.privateKeyId ? { privateKeyId: config.privateKeyId } : {}),
    }),
    projectId: config.projectId,
  });

  return cachedApp;
}

export function getMessagingService() {
  const app = getFirebaseAdminApp();

  if (!app) {
    return null;
  }

  return getMessaging(app);
}
