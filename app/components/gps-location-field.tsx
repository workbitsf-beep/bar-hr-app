"use client";

import { useState } from "react";

type GpsLocationFieldProps = {
  latitudeName: string;
  longitudeName: string;
  initialLatitude?: number | null;
  initialLongitude?: number | null;
};

export function GpsLocationField({
  latitudeName,
  longitudeName,
  initialLatitude = null,
  initialLongitude = null,
}: GpsLocationFieldProps) {
  const [latitude, setLatitude] = useState<number | null>(initialLatitude);
  const [longitude, setLongitude] = useState<number | null>(initialLongitude);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    initialLatitude !== null && initialLongitude !== null
      ? "Posizione GPS gia salvata. Restera questa finche non la aggiorni."
      : "Nessuna posizione GPS salvata. Usa il tasto per registrarla."
  );
  const [error, setError] = useState("");

  async function handleLocate() {
    setError("");

    if (!navigator.geolocation) {
      setError("Geolocalizzazione non disponibile su questo dispositivo.");
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setMessage("Posizione acquisita. Salva per confermare questo punto GPS.");
        setLoading(false);
      },
      () => {
        setError("Impossibile leggere la posizione attuale. Controlla i permessi GPS.");
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
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
