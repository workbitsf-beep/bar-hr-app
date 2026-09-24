"use client";

import { useCallback, useEffect, useState } from "react";
import { isNativeApp } from "@/lib/native-app";
import { isBiometricLockEnabled, verifyBiometry } from "@/lib/biometric-lock";

/**
 * Hides the app behind a fingerprint check when the lock is switched on.
 *
 * Nothing is rendered in a browser or when the lock is off, so this costs a
 * single check for everyone else.
 */
export function BiometricGate() {
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState(false);

  const unlock = useCallback(async () => {
    setBusy(true);
    setRefused(false);

    const ok = await verifyBiometry("Sblocca Workbit");

    setBusy(false);

    if (ok) {
      setLocked(false);
    } else {
      setRefused(true);
    }
  }, []);

  useEffect(() => {
    if (!isNativeApp() || !isBiometricLockEnabled()) {
      return;
    }

    setLocked(true);
    void unlock();
  }, [unlock]);

  useEffect(() => {
    if (!locked) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [locked]);

  if (!locked) {
    return null;
  }

  return (
    <div className="wb-lock" role="dialog" aria-modal="true" aria-label="Workbit bloccato">
      <span className="wb-lock-mark">
        W<i>B</i>
      </span>
      <strong>Workbit è bloccato</strong>
      <p>{refused ? "Non ti ho riconosciuto. Riprova quando vuoi." : "Sblocca con l'impronta per continuare."}</p>

      <button type="button" onClick={() => void unlock()} disabled={busy}>
        {busy ? "In attesa…" : "Sblocca"}
      </button>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .wb-lock {
              position: fixed;
              inset: 0;
              z-index: 2147483000;
              display: grid;
              place-content: center;
              justify-items: center;
              gap: 14px;
              padding: 40px 26px;
              background: #efebfa;
              text-align: center;
              font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif;
            }

            .wb-lock-mark {
              width: 62px;
              height: 62px;
              border-radius: 18px;
              background: #151a3f;
              color: #ffffff;
              display: grid;
              place-content: center;
              font-size: 24px;
              font-weight: 800;
              letter-spacing: -0.04em;
            }

            .wb-lock-mark i { color: #a855f7; font-style: normal; }
            .wb-lock strong { font-size: 19px; font-weight: 600; letter-spacing: -0.02em; color: #15161c; }
            .wb-lock p { margin: 0; max-width: 30ch; font-size: 14px; line-height: 1.55; color: #5b5e70; }

            .wb-lock button {
              margin-top: 8px;
              min-height: 46px;
              padding: 0 28px;
              border: 0;
              border-radius: 999px;
              background: linear-gradient(135deg, #0b1024 0%, #5b21b6 48%, #a855f7 100%);
              color: #ffffff;
              font-family: inherit;
              font-size: 15px;
              font-weight: 700;
              cursor: pointer;
            }

            .wb-lock button:disabled { opacity: 0.6; }
          `,
        }}
      />
    </div>
  );
}
