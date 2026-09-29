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
            `Segnale GPS debole. Attendo una posizione più stabile entro circa ${LOW_ACCURACY_WARNING_METERS} m.`
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

  const placed = latitude !== null && longitude !== null;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <input type="hidden" name={latitudeName} value={latitude ?? ""} />
      <input type="hidden" name={longitudeName} value={longitude ?? ""} />

      {/* Two number fields called latitude and longitude told nobody where
          the venue was. A dot on a grid does. */}
      <div
        aria-hidden="true"
        style={{
          position: "relative",
          height: 118,
          borderRadius: 15,
          overflow: "hidden",
          border: "1.5px solid #e9e6f5",
          background: placed
            ? "linear-gradient(150deg, #e6e2f8, #f3f1fb)"
            : "linear-gradient(150deg, #f2f1f7, #fbfaff)",
        }}
      >
        <span
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(124,58,237,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.09) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        {placed ? (
          <span
            style={{
              position: "absolute",
              left: "50%",
              top: "52%",
              width: 15,
              height: 15,
              margin: "-7px 0 0 -7px",
              borderRadius: 999,
              background: "#4c1d95",
              boxShadow: "0 0 0 7px rgba(76, 29, 149, 0.16)",
            }}
          />
        ) : null}
      </div>

      <button
        ref={triggerRef}
        type="button"
        onClick={handleLocate}
        disabled={loading}
        style={{
          minHeight: 46,
          borderRadius: 14,
          border: "1.5px solid #ddd6fe",
          background: "#ffffff",
          color: "#4c1d95",
          font: "inherit",
          fontSize: 14.5,
          fontWeight: 800,
          cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.65 : 1,
        }}
      >
        {loading
          ? "Ti sto localizzando…"
          : placed
            ? "Aggiorna la posizione"
            : "Usa la posizione attuale"}
      </button>

      <span
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: error ? "#a8424f" : "#a3a0b8",
          lineHeight: 1.45,
        }}
      >
        {error
          ? error
          : placed
            ? `${latitude?.toFixed(4)} · ${longitude?.toFixed(4)}`
            : message}
      </span>
    </div>
  );
}
