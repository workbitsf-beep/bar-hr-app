"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FLASH_MESSAGES } from "@/lib/flash-messages";

/**
 * The one place the app says "done" or "no": a dark pill above the bottom
 * bar, wherever the page is scrolled. Anything can call showAppToast; a code
 * an action left in the address (?success=…) is shown here too, then taken
 * out of the address so a reload does not say it again.
 */

const EVENT = "workbit-toast";

export function showAppToast(text: string, tone: "ok" | "error" = "ok", soft = false) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { text, tone, soft } }));
}

export function AppToastHost() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "error"; key: number } | null>(null);

  useEffect(() => {
    const show = (event: Event) => {
      const { text, tone, soft } = (event as CustomEvent<{ text: string; tone: "ok" | "error"; soft: boolean }>).detail;
      // A form and the page it lands on may both say it: the first word stays.
      setToast((current) =>
        // A "done" from the address never hides behind an older refusal.
        current && Date.now() - current.key < 2500 && ((soft && current.tone === "ok") || current.text === text)
          ? current
          : { text, tone, key: Date.now() }
      );
    };
    window.addEventListener(EVENT, show);
    return () => window.removeEventListener(EVENT, show);
  }, []);

  const code = searchParams.get("success");
  useEffect(() => {
    if (!code) return;
    const text = FLASH_MESSAGES[code];
    if (text) showAppToast(text, "ok", true);
    const params = new URLSearchParams(window.location.search);
    params.delete("success");
    const query = params.toString();
    window.history.replaceState(window.history.state, "", `${pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, [code, pathname]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.tone === "error" ? 5200 : 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast || pathname.startsWith("/dashboard/super-admin")) return null;

  // At the end of the page, so it is drawn over a popup that opened before it.
  return createPortal(
    <div
      key={toast.key}
      role="status"
      aria-live="polite"
      className="workbit-app-toast"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "calc(max(env(safe-area-inset-bottom, 0px), var(--wb-inset-bottom, 0px)) + 96px)",
        // Above the floating bottom nav (200) and the settings popups, which
        // sit at the very top: a save inside a popup must still be seen.
        zIndex: 2147483647,
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "max-content",
        maxWidth: "calc(100vw - 32px)",
        padding: "12px 18px",
        borderRadius: 999,
        background: "#17142b",
        color: "#ffffff",
        fontSize: 14,
        fontWeight: 700,
        lineHeight: 1.35,
        boxShadow: "0 16px 40px rgba(23, 20, 43, 0.3)",
        pointerEvents: "none",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "grid",
          placeItems: "center",
          flex: "0 0 auto",
          width: 22,
          height: 22,
          borderRadius: 999,
          background: toast.tone === "ok" ? "#1f9d63" : "#c2334d",
          fontSize: 13,
        }}
      >
        {toast.tone === "ok" ? "✓" : "!"}
      </span>
      <span>{toast.text}</span>
    </div>,
    document.body
  );
}
