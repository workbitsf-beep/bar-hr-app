"use client";

import { useEffect, useState, useTransition } from "react";
import { updateGlobalGpsRadiusAction } from "../actions";

export function GlobalGpsRadiusForm({
  initialRadius,
}: {
  initialRadius: number;
}) {
  const [value, setValue] = useState(String(initialRadius));
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setValue(String(initialRadius));
  }, [initialRadius]);

  function submitCurrentValue() {
    const nextRadius = Number(value);

    if (!Number.isFinite(nextRadius)) {
      setFeedback("Inserisci un valore valido.");
      return;
    }

    startTransition(async () => {
      const result = await updateGlobalGpsRadiusAction(nextRadius);
      setValue(String(result.gpsRadius));
      setFeedback(result.message);
    });
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label style={{ display: "grid", gap: 8 }}>
        <span style={{ fontWeight: 600, color: "#1e293b" }}>Raggio GPS globale</span>
        <input
          type="number"
          inputMode="numeric"
          min={20}
          step={1}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setFeedback(null);
          }}
          onBlur={submitCurrentValue}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitCurrentValue();
            }
          }}
          disabled={isPending}
          style={{
            borderRadius: 16,
            border: "1px solid #dbe3ee",
            padding: "12px 14px",
            fontSize: 15,
            background: "#ffffff",
            width: "100%",
            color: "#0f172a",
            boxSizing: "border-box",
            opacity: isPending ? 0.7 : 1,
          }}
        />
      </label>

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
        {isPending ? "Aggiornamento in corso..." : feedback ?? "Il valore viene applicato automaticamente a tutti i locali."}
      </div>
    </div>
  );
}
