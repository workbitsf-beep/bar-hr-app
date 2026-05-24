"use client";

import { useEffect, useRef, useState } from "react";
import {
  getBestAccuracyPosition,
  LOW_ACCURACY_WARNING_METERS,
} from "@/lib/browser-gps";

type GpsLocationFieldProps = {
  latitudeName: string;
  longitudeName: string;
  initialLatitude?: number | null;
  initialLongitude?: number | null;
  submitOnLocate?: boolean;
};

export function GpsLocationField({
  latitudeName,
  longitudeName,
  initialLatitude = null,
  initialLongitude = null,
  submitOnLocate = false,
}: GpsLocationFieldProps) {
  const [latitude, setLatitude] = useState<number | null>(initialLatitude);
  const [longitude, setLongitude] = useState<number | null>(initialLongitude);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    initialLatitude !== null && initialLongitude !== null
      ? "Posizione aggiornata."
      : "Posizione non aggiornata."
  );
  const [error, setError] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const pendingSubmitRef = useRef(false);

  useEffect(() => {
    if (!submitOnLocate || !pendingSubmitRef.current || latitude === null || longitude === null) {
      return;
    }

    pendingSubmitRef.current = false;

    const frameId = window.requestAnimationFrame(() => {
      triggerRef.current?.form?.requestSubmit();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [latitude, longitude, submitOnLocate]);

  async function handleLocate() {
    setError("");

    if (!navigator.geolocation) {
      setError("Geolocalizzazione non disponibile su questo dispositivo.");
      return;
    }

    setLoading(true);
    setMessage("Aggiornamento posizione in corso...");

    try {
      // We collect multiple fresh fixes and keep the most reliable one so the
      // saved venue point stays stable between repeated updates.
      const sample = await getBestAccuracyPosition({
        onLowAccuracy() {
          setMessage(
            `Segnale GPS debole. Attendo una posizione piu stabile entro circa ${LOW_ACCURACY_WARNING_METERS} m.`
          );
        },
      });

      setLatitude(sample.latitude);
      setLongitude(sample.longitude);
      setMessage("Posizione aggiornata.");

      if (submitOnLocate) {
        pendingSubmitRef.current = true;
      }
    } catch {
      setError("Impossibile aggiornare la posizione. Controlla i permessi GPS e riprova.");
      setMessage("Posizione non aggiornata.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        padding: 16,
        borderRadius: 20,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
      }}
    >
      <input type="hidden" name={latitudeName} value={latitude ?? ""} />
      <input type="hidden" name={longitudeName} value={longitude ?? ""} />

      <div style={{ display: "grid", gap: 6 }}>
        <strong style={{ color: "#0f172a" }}>Posizione del locale</strong>
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>{message}</p>
        {error ? <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>{error}</p> : null}
      </div>

      <div className="dashboard-form-actions">
        <button
          ref={triggerRef}
          type="button"
          onClick={handleLocate}
          disabled={loading}
          style={{
            background: "#0f172a",
            color: "#fff",
            border: 0,
            borderRadius: 999,
            padding: "12px 18px",
            fontWeight: 700,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
            boxShadow: "0 10px 20px rgba(15, 23, 42, 0.14)",
          }}
        >
          {loading
            ? "Localizzazione..."
            : latitude !== null && longitude !== null
              ? "Aggiorna posizione"
              : "Localizza la mia posizione"}
        </button>
      </div>
    </div>
  );
}
