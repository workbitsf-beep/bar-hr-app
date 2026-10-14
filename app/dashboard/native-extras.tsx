"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { showAppToast } from "@/app/components/app-toast";
import { haptic, isNativeApp, setAppBadge, setupClockShortcut } from "@/lib/native-extras";
import { flushQueuedStamps } from "@/lib/offline-clock-queue";

/**
 * Inside the installed app only: stamps made without network go out as soon
 * as it is back, the icon carries the count of unread notifications, a long
 * press on the icon offers "Timbra", and pulling Oggi down refreshes it.
 * Nothing of this runs in a browser.
 */
export function NativeExtras({ canClock }: { canClock: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;

    async function flush() {
      const result = await flushQueuedStamps();
      for (const refusal of result.refused) showAppToast(refusal, "error");
      if (result.sent > 0) {
        showAppToast(
          result.sent === 1 ? "Timbratura senza rete registrata." : `${result.sent} timbrature senza rete registrate.`
        );
        router.refresh();
      }
    }

    void flush();
    const onVisible = () => {
      if (document.visibilityState === "visible") void flush();
    };
    const onUnread = (event: Event) => void setAppBadge(Number((event as CustomEvent<number>).detail) || 0);
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("workbit:notifications-unread", onUnread);

    let removeShortcut = () => {};
    void setupClockShortcut(canClock, () => router.push("/dashboard?azione=timbra")).then((remove) => {
      removeShortcut = remove;
    });

    return () => {
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("workbit:notifications-unread", onUnread);
      removeShortcut();
    };
  }, [canClock, router]);

  return <PullToRefresh />;
}

const PULL_TRIGGER = 72;

/** Pull the page down from the top to reload it, as in any phone app. */
function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<number | null>(null);
  const armed = useRef(false);

  useEffect(() => {
    if (!isNativeApp()) return;

    function atTop(target: EventTarget | null) {
      if (document.querySelector('[role="dialog"]')) return false;
      if ((document.scrollingElement?.scrollTop ?? 0) > 0) return false;
      for (let node = target as HTMLElement | null; node && node !== document.body; node = node.parentElement) {
        if (node.scrollTop > 0) return false;
      }
      return true;
    }

    function onStart(event: TouchEvent) {
      start.current = event.touches.length === 1 && atTop(event.target) ? event.touches[0].clientY : null;
      armed.current = false;
    }
    function onMove(event: TouchEvent) {
      if (start.current === null) return;
      const distance = event.touches[0].clientY - start.current;
      if (distance <= 0) {
        setPull(0);
        return;
      }
      const eased = Math.min(110, distance * 0.5);
      setPull(eased);
      if (eased >= PULL_TRIGGER && !armed.current) {
        armed.current = true;
        void haptic("light");
      } else if (eased < PULL_TRIGGER) {
        armed.current = false;
      }
    }
    function onEnd() {
      if (start.current === null) return;
      start.current = null;
      if (armed.current) {
        setRefreshing(true);
        setPull(PULL_TRIGGER);
        router.refresh();
        window.setTimeout(() => {
          setRefreshing(false);
          setPull(0);
        }, 900);
      } else {
        setPull(0);
      }
      armed.current = false;
    }

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  if (pull === 0 && !refreshing) return null;

  const ready = pull >= PULL_TRIGGER || refreshing;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: `calc(env(safe-area-inset-top, 0px) + ${Math.max(8, pull - 30)}px)`,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 2147483000,
        width: 38,
        height: 38,
        borderRadius: 999,
        background: "#ffffff",
        boxShadow: "0 6px 18px rgba(60, 40, 140, 0.18)",
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        style={{
          transform: `rotate(${refreshing ? 0 : pull * 3}deg)`,
          animation: refreshing ? "wb-ptr-spin 0.8s linear infinite" : undefined,
          opacity: ready ? 1 : 0.55,
        }}
      >
        <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="#6d3df0" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M20 4v5h-5" stroke="#6d3df0" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <style>{"@keyframes wb-ptr-spin { to { transform: rotate(360deg); } }"}</style>
    </div>
  );
}
