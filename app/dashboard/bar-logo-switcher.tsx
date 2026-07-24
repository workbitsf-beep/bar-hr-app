"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";

const WELCOME_STORAGE_KEY = "workbit:last-bar-welcome";

type BarOption = {
  id: string;
  name: string;
};

export function BarLogoSwitcher({
  appName,
  brandHref,
  activeBarId,
  bars,
}: {
  appName: string;
  brandHref: string;
  activeBarId: string | null;
  bars: BarOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const welcomeTimerRef = useRef<number | null>(null);
  const uniqueBars = useMemo(
    () => bars.filter((bar, index) => bars.findIndex((item) => item.id === bar.id) === index),
    [bars]
  );
  const canSwitch = Boolean(activeBarId) && uniqueBars.some((bar) => bar.id !== activeBarId);

  const switchTargets = useMemo(() => {
    if (!activeBarId || uniqueBars.length <= 1) {
      return { next: null, previous: null };
    }

    const currentIndex = Math.max(0, uniqueBars.findIndex((bar) => bar.id === activeBarId));
    return {
      next: uniqueBars[(currentIndex + 1) % uniqueBars.length] ?? null,
      previous: uniqueBars[(currentIndex - 1 + uniqueBars.length) % uniqueBars.length] ?? null,
    };
  }, [activeBarId, uniqueBars]);

  function showWelcome(name: string) {
    if (welcomeTimerRef.current !== null) {
      window.clearTimeout(welcomeTimerRef.current);
    }

    setWelcomeName(name);
    welcomeTimerRef.current = window.setTimeout(() => {
      setWelcomeName(null);
      welcomeTimerRef.current = null;
    }, 2400);
  }

  useEffect(() => {
    const storedName = window.sessionStorage.getItem(WELCOME_STORAGE_KEY);

    if (!storedName) {
      return;
    }

    window.sessionStorage.removeItem(WELCOME_STORAGE_KEY);
    showWelcome(storedName);

    return () => {
      if (welcomeTimerRef.current !== null) {
        window.clearTimeout(welcomeTimerRef.current);
        welcomeTimerRef.current = null;
      }
    };
  }, []);

  function switchBar(targetBar: BarOption | null) {
    if (!targetBar || isPending) {
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/bars/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barId: targetBar.id }),
      });

      if (!response.ok) {
        return;
      }

      window.sessionStorage.setItem(WELCOME_STORAGE_KEY, targetBar.name);
      showWelcome(targetBar.name);
      window.dispatchEvent(new CustomEvent("workbit:calendar-cleanup"));
      router.refresh();
    });
  }

  function resetSwipe() {
    swipeStartRef.current = null;
    setDragOffset(0);
  }

  function updateSwipe(clientX: number, clientY: number) {
    const start = swipeStartRef.current;

    if (!start || !canSwitch || isPending) {
      return;
    }

    const deltaX = clientX - start.x;
    const deltaY = clientY - start.y;

    if (Math.abs(deltaX) < 6 || Math.abs(deltaX) < Math.abs(deltaY)) {
      return;
    }

    setDragOffset(Math.max(-34, Math.min(34, deltaX)));
  }

  function finishSwipe(clientX: number, clientY: number) {
    const start = swipeStartRef.current;
    resetSwipe();

    if (!start || !canSwitch || isPending) {
      return;
    }

    const deltaX = clientX - start.x;
    const deltaY = clientY - start.y;

    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.4) {
      return;
    }

    switchBar(deltaX < 0 ? switchTargets.next : switchTargets.previous);
  }

  return (
    <>
      {canSwitch ? (
        <button
          type="button"
          onPointerDown={(event) => {
            swipeStartRef.current = { x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            updateSwipe(event.clientX, event.clientY);
          }}
          onPointerUp={(event) => {
            finishSwipe(event.clientX, event.clientY);
            try {
              event.currentTarget.releasePointerCapture(event.pointerId);
            } catch {
              // Pointer capture can already be released by the browser.
            }
          }}
          onPointerCancel={resetSwipe}
          onLostPointerCapture={resetSwipe}
          disabled={isPending}
          aria-label="Scorri sul logo per cambiare locale"
          title="Scorri sul logo per cambiare locale"
          style={{
            border: 0,
            padding: 0,
            margin: 0,
            background: "transparent",
            color: "inherit",
            cursor: isPending ? "progress" : "grab",
            textAlign: "left",
            borderRadius: 16,
            display: "inline-flex",
            opacity: isPending ? 0.72 : 1,
            touchAction: "pan-y",
            userSelect: "none",
            transform: `translateX(${dragOffset}px)`,
            transition: dragOffset === 0 ? "transform 180ms ease" : "none",
          }}
        >
          <BrandLogo size={40} showIcon label={appName} style={{ gap: 12 }} />
        </button>
      ) : (
        <BrandLogo href={brandHref} size={40} showIcon label={appName} style={{ gap: 12 }} />
      )}

      {welcomeName ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: "max(18px, env(safe-area-inset-top))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2147483647,
            width: "min(calc(100vw - 32px), 420px)",
            padding: "14px 16px",
            borderRadius: 22,
            background: "rgba(255,255,255,0.96)",
            border: "1px solid rgba(124, 58, 237, 0.16)",
            boxShadow: "0 18px 42px rgba(88, 28, 135, 0.18)",
            color: "#0f172a",
            display: "grid",
            gap: 3,
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          <strong style={{ fontSize: 16 }}>Benvenuto</strong>
          <span style={{ color: "#6d28d9", fontWeight: 800 }}>{welcomeName}</span>
        </div>
      ) : null}
    </>
  );
}
