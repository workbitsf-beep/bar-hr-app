"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startRegistration,
} from "@simplewebauthn/browser";
import { PrimaryButton } from "@/app/dashboard/ui";
import {
  clearPasskeySetupPending,
  markPasskeyPreferred,
} from "@/lib/client-session";

type WebAuthnRegistrationPanelProps = {
  initialPasskeyCount: number;
  autoPrompt?: boolean;
  onSuccess?: () => void;
};

type ApiResponse = {
  ok?: boolean;
  message?: string;
  options?: Parameters<typeof startRegistration>[0]["optionsJSON"];
};

export function WebAuthnRegistrationPanel({
  initialPasskeyCount,
  autoPrompt = false,
  onSuccess,
}: WebAuthnRegistrationPanelProps) {
  const [passkeyCount, setPasskeyCount] = useState(initialPasskeyCount);
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
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

  const registerPasskey = useCallback(async () => {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const optionsResponse = await fetch("/api/auth/webauthn/register/options", {
        method: "POST",
      });
      const optionsPayload = (await optionsResponse.json().catch(() => null)) as ApiResponse | null;

      if (!optionsResponse.ok || !optionsPayload?.ok || !optionsPayload.options) {
        setError(optionsPayload?.message || "Impossibile avviare la registrazione biometrica.");
        return;
      }

      // startRegistration opens the native Face ID / Touch ID / fingerprint prompt.
      const credential = await startRegistration({
        optionsJSON: optionsPayload.options,
      });

      const verifyResponse = await fetch("/api/auth/webauthn/register/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ response: credential }),
      });
      const verifyPayload = (await verifyResponse.json().catch(() => null)) as ApiResponse | null;

      if (!verifyResponse.ok || verifyPayload?.ok !== true) {
        setError(verifyPayload?.message || "Registrazione biometrica non riuscita.");
        return;
      }

      setPasskeyCount((current) => current + 1);
      markPasskeyPreferred();
      clearPasskeySetupPending();
      onSuccess?.();
      setMessage(verifyPayload.message || "Biometria attivata su questo dispositivo.");
    } catch (err) {
      const cancelled = err instanceof Error && err.name === "NotAllowedError";
      setError(
        cancelled
          ? "Operazione annullata o non autorizzata dal dispositivo."
          : "Il dispositivo non ha completato la registrazione biometrica."
      );
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  useEffect(() => {
    if (!autoPrompt || autoPromptedRef.current || checking || loading || updating || !available) {
      return;
    }

    if (passkeyCount > 0) {
      return;
    }

    autoPromptedRef.current = true;
    void registerPasskey();
  }, [autoPrompt, available, checking, loading, updating, passkeyCount, registerPasskey]);

  async function handleUpdatePasskey() {
    setError("");
    setMessage("");

    if (passkeyCount > 0) {
      const confirmed = window.confirm(
        "Vuoi sostituire la passkey biometrica registrata? Le passkey esistenti verranno rimosse prima di registrare la nuova."
      );

      if (!confirmed) {
        return;
      }

      setUpdating(true);

      try {
        const resetResponse = await fetch("/api/auth/webauthn/passkeys/reset", {
          method: "POST",
        });
        const resetPayload = (await resetResponse.json().catch(() => null)) as ApiResponse | null;

        if (!resetResponse.ok || resetPayload?.ok !== true) {
          setError(resetPayload?.message || "Impossibile aggiornare la passkey biometrica.");
          return;
        }

        setPasskeyCount(0);
        setMessage(resetPayload.message || "Passkey biometrica rimossa. Registra la nuova versione.");
      } catch {
        setError("Impossibile aggiornare la passkey biometrica in questo momento.");
        return;
      } finally {
        setUpdating(false);
      }
    }

    await registerPasskey();
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 18,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          color: "#475569",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ display: "block", color: "#0f172a", marginBottom: 4 }}>
          Passkey registrate: {passkeyCount}
        </strong>
      </div>

      {checking ? <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>Controllo...</p> : null}

      {!checking && !available ? (
        <p style={{ margin: 0, color: "#b45309", lineHeight: 1.6 }}>Biometria non disponibile.</p>
      ) : null}

      {error ? <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>{error}</p> : null}
      {message ? <p style={{ margin: 0, color: "#166534", fontSize: 14 }}>{message}</p> : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <PrimaryButton
          type="button"
          onClick={handleUpdatePasskey}
          disabled={loading || checking || updating || !available}
        >
          {loading || updating
            ? "Aggiornamento..."
            : passkeyCount > 0
              ? "Aggiorna passkey biometrica"
              : "Attiva Face ID / Touch ID"}
        </PrimaryButton>
      </div>
    </div>
  );
}
