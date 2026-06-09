"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from "@simplewebauthn/browser";
import { usePathname, useRouter } from "next/navigation";
import { WebAuthnRegistrationPanel } from "@/app/components/webauthn-registration-panel";
import { clearPasskeySetupPending, hasPasskeySetupPending } from "@/lib/client-session";

const AUTH_EXCLUDED_PATHS = ["/login", "/change-password", "/forgot-password"];

export function PasskeySetupPrompt() {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const dismissed = sessionStorage.getItem("workbit-passkey-setup-dismissed") === "1";
    const shouldSkip = AUTH_EXCLUDED_PATHS.some((path) => pathname === path);
    const pending = hasPasskeySetupPending();

    if (!pending || dismissed || shouldSkip) {
      setVisible(false);
      return;
    }

    let active = true;

    async function checkSupport() {
      try {
        const supportsWebAuthn = browserSupportsWebAuthn();
        const platformAuthenticator =
          supportsWebAuthn && (await platformAuthenticatorIsAvailable());

        if (active) {
          setSupported(Boolean(platformAuthenticator));
          setVisible(Boolean(platformAuthenticator));
        }
      } catch {
        if (active) {
          setSupported(false);
          setVisible(false);
        }
      }
    }

    void checkSupport();

    return () => {
      active = false;
    };
  }, [mounted, pathname]);

  if (!mounted || !visible || !supported || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      role="presentation"
      onClick={() => {
        sessionStorage.setItem("workbit-passkey-setup-dismissed", "1");
        setVisible(false);
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: "rgba(15, 23, 42, 0.44)",
        backdropFilter: "blur(18px)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Attiva Face ID o impronta"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(92vw, 520px)",
          maxHeight: "min(85vh, 760px)",
          overflow: "auto",
          borderRadius: 28,
          background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
          border: "1px solid rgba(148, 163, 184, 0.2)",
          boxShadow: "0 30px 80px rgba(15, 23, 42, 0.24)",
          padding: 20,
          display: "grid",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "grid", gap: 4 }}>
            <strong style={{ fontSize: 20, color: "#0f172a" }}>Attiva Face ID / impronta</strong>
            <span style={{ color: "#64748b", lineHeight: 1.5 }}>
              Ti basta una volta sola. Poi al prossimo accesso potrai entrare piu velocemente.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem("workbit-passkey-setup-dismissed", "1");
              setVisible(false);
            }}
            aria-label="Chiudi"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              border: "1px solid #e2e8f0",
              background: "#fff",
              color: "#0f172a",
              fontSize: 20,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        <WebAuthnRegistrationPanel
          initialPasskeyCount={0}
          autoPrompt
          onSuccess={() => {
            clearPasskeySetupPending();
            sessionStorage.removeItem("workbit-passkey-setup-dismissed");
            setVisible(false);
            router.refresh();
          }}
        />
      </div>
    </div>,
    document.body
  );
}
