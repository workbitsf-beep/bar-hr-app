"use client";

import { useState, useTransition } from "react";
import { updateGlobalGpsRadiusAction } from "../../actions";
import { Group } from "../console-ui";

export function GpsRadiusForm({ initialRadius }: { initialRadius: number }) {
  const [value, setValue] = useState(String(initialRadius));
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    const next = Number(value);

    if (!Number.isFinite(next) || next < 0) {
      setFeedback("Inserisci un numero valido di metri.");
      return;
    }

    startTransition(async () => {
      const result = await updateGlobalGpsRadiusAction(next);
      setValue(String(result.gpsRadius));
      setFeedback(result.message);
    });
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Group label="Raggio consentito" hint="Applicato a tutti i locali che non hanno un raggio personalizzato.">
        <div style={{ display: "flex", gap: 9, alignItems: "stretch" }}>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={value}
            disabled={isPending}
            onChange={(event) => {
              setValue(event.target.value);
              setFeedback(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                save();
              }
            }}
          />
          <button
            type="button"
            className="wbc-btn wbc-btn-ghost"
            onClick={save}
            disabled={isPending}
            style={{ flex: "0 0 auto" }}
          >
            {isPending ? "Salvo…" : "Salva"}
          </button>
        </div>
      </Group>

      {feedback ? <p className="wbc-note wbc-note-positive">{feedback}</p> : null}
    </div>
  );
}
