"use client";

import { useEffect, useState } from "react";
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
} from "@simplewebauthn/browser";

type PasskeyLoginButtonProps = {
  rememberMe: boolean;
  onError: (message: string) => void;
  onSuccess: (redirectTo: string) => void;
};

type ApiResponse = {
  ok?: boolean;
  message?: string;
  redirectTo?: string;
  options?: Parameters<typeof startAuthentication>[0]["optionsJSON"];
};

export function PasskeyLoginButton({
  rememberMe,
  onError,
  onSuccess,
}: PasskeyLoginButtonProps) {
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);

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

  async function handlePasskeyLogin() {
    onError("");
    setLoading(true);

    try {
      const optionsResponse = await fetch("/api/auth/webauthn/login/options", {
        method: "POST",
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

      onSuccess(verifyPayload.redirectTo || "/dashboard");
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
  }

  return (
    <button
      type="button"
      onClick={handlePasskeyLogin}
      disabled={loading || checking || !available}
      style={{
        background: "#f8fafc",
        color: "#0f172a",
        border: "1px solid #dbe3ee",
        borderRadius: 999,
        padding: "14px 18px",
        fontWeight: 700,
        fontSize: 16,
        cursor: loading || checking || !available ? "default" : "pointer",
        opacity: loading || checking || !available ? 0.65 : 1,
      }}
    >
      {loading
        ? "Verifica biometrica..."
        : checking
          ? "Controllo biometria..."
          : "Accedi con Biometria"}
    </button>
  );
}
