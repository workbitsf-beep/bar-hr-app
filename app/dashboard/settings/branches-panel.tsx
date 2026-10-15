"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { showAppToast } from "@/app/components/app-toast";
import { describeActionError, isActionFailure } from "@/lib/rule-error";
import { createBranchAction, deleteBranchAction } from "./branch-actions";

/**
 * A restaurant's branches, from the main venue's settings: each one a venue
 * of its own under the same name and tax details, opened from the switcher
 * in the header. The plan, Reparti and the people limit are shared.
 */

export type BranchRow = { id: string; name: string; address: string | null; people: number; empty: boolean };

const fieldStyle = {
  width: "100%",
  minHeight: 44,
  padding: "0 12px",
  borderRadius: 14,
  border: "1px solid #e2e8f0",
  fontSize: 15,
  fontFamily: "inherit",
} as const;

export function BranchesPanel({ mainName, branches, limit }: { mainName: string; branches: BranchRow[]; limit: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const free = Math.max(0, limit - 1 - branches.length);

  function run(action: (formData: FormData) => Promise<unknown>, formData: FormData, done?: () => void) {
    setError(null);
    start(async () => {
      try {
        const result = await action(formData);
        if (isActionFailure(result)) {
          setError(result.ruleError);
          return;
        }
        const message = (result as { message?: string }).message;
        if (message) showAppToast(message);
        done?.();
        router.refresh();
      } catch (failure) {
        setError(describeActionError(failure));
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "#5b5675" }}>
        Ogni sede ha calendario, reparti, persone e punto di timbratura suoi, con la stessa insegna e la stessa
        partita IVA di {mainName}. L&apos;abbonamento è uno solo: piano, Reparti e persone valgono per tutte.
        Un&apos;attività con un altro nome o altri dati fiscali si aggiunge come attività a parte.
      </p>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ padding: "11px 13px", borderRadius: 16, border: "1px solid #ebe6f7", background: "#faf8ff" }}>
          <strong style={{ fontSize: 14.5 }}>{mainName}</strong>{" "}
          <span style={{ fontSize: 11, fontWeight: 800, color: "#6d3df0", textTransform: "uppercase", letterSpacing: 0.4 }}>
            Principale
          </span>
        </div>
        {branches.map((branch) => (
          <div
            key={branch.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "11px 13px",
              borderRadius: 16,
              border: "1px solid #ebe6f7",
              background: "#fff",
            }}
          >
            <span style={{ display: "grid", gap: 2, minWidth: 0, flex: 1 }}>
              <strong style={{ fontSize: 14.5, overflowWrap: "anywhere" }}>{branch.name}</strong>
              <span style={{ fontSize: 12, color: "#8a84a8" }}>
                {branch.address || "Senza indirizzo"} · {branch.people} {branch.people === 1 ? "persona" : "persone"}
              </span>
            </span>
            {branch.empty ? (
              confirming === branch.id ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    const formData = new FormData();
                    formData.set("branchId", branch.id);
                    run(deleteBranchAction, formData, () => setConfirming(null));
                  }}
                  style={{ border: 0, borderRadius: 999, padding: "8px 12px", background: "#b3202f", color: "#fff", fontFamily: "inherit", fontWeight: 800 }}
                >
                  Togli
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(branch.id)}
                  style={{ border: "1px solid #fecdd3", borderRadius: 999, padding: "8px 12px", background: "#fff", color: "#b3202f", fontFamily: "inherit", fontWeight: 700 }}
                >
                  Elimina
                </button>
              )
            ) : null}
          </div>
        ))}
      </div>

      {free > 0 ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            run(createBranchAction, new FormData(form), () => form.reset());
          }}
          style={{ display: "grid", gap: 8, padding: 14, borderRadius: 18, border: "1px dashed #c4b5fd", background: "#fff" }}
        >
          <strong style={{ fontSize: 15 }}>Aggiungi una sede</strong>
          <input name="label" placeholder="Nome della sede, per esempio Centro" required maxLength={40} style={fieldStyle} />
          <input name="addressLine1" placeholder="Indirizzo" maxLength={160} style={fieldStyle} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 8 }}>
            <input name="city" placeholder="Città" maxLength={80} style={fieldStyle} />
            <input name="postalCode" placeholder="CAP" maxLength={12} inputMode="numeric" style={fieldStyle} />
          </div>
          <span style={{ fontSize: 12, color: "#8a84a8" }}>
            {free === 1 ? "Puoi aggiungerne ancora una." : `Puoi aggiungerne ancora ${free}.`} Il punto di timbratura si
            imposta dalla sede.
          </span>
          <button
            type="submit"
            disabled={pending}
            style={{ minHeight: 46, border: 0, borderRadius: 999, background: "#6d3df0", color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 15 }}
          >
            {pending ? "Un momento…" : "Aggiungi la sede"}
          </button>
        </form>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: "#5b5675" }}>
          {limit <= 1
            ? "Il piano comprende una sede: le altre si aggiungono dall'abbonamento, 7,99 € l'una."
            : `Il piano comprende ${limit} sedi, tutte in uso. Altre si aggiungono dall'abbonamento, 7,99 € l'una.`}
        </p>
      )}

      {error ? (
        <span role="alert" style={{ padding: "9px 11px", borderRadius: 13, fontSize: 13.5, fontWeight: 800, background: "#fff1f2", border: "1px solid #fecdd3", color: "#b3202f" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
