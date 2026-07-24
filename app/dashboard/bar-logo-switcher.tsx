"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SwipeRevealAction } from "./swipe-reveal-action";

const WELCOME_STORAGE_KEY = "workbit:last-bar-welcome";

type BarOption = {
  id: string;
  name: string;
};

export function BarHeaderSwitcher({
  activeBarId,
  bars,
  children,
}: {
  activeBarId: string | null;
  bars: BarOption[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
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

    if (storedName) {
      window.sessionStorage.removeItem(WELCOME_STORAGE_KEY);
      showWelcome(storedName);
    }

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

  function renderSwitchAction(direction: "previous" | "next", targetBar: BarOption | null) {
    return (
      <button
        type="button"
        aria-label={targetBar ? `Cambia locale: ${targetBar.name}` : "Cambia locale"}
        disabled={!targetBar || isPending}
        onClick={(event) => {
          event.stopPropagation();
          switchBar(targetBar);
        }}
        style={{
          width: 44,
          height: 44,
          borderRadius: 16,
          border: "1px solid rgba(221, 214, 254, 0.9)",
          background: "#7c3aed",
          color: "#ffffff",
          cursor: isPending ? "progress" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 900,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d={direction === "previous" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    );
  }

  return (
    <>
      {canSwitch ? (
        <SwipeRevealAction
          enabled={!isPending}
          leadingAction={renderSwitchAction("previous", switchTargets.previous)}
          action={renderSwitchAction("next", switchTargets.next)}
          resetKey={activeBarId ?? "no-bar"}
          revealWidth={76}
          actionInset={12}
          borderRadius={28}
        >
          <div
            aria-label="Scorri il contenitore per cambiare locale"
            title="Scorri il contenitore per cambiare locale"
            style={{
              cursor: isPending ? "progress" : "grab",
              borderRadius: 28,
              touchAction: "pan-y",
            }}
          >
            {children}
          </div>
        </SwipeRevealAction>
      ) : (
        children
      )}

      {welcomeName ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 2147483647,
            width: "min(calc(100vw - 42px), 360px)",
            padding: "18px 18px",
            borderRadius: 26,
            background: "rgba(255,255,255,0.96)",
            border: "1px solid rgba(124, 58, 237, 0.16)",
            boxShadow: "0 24px 58px rgba(88, 28, 135, 0.22)",
            color: "#0f172a",
            display: "grid",
            gap: 8,
            justifyItems: "center",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          <span style={{ fontSize: 30, lineHeight: 1 }} aria-hidden="true">
            👋
          </span>
          <strong style={{ fontSize: 17 }}>Benvenuto</strong>
          <span style={{ color: "#6d28d9", fontWeight: 900, fontSize: 20 }}>{welcomeName}</span>
        </div>
      ) : null}
    </>
  );
}
