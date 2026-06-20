"use client";

import { useEffect, useState, useTransition } from "react";
import { updateGlobalGpsRadiusAction } from "../actions";
import { SuccessCallout } from "../ui";

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
    <div style={{ display: "grid", gap: 16, maxWidth: 520 }}>
      <label style={{ display: "grid", gap: 8 }}>
        <span style={{ fontWeight: 800, color: "#344054" }}>Distanza consentita</span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderRadius: 22,
            border: "1px solid rgba(217, 119, 6, .18)",
            padding: "8px 14px",
            background: "linear-gradient(135deg, #ffffff, #fffbeb)",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <input
            type="number"
            inputMode="numeric"
            min={0}
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
              minWidth: 0,
              flex: 1,
              border: 0,
              outline: 0,
              padding: "10px 2px",
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: "-0.04em",
              background: "transparent",
              color: "#172033",
              opacity: isPending ? 0.7 : 1,
            }}
          />
          <span style={{ color: "#b45309", fontSize: 14, fontWeight: 900 }}>metri</span>
        </div>
      </label>

      {isPending ? (
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
          Aggiornamento in corso...
        </div>
      ) : feedback ? (
        <SuccessCallout>{feedback}</SuccessCallout>
      ) : (
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
          Il valore viene applicato automaticamente a tutte le strutture.
        </div>
      )}
    </div>
  );
}
