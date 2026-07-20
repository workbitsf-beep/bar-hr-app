import { getFirebasePublicConfig } from "@/lib/firebase-public-config";

function buildNoopServiceWorker() {
  return `self.addEventListener("install", function(event) {
  self.skipWaiting();
});

self.addEventListener("activate", function(event) {
  event.waitUntil(self.clients.claim());
});`;
}

function buildFirebaseServiceWorkerScript() {
  const config = getFirebasePublicConfig();

  if (!config) {
    return buildNoopServiceWorker();
  }

  return `
importScripts("https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js");

firebase.initializeApp(${JSON.stringify({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
    ...(config.measurementId ? { measurementId: config.measurementId } : {}),
  })});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const notification = payload && payload.notification ? payload.notification : {};
  const data = payload && payload.data ? payload.data : {};
  if (notification && (notification.title || notification.body)) {
    return;
  }

  const title = data.title || notification.title || "Workbit";
  const options = {
    body: data.body || notification.body || "",
    icon: "/logo.png",
    badge: "/logo.png",
    tag: data.type && data.actionUrl ? data.type + ":" + data.actionUrl : undefined,
    renotify: false,
    data: data,
  };

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", function(event) {
  event.notification.close();

  const notificationData = event.notification && event.notification.data ? event.notification.data : {};
  const firebaseData = notificationData.FCM_MSG && notificationData.FCM_MSG.data
    ? notificationData.FCM_MSG.data
    : {};
  const data = Object.assign({}, firebaseData, notificationData);
  const actionUrl =
    event.action === "clock-in"
      ? data.clockInUrl || data.actionUrl || "/dashboard?clock=1&clockAction=in"
      : event.action === "clock-out"
        ? data.clockOutUrl || data.actionUrl || "/dashboard?clock=1&clockAction=out"
        : data.actionUrl || "/dashboard";

  function selectNotificationBarIfNeeded() {
    if (!data.barId) {
      return Promise.resolve();
    }

    return fetch("/api/bars/select", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({ barId: data.barId }),
    }).catch(function() {
      return null;
    });
  }

  event.waitUntil(
    selectNotificationBarIfNeeded().then(function() {
      return self.clients.matchAll({ type: "window", includeUncontrolled: true });
    }).then(function(clients) {
      for (const client of clients) {
        if ("navigate" in client && "url" in client && client.url && client.url.indexOf(actionUrl) !== -1) {
          return client.focus ? client.focus() : client;
        }
      }

      for (const client of clients) {
        if ("navigate" in client) {
          return client.navigate(actionUrl).then(function(navigatedClient) {
            return navigatedClient && navigatedClient.focus ? navigatedClient.focus() : navigatedClient;
          });
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(actionUrl);
      }

      return null;
    })
  );
});

self.addEventListener("install", function(event) {
  self.skipWaiting();
});

self.addEventListener("activate", function(event) {
  event.waitUntil(self.clients.claim());
});
`;
}

export async function GET() {
  return new Response(buildFirebaseServiceWorkerScript(), {
    status: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store, max-age=0",
    },
  });
}
