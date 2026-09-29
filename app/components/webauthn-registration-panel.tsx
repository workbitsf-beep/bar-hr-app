"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startRegistration,
} from "@simplewebauthn/browser";
import {
  clearPasskeySetupPending,
  markPasskeyPreferred,
} from "@/lib/client-session";
import { describePasskeyFailure, ensureNativePasskeySupport } from "@/lib/native-passkeys";

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
      console.error("[passkey] registration failed", err);
      setError(describePasskeyFailure(err, "registrazione"));
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

  const label =
    passkeyCount > 0 ? "Sblocco attivo su questo telefono" : "Non ancora impostato";

  return (
    <div style={{ display: "grid", gap: 9 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "3px minmax(0, 1fr)",
          borderRadius: 13,
          overflow: "hidden",
          border: "1px solid #f0eef9",
        }}
      >
        <span aria-hidden="true" style={{ background: passkeyCount > 0 ? "#6ed3a8" : "#c9c4e8" }} />
        <span style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 11px", minWidth: 0 }}>
          <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
            <strong style={{ fontSize: 13.5, fontWeight: 770, color: "#17161f" }}>{label}</strong>
            <span style={{ fontSize: 11.5, fontWeight: 520, color: "#a3a0b8" }}>
              {passkeyCount > 0
                ? `${passkeyCount} ${passkeyCount === 1 ? "apparecchio" : "apparecchi"} riconosciuti`
                : "Entri con la password"}
            </span>
          </span>
          <span
            style={{
              flex: "0 0 auto",
              fontSize: 9.5,
              fontWeight: 830,
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              color: passkeyCount > 0 ? "#15803d" : "#8b88a3",
            }}
          >
            {passkeyCount > 0 ? "Attivo" : "Spento"}
          </span>
        </span>
      </div>

      {!checking && !available ? (
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 560, color: "#a15c07", lineHeight: 1.45 }}>
          Questo apparecchio non ha un&apos;impronta o un volto che Workbit possa usare.
        </p>
      ) : null}

      {error ? (
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 620, color: "#a8424f" }}>{error}</p>
      ) : null}
      {message ? (
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 620, color: "#15803d" }}>{message}</p>
      ) : null}

      <button
        type="button"
        onClick={handleUpdatePasskey}
        disabled={loading || checking || updating || !available}
        hidden={!checking && !available}
        style={{
          minHeight: 46,
          borderRadius: 14,
          border: "1.5px solid #ddd6fe",
          background: "#ffffff",
          color: "#4c1d95",
          font: "inherit",
          fontSize: 14.5,
          fontWeight: 800,
          cursor: loading || checking || updating || !available ? "default" : "pointer",
          opacity: loading || checking || updating || !available ? 0.55 : 1,
        }}
      >
        {checking
          ? "Un momento…"
          : loading || updating
            ? "Registro…"
            : passkeyCount > 0
              ? "Registra di nuovo questo telefono"
              : "Usa questo telefono per entrare"}
      </button>
    </div>
  );
}
