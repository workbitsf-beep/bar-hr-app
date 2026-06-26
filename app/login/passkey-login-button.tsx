"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
} from "@simplewebauthn/browser";
import {
  clearPasskeySetupPending,
  markPasskeyPreferred,
} from "@/lib/client-session";

type PasskeyLoginButtonProps = {
  email: string;
  rememberMe: boolean;
  onError: (message: string) => void;
  onSuccess: (redirectTo: string, authenticatedEmail?: string) => void;
  compact?: boolean;
  autoPrompt?: boolean;
};

type ApiResponse = {
  ok?: boolean;
  message?: string;
  redirectTo?: string;
  email?: string;
  options?: Parameters<typeof startAuthentication>[0]["optionsJSON"];
};

export function PasskeyLoginButton({
  email,
  rememberMe,
  onError,
  onSuccess,
  compact = false,
  autoPrompt = false,
}: PasskeyLoginButtonProps) {
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const autoPromptedRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function checkSupport() {
      try {
        const supportsWebAuthn = browserSupportsWebAuthn();
        const supportsPlatformAuthenticator =
          supportsWebAuthn && (await platformAuthenticatorIsAvailable());

        if (active) {
          setAvailable(Boolean(supportsPlatformAuthenticator));
        }
      } catch {
        if (active) {
          setAvailable(false);
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    void checkSupport();

    return () => {
      active = false;
    };
  }, []);

  const handlePasskeyLogin = useCallback(async () => {
    onError("");
    setLoading(true);

    try {
      const optionsResponse = await fetch("/api/auth/webauthn/login/options", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase() || undefined,
        }),
      });
      const optionsPayload = (await optionsResponse.json().catch(() => null)) as ApiResponse | null;

      if (!optionsResponse.ok || !optionsPayload?.ok || !optionsPayload.options) {
        onError(optionsPayload?.message || "Impossibile avviare l'accesso biometrico.");
        return;
      }

      // startAuthentication asks the device to sign the challenge with the private key.
      const credential = await startAuthentication({
        optionsJSON: optionsPayload.options,
      });

      const verifyResponse = await fetch("/api/auth/webauthn/login/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ response: credential, rememberMe }),
      });
      const verifyPayload = (await verifyResponse.json().catch(() => null)) as ApiResponse | null;

      if (!verifyResponse.ok || verifyPayload?.ok !== true) {
        onError(verifyPayload?.message || "Accesso biometrico non riuscito.");
        return;
      }

      markPasskeyPreferred();
      clearPasskeySetupPending();
      onSuccess(verifyPayload.redirectTo || "/dashboard", verifyPayload.email);
    } catch (err) {
      const cancelled = err instanceof Error && err.name === "NotAllowedError";
      onError(
        cancelled
          ? "Operazione annullata o non autorizzata dal dispositivo."
          : "Il dispositivo non ha completato l'accesso biometrico."
      );
    } finally {
      setLoading(false);
    }
  }, [email, onError, onSuccess, rememberMe]);

  useEffect(() => {
    if (!autoPrompt || autoPromptedRef.current || checking || loading || !available) {
      return;
    }

    autoPromptedRef.current = true;
    void handlePasskeyLogin();
  }, [autoPrompt, available, checking, loading, handlePasskeyLogin]);

  return (
    <button
      type="button"
      onClick={handlePasskeyLogin}
      disabled={loading || checking || !available}
      aria-label="Accedi con biometria"
      title="Accedi con biometria"
      style={{
        background: compact ? "#eef2ff" : "#f8fafc",
        color: "#0f172a",
        border: "1px solid #dbe3ee",
        borderRadius: 999,
        padding: compact ? 0 : "14px 18px",
        width: compact ? 52 : "auto",
        height: compact ? 52 : "auto",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 16,
        cursor: loading || checking || !available ? "default" : "pointer",
        opacity: loading || checking || !available ? 0.65 : 1,
      }}
    >
      {compact ? (
        <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M7 10c0-2.76 2.24-5 5-5 1.37 0 2.61.55 3.51 1.44"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M5 14.5c0-4.14 3.36-7.5 7.5-7.5 1.97 0 3.76.76 5.1 2"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M8 15.5c0-2.5 2-4.5 4.5-4.5 1.05 0 2.02.36 2.78.97"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M12 9v1.5m0 2v1.5m0 2v1.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </span>
      ) : loading ? (
        "Verifica biometrica..."
      ) : checking ? (
        "Controllo biometria..."
      ) : email ? (
        `Accedi con Biometria - ${email}`
      ) : (
        "Accedi con Biometria"
      )}
    </button>
  );
}
