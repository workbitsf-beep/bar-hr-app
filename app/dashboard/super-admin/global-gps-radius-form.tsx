"use client";

import { useEffect, useState, useTransition } from "react";
import { updateGlobalGpsRadiusAction } from "../actions";
import { SuccessCallout } from "./light-ui";

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
    <div style={{ display: "grid", gap: 16, width: "100%", maxWidth: 520, minWidth: 0 }}>
      <label style={{ display: "grid", gap: 8 }}>
        <span style={{ fontWeight: 800, color: "#344054" }}>Distanza consentita</span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            minWidth: 0,
            maxWidth: "100%",
            borderRadius: 14,
            border: "1px solid #e7e5e4",
            padding: "8px 12px",
            background: "#ffffff",
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
              width: "100%",
              border: 0,
              outline: 0,
              padding: "10px 2px",
              fontSize: "clamp(20px, 7vw, 28px)",
              fontWeight: 900,
              letterSpacing: "-0.04em",
              background: "transparent",
              color: "#1c1917",
              opacity: isPending ? 0.7 : 1,
            }}
          />
          <span style={{ color: "#78716c", fontSize: 13, fontWeight: 700, flex: "0 0 auto" }}>metri</span>
        </div>
      </label>

      {isPending ? (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 18,
            background: "#fafaf9",
            border: "1px solid #e7e5e4",
            color: "#78716c",
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
            background: "#fafaf9",
            border: "1px solid #e7e5e4",
            color: "#78716c",
            lineHeight: 1.6,
          }}
        >
          Il valore viene applicato automaticamente a tutte le strutture.
        </div>
      )}
    </div>
  );
}
