"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { showToast } from "../console-form";

/** Supplier, zone, the file: Claude reads it, the rows land in the comparisons. */
export function PriceListUploader() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/costs/price-list", { method: "POST", body: new FormData(event.currentTarget) });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !payload?.ok) {
        setError(payload?.message ?? "Lettura non riuscita.");
        return;
      }
      showToast(payload.message ?? "Listino letto.");
      event.currentTarget?.reset();
      router.refresh();
    } catch {
      setError("Lettura non riuscita: controlla la connessione.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
      <div className="wbc-fieldgrid" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <label className="wbc-field">
          <span className="wbc-field-label">Fornitore</span>
          <input name="supplierName" required placeholder="Siderurgica Veneta Srl" />
        </label>
        <label className="wbc-field">
          <span className="wbc-field-label">Zona servita</span>
          <input name="zone" placeholder="Veneto, PD, Nord Italia…" />
        </label>
        <label className="wbc-field">
          <span className="wbc-field-label">Valido dal</span>
          <input name="validFrom" type="date" />
        </label>
        <label className="wbc-field">
          <span className="wbc-field-label">Listino (PDF, Excel o CSV)</span>
          <input name="file" type="file" accept=".pdf,.xlsx,.xlsm,.csv,.txt" required />
        </label>
      </div>
      {error ? (
        <p className="wbc-save-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="wbc-savebar">
        <button type="submit" className="wbc-btn wbc-btn-primary" disabled={busy} aria-busy={busy}>
          {busy ? "Leggo il listino… (fino a un paio di minuti)" : "Leggi e salva il listino"}
        </button>
      </div>
    </form>
  );
}
