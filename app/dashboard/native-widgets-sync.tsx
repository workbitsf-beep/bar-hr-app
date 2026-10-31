"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNativeApp } from "@/lib/native-app";
import { type ClockDirection, clockDirectionOf } from "@/lib/clock-request";
import {
  CLOCK_CHANGED_EVENT,
  nativeWidgets,
  refreshNativeWidgets,
  registerLiveActivityToken,
  requestClock,
} from "@/lib/native-widgets";

/**
 * Inside the installed app only: keeps the home screen widgets and the Live
 * Activity in step with the shifts and the stamps - refreshed when the app
 * opens, when it comes back to the front, and right after a stamp - and
 * follows the app being opened from them or from a notification.
 *
 * "Entra" / "Esci" (on a reminder, on the Live Activity, on Android's
 * "In servizio" notification) stamp straight away on Oggi; a plain tap on a
 * notification opens its page.
 */
export function NativeWidgetsSync() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;

    function open(path: string, direction: ClockDirection = "any") {
      if (path.includes("azione=timbra")) {
        // Android's reminder says which way in the address ("dir=in").
        const said = new URLSearchParams(path.split("?")[1] ?? "").get("dir");
        requestClock(said === "in" || said === "out" ? said : direction);
        if (window.location.pathname !== "/dashboard") router.push("/dashboard");
        return;
      }
      router.push(path);
    }

    async function selectVenue(barId: unknown) {
      if (typeof barId !== "string" || !barId) return;
      await fetch("/api/bars/select", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ barId }),
      }).catch(() => null);
    }

    void refreshNativeWidgets();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshNativeWidgets();
    };
    const onClock = () => void refreshNativeWidgets();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(CLOCK_CHANGED_EVENT, onClock);

    const removers: Array<() => void> = [];
    void registerLiveActivityToken().then((remove) => removers.push(remove));

    void nativeWidgets().then(async (widgets) => {
      if (!widgets) return;
      const pending = await widgets.takeOpen().catch(() => ({}) as { path?: string });
      if (pending.path) open(pending.path);
      const handle = await widgets.addListener("open", (event) => {
        if (event.path) open(event.path);
      });
      removers.push(() => void handle.remove());
    });

    void (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isPluginAvailable("FirebaseMessaging")) return;
      const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
      const handle = await FirebaseMessaging.addListener("notificationActionPerformed", async (event) => {
        const data = (event.notification?.data ?? {}) as Record<string, unknown>;
        await selectVenue(data.barId);
        // "Entra" / "Esci" on the reminder - or a plain tap on it: a reminder
        // to stamp is opened to stamp. The auto-closed exit and the owner's
        // "ha timbrato" notices are other types and just open their page.
        const direction = clockDirectionOf(typeof data.type === "string" ? data.type : "", event.actionId);
        if (direction) {
          open("/dashboard?azione=timbra", direction);
          return;
        }
        // A full load, not router.push: right after a cold start the router
        // may still be hydrating and drop the push, and the venue may just
        // have changed under a layout rendered for the old one.
        const target = typeof data.actionUrl === "string" && data.actionUrl.startsWith("/") ? data.actionUrl : null;
        if (target) window.location.assign(target);
        else router.refresh();
      });
      removers.push(() => void handle.remove());
    })().catch(() => undefined);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(CLOCK_CHANGED_EVENT, onClock);
      for (const remove of removers) remove();
    };
  }, [router]);

  return null;
}
