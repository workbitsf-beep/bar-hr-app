"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LegalAcceptanceForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");

    if (!accepted) {
      setError("Devi confermare la lettura e accettazione per continuare.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/legal-documents/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accepted: true }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        redirectTo?: string;
      } | null;

      if (!response.ok || payload?.ok !== true) {
        setError(payload?.message || "Impossibile accettare i documenti.");
        return;
      }

      router.replace(payload.redirectTo || "/dashboard");
      router.refresh();
    } catch {
      setError("Impossibile completare l'accettazione. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <label
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          padding: 16,
          borderRadius: 22,
          background: "#ffffff",
          border: "1px solid rgba(124, 58, 237, 0.12)",
          color: "#0f172a",
          fontWeight: 750,
          lineHeight: 1.45,
        }}
      >
        <input
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          type="checkbox"
          style={{ marginTop: 3 }}
        />
        <span>Dichiaro di aver letto e accettato i documenti legali di Workbit.</span>
      </label>

      {error ? (
        <p style={{ margin: 0, color: "#b91c1c", fontWeight: 800 }}>
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={loading}
        onClick={submit}
        style={{
          minHeight: 52,
          borderRadius: 999,
          border: 0,
          background: "linear-gradient(135deg, #111827 0%, #4c1d95 100%)",
          color: "#ffffff",
          fontWeight: 900,
          fontSize: 16,
          cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.7 : 1,
          boxShadow: "0 16px 34px rgba(88, 28, 135, 0.18)",
        }}
      >
        {loading ? "Accettazione..." : "Accetta e continua"}
      </button>
    </div>
  );
}
