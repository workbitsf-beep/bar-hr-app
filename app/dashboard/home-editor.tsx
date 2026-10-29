"use client";

import { useState, type CSSProperties } from "react";
import { ActionForm } from "@/app/components/action-form";
import { PendingButton } from "@/app/components/pending-button";
import type { HomeBlock, HomeBlockKey } from "@/lib/home-blocks";
import { saveHomeBlocksAction } from "./home-actions";

const row: CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderTop: "1px solid #f1eff8" };
const arrow: CSSProperties = { width: 30, height: 30, borderRadius: 999, border: 0, background: "#f4f3f9", color: "#4c1d95", fontSize: 14, cursor: "pointer", padding: 0, flex: "0 0 auto" };
const cap: CSSProperties = { fontSize: 11.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6d4aed", paddingTop: 4 };

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      style={{ marginLeft: "auto", width: 46, height: 28, borderRadius: 999, border: 0, padding: 0, background: on ? "#6d4aed" : "#e4e1ee", position: "relative", cursor: "pointer", flex: "0 0 auto", transition: "background .15s" }}
    >
      <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: 999, background: "#ffffff", boxShadow: "0 1px 2px rgba(0,0,0,.15)", transition: "left .15s" }} />
    </button>
  );
}

/**
 * Oggi, rearranged: what is on it with arrows to move it and a switch to take
 * it off, then what can be added. Saved as one list, in order.
 */
export function HomeEditor({ shown, choices }: { shown: HomeBlockKey[]; choices: HomeBlock[] }) {
  const [on, setOn] = useState<HomeBlockKey[]>(shown.filter((key) => choices.some((choice) => choice.key === key)));
  const byKey = new Map(choices.map((choice) => [choice.key, choice]));
  const off = choices.filter((choice) => !on.includes(choice.key));

  const move = (index: number, by: number) =>
    setOn((current) => {
      const next = [...current];
      const target = index + by;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  return (
    <div style={{ display: "grid", gap: 14, color: "#1f1b3a" }}>
      <div style={{ display: "grid" }}>
        <span style={cap}>Sulla tua Oggi</span>
        {on.length === 0 ? <span style={{ ...row, borderTop: 0, color: "#8a85a3", fontSize: 14.5 }}>Nessun blocco: accendine uno qui sotto.</span> : null}
        {on.map((key, index) => {
          const block = byKey.get(key)!;
          return (
            <div key={key} style={{ ...row, borderTop: index ? row.borderTop : 0 }}>
              <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <button type="button" aria-label={`Sposta su ${block.label}`} disabled={index === 0} onClick={() => move(index, -1)} style={{ ...arrow, opacity: index === 0 ? 0.35 : 1 }}>
                  ↑
                </button>
                <button type="button" aria-label={`Sposta giù ${block.label}`} disabled={index === on.length - 1} onClick={() => move(index, 1)} style={{ ...arrow, opacity: index === on.length - 1 ? 0.35 : 1 }}>
                  ↓
                </button>
              </span>
              <span style={{ fontSize: 19 }} aria-hidden>
                {block.emoji}
              </span>
              <span style={{ fontSize: 15.5, minWidth: 0 }}>{block.label}</span>
              <Toggle on label={`Togli ${block.label}`} onClick={() => setOn((current) => current.filter((item) => item !== key))} />
            </div>
          );
        })}
      </div>

      {off.length ? (
        <div style={{ display: "grid" }}>
          <span style={cap}>Puoi aggiungere</span>
          {off.map((block, index) => (
            <div key={block.key} style={{ ...row, borderTop: index ? row.borderTop : 0 }}>
              <span style={{ fontSize: 19 }} aria-hidden>
                {block.emoji}
              </span>
              <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
                <span style={{ fontSize: 15.5 }}>{block.label}</span>
                <span style={{ fontSize: 12.5, color: "#8a85a3" }}>{block.hint}</span>
              </span>
              <Toggle on={false} label={`Aggiungi ${block.label}`} onClick={() => setOn((current) => [...current, block.key])} />
            </div>
          ))}
        </div>
      ) : null}

      <ActionForm action={saveHomeBlocksAction} success="Oggi è come la volevi" style={{ display: "grid" }}>
        <input type="hidden" name="blocks" value={JSON.stringify(on)} />
        <PendingButton
          type="submit"
          pendingLabel="Salvo…"
          style={{ minHeight: 50, borderRadius: 999, border: 0, background: "linear-gradient(135deg,#3b1d8f,#5e4ae3 55%,#8b5cf6)", color: "#ffffff", fontSize: 15.5, fontWeight: 700, cursor: "pointer" }}
        >
          Salva
        </PendingButton>
      </ActionForm>
      <ActionForm action={saveHomeBlocksAction} success="Oggi è tornata come prima" style={{ display: "flex", justifyContent: "center", marginTop: -6 }}>
        <input type="hidden" name="reset" value="1" />
        <button type="submit" style={{ border: 0, background: "transparent", color: "#8a85a3", fontSize: 14, cursor: "pointer", minHeight: 36 }}>
          Torna come prima
        </button>
      </ActionForm>
    </div>
  );
}
