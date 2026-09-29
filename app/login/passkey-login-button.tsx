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
import {
  describePasskeyFailure,
  ensureNativePasskeySupport,
  isPasskeyCancelled,
} from "@/lib/native-passkeys";

type PasskeyLoginButtonProps = {
  email: string;
  rememberMe: boolean;
  onError: (message: string) => void;
  /** A cancelled prompt is not a failure, so it arrives by its own door. */
  onCancel?: (message: string) => void;
  onSuccess: (redirectTo: string, authenticatedEmail?: string, firstName?: string) => void;
  compact?: boolean;
  autoPrompt?: boolean;
  className?: string;
};

type ApiResponse = {
  ok?: boolean;
  message?: string;
  redirectTo?: string;
  email?: string;
  firstName?: string;
  options?: Parameters<typeof startAuthentication>[0]["optionsJSON"];
};

export function PasskeyLoginButton({
  email,
  rememberMe,
  onError,
  onCancel,
  onSuccess,
  compact = false,
  autoPrompt = false,
  className,
}: PasskeyLoginButtonProps) {
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const autoPromptedRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function checkSupport() {
      try {
        // Inside the installed app this is what puts the passkey API in place;
        // in a browser it returns immediately.
        const bridgeReady = await ensureNativePasskeySupport();
        const supportsWebAuthn = bridgeReady && browserSupportsWebAuthn();
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
      onSuccess(
        verifyPayload.redirectTo || "/dashboard",
        verifyPayload.email,
        verifyPayload.firstName
      );
    } catch (err) {
      const message = describePasskeyFailure(err, "accesso");

      // Dismissing the phone's own prompt is a decision, not a fault: it does
      // not belong in the console or in a red box.
      if (isPasskeyCancelled(err)) {
        onCancel?.(message);
        return;
      }

      console.error("[passkey] login failed", err);
      onError(message);
    } finally {
      setLoading(false);
    }
  }, [email, onCancel, onError, onSuccess, rememberMe]);

  useEffect(() => {
    if (!autoPrompt || autoPromptedRef.current || checking || loading || !available) {
      return;
    }

    autoPromptedRef.current = true;
    void handlePasskeyLogin();
  }, [autoPrompt, available, checking, loading, handlePasskeyLogin]);

  /**
   * "Sblocca con il telefono", not "con l'impronta": on an iPhone it is Face
   * ID, on Android it can be a face or a finger, on a laptop a Windows PIN -
   * and nothing in the browser says which. The mark is a phone with a tick,
   * which is true whatever the device used to recognise you.
   */
  return (
    <button
      className={className ? `workbit-passkey-login ${className}` : "workbit-passkey-login"}
      type="button"
      onClick={handlePasskeyLogin}
      disabled={loading || checking || !available}
      aria-label="Sblocca con il telefono"
      style={
        compact
          ? undefined
          : {
              background: "#f8fafc",
              color: "#0f172a",
              border: "1px solid #dbe3ee",
              borderRadius: 999,
              padding: "14px 18px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 16,
              cursor: loading || checking || !available ? "default" : "pointer",
              opacity: loading || checking || !available ? 0.65 : 1,
            }
      }
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="6" y="2.6" width="12" height="18.8" rx="3" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M9.6 12.4l1.8 1.8 3.4-3.6"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {loading
        ? "Ti sto riconoscendo…"
        : checking
          ? "Un momento…"
          : "Sblocca con il telefono"}
    </button>
  );
}
