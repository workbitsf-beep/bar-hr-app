"use client";

import { useState, useTransition } from "react";
import { showAppToast } from "@/app/components/app-toast";
import { isActionFailure } from "@/lib/rule-error";
import { createPairingCodeAction } from "./actions";

/** Asks for a code and shows it big, to copy onto the tablet. */
export function PairingCode() {
  const [code, setCode] = useState<{ code: string; minutes: number } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div style={{ display: "grid", gap: 10, paddingTop: 6 }}>
      <form
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          start(async () => {
            const result = await createPairingCodeAction(data);
            if (isActionFailure(result)) {
              showAppToast(result.ruleError, "error");
              return;
            }
            setCode({ code: result.code, minutes: result.minutes });
          });
        }}
      >
        <input
          name="name"
          placeholder="Nome (es. Tablet ingresso)"
          maxLength={60}
          style={{ flex: "1 1 180px", minWidth: 0, minHeight: 44, borderRadius: 12, border: "1px solid #dcd6f3", padding: "0 12px", fontSize: 15 }}
        />
        <button
          type="submit"
          disabled={pending}
          style={{ minHeight: 44, padding: "0 16px", borderRadius: 12, border: 0, background: "#5e4ae3", color: "#fff", fontWeight: 700, fontSize: 15 }}
        >
          {pending ? "Un momento…" : "Collega un terminale"}
        </button>
      </form>
      {code ? (
        <div style={{ background: "#f1eeff", borderRadius: 16, padding: "14px 16px", display: "grid", gap: 6, textAlign: "center" }}>
          <span style={{ fontSize: 13, color: "#4c1d95" }}>Codice da scrivere sul dispositivo</span>
          <b style={{ fontSize: 30, letterSpacing: "0.2em", color: "#111827", overflowWrap: "anywhere" }}>
            {code.code.slice(0, 4)} {code.code.slice(4)}
          </b>
          <span style={{ fontSize: 13, color: "#667085" }}>Vale {code.minutes} minuti e una volta sola.</span>
        </div>
      ) : null}
    </div>
  );
}
