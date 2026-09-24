"use client";

import { useEffect, useState } from "react";
import { PrimaryButton } from "@/app/dashboard/ui";
import {
  getBiometryStatus,
  isBiometricLockEnabled,
  setBiometricLockEnabled,
  verifyBiometry,
} from "@/lib/biometric-lock";

export function BiometricLockPanel() {
  const [checking, setChecking] = useState(true);
  const [available, setAvailable] = useState(false);
  const [reason, setReason] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    void (async () => {
      const status = await getBiometryStatus();

      if (!active) {
        return;
      }

      setAvailable(status.available);
      setReason(status.label);
      setEnabled(isBiometricLockEnabled());
      setChecking(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  async function toggle() {
    setBusy(true);
    setMessage("");

    if (enabled) {
      setBiometricLockEnabled(false);
      setEnabled(false);
      setBusy(false);
      setMessage("Sblocco con impronta disattivato.");
      return;
    }

    // Prove the sensor works before switching it on, so nobody ends up locked
    // out at the start of a shift by a setting that was never tested.
    const ok = await verifyBiometry("Conferma per attivare lo sblocco");

    setBusy(false);

    if (!ok) {
      setMessage("Non è stato possibile confermare l'impronta. Riprova.");
      return;
    }

    setBiometricLockEnabled(true);
    setEnabled(true);
    setMessage("Da ora Workbit chiederà l'impronta all'apertura.");
  }

  if (checking) {
    return <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>Controllo…</p>;
  }

  if (!available) {
    return (
      <p style={{ margin: 0, color: "#b45309", lineHeight: 1.6 }}>
        {reason || "Questo telefono non ha un'impronta o un volto registrato."}
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
        {enabled
          ? "All'apertura dell'app viene chiesta l'impronta prima di mostrare i tuoi dati."
          : "Attivalo per far chiedere l'impronta a ogni apertura dell'app."}
      </p>

      {message ? <p style={{ margin: 0, color: "#166534", fontSize: 14 }}>{message}</p> : null}

      <div>
        <PrimaryButton type="button" onClick={() => void toggle()} disabled={busy} tone={enabled ? "red" : "dark"}>
          {busy ? "Attendi…" : enabled ? "Disattiva sblocco con impronta" : "Attiva sblocco con impronta"}
        </PrimaryButton>
      </div>
    </div>
  );
}
