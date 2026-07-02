"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ensureWorkbitPushRegistration,
  getWorkbitPushPermissionState,
  isWorkbitPushDisabled,
} from "@/lib/push-client";

const PUSH_PROMPT_DISMISSED_KEY = "workbit.push.first-access-dismissed";

export function PushRegistration() {
  const [mounted, setMounted] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (isWorkbitPushDisabled()) {
      return;
    }

    if (Notification.permission === "granted") {
      void ensureWorkbitPushRegistration();
      return;
    }

    const hasDismissedPrompt =
      window.localStorage.getItem(PUSH_PROMPT_DISMISSED_KEY) === "1";

    if (Notification.permission === "default" && !hasDismissedPrompt) {
      setShowPrompt(true);
    }
  }, []);

  useEffect(() => {
    if (!mounted || !showPrompt) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted, showPrompt]);

  async function enablePush() {
    setLoading(true);
    setMessage(null);

    try {
      const result = await ensureWorkbitPushRegistration({ requestPermission: true });
      setMessage(result.message);

      if (result.ok && (result.registered || getWorkbitPushPermissionState() !== "default")) {
        window.localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, "1");
        setTimeout(() => setShowPrompt(false), 900);
      }
    } finally {
      setLoading(false);
    }
  }

  function dismissPrompt() {
    window.localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, "1");
    setShowPrompt(false);
  }

  if (!mounted || !showPrompt) {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-permission-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        display: "grid",
        placeItems: "center",
        padding: 18,
        background: "rgba(15, 23, 42, 0.24)",
        backdropFilter: "blur(12px)",
      }}
      onClick={dismissPrompt}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 390,
          borderRadius: 28,
          background: "linear-gradient(180deg, #ffffff 0%, #faf7ff 100%)",
          border: "1px solid rgba(196, 181, 253, 0.42)",
          boxShadow: "0 28px 80px rgba(88, 28, 135, 0.24)",
          padding: 22,
          display: "grid",
          gap: 14,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          aria-hidden="true"
          style={{
            width: 48,
            height: 48,
            borderRadius: 18,
            display: "grid",
            placeItems: "center",
            background: "linear-gradient(135deg, #1e1b4b 0%, #7c3aed 100%)",
            color: "#fff",
            fontSize: 22,
            boxShadow: "0 16px 34px rgba(124, 58, 237, 0.24)",
          }}
        >
          🔔
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <h2
            id="push-permission-title"
            style={{
              margin: 0,
              color: "#0f172a",
              fontSize: 22,
              lineHeight: 1.18,
              letterSpacing: "-0.03em",
            }}
          >
            Attiva le notifiche
          </h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: 14, lineHeight: 1.55 }}>
            Ricevi avvisi per turni, richieste e aggiornamenti importanti anche quando
            Workbit non è aperta.
          </p>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <button
            type="button"
            onClick={() => void enablePush()}
            disabled={loading}
            style={{
              minHeight: 44,
              border: 0,
              borderRadius: 999,
              background: "linear-gradient(135deg, #1e1b4b 0%, #7c3aed 100%)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 800,
              cursor: loading ? "default" : "pointer",
              boxShadow: "0 14px 30px rgba(124, 58, 237, 0.22)",
            }}
          >
            {loading ? "Attivazione..." : "Attiva notifiche"}
          </button>
          <button
            type="button"
            onClick={dismissPrompt}
            style={{
              minHeight: 40,
              border: "1px solid rgba(196, 181, 253, 0.5)",
              borderRadius: 999,
              background: "#fff",
              color: "#4c1d95",
              fontSize: 13,
              fontWeight: 750,
              cursor: "pointer",
            }}
          >
            Non ora
          </button>
        </div>

        {message ? (
          <p style={{ margin: 0, color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>
            {message}
          </p>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
