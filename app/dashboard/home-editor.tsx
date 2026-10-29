"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ActionForm } from "@/app/components/action-form";
import { PendingButton } from "@/app/components/pending-button";
import { HOME_REPLACES, type HomeBlock, type HomeBlockKey } from "@/lib/home-blocks";
import { saveHomeBlocksAction } from "./home-actions";

const cap: CSSProperties = { fontSize: 12.5, color: "#667085" };
const card: CSSProperties = { background: "#ffffff", border: "1px solid rgba(94, 92, 230, 0.1)", borderRadius: 18, padding: "14px 15px", boxShadow: "0 6px 16px rgba(61, 42, 153, 0.05)", color: "#20202a" };
const head: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 14.5, fontWeight: 800 };
const row: CSSProperties = { display: "flex", justifyContent: "space-between", padding: "7px 0", borderTop: "1px solid #f1eff8", fontSize: 13.5 };
const yes: CSSProperties = { width: 30, height: 30, borderRadius: 999, background: "#dcfce7", color: "#166534", fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13 };

/* What each widget looks like, with made-up numbers: the gallery shows the
   shape, Oggi shows the venue's own. */
const PREVIEWS: Partial<Record<HomeBlockKey, ReactNode>> = {
  costs: (
    <div style={card}>
      <div style={head}>
        <span>💶 Costi di ottobre</span>
        <span style={{ ...cap, fontWeight: 400 }}>29 fatture</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
        <b style={{ fontSize: 26, letterSpacing: "-0.03em" }}>11.420 €</b>
        <b style={{ color: "#b3202f", fontSize: 13 }}>▲ 6%</b>
        <span style={cap}>sul mese prima</span>
      </div>
      <div style={{ display: "flex", height: 9, borderRadius: 999, overflow: "hidden", marginTop: 10 }}>
        <span style={{ width: "46%", background: "#8b6cf0" }} />
        <span style={{ width: "31%", background: "#f59e0b" }} />
        <span style={{ width: "13%", background: "#22c55e" }} />
        <span style={{ width: "10%", background: "#94a3b8" }} />
      </div>
      <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 12, background: "#fff7e6", fontSize: 12.5, color: "#92400e" }}>💡 Il latte è salito del 12%: 340 € l&apos;anno</div>
    </div>
  ),
  absences: (
    <div style={card}>
      <div style={head}>
        <span>📨 Richieste e assenze</span>
        <span style={{ ...cap, fontWeight: 400 }}>1 da decidere</span>
      </div>
      <div style={{ ...row, borderTop: 0, alignItems: "center" }}>
        <span style={{ display: "grid" }}>
          <b>Ferie · Luca</b>
          <span style={cap}>3 nov – 7 nov</span>
        </span>
        <span style={{ display: "flex", gap: 6 }}>
          <span style={yes}>✓</span>
          <span style={{ ...yes, background: "#fdecec", color: "#b3202f" }}>✕</span>
        </span>
      </div>
      <div style={{ ...row, justifyContent: "flex-start", gap: 6, flexWrap: "wrap" }}>
        <span style={cap}>Fuori questa settimana:</span>
        <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "#f4f3f9" }}>🤒 Marco</span>
      </div>
    </div>
  ),
  prices: (
    <div style={card}>
      <div style={head}>
        <span>📈 Prezzi che salgono</span>
      </div>
      <div style={{ ...row, borderTop: 0 }}>
        <span>Latte intero · Parmalat</span>
        <b style={{ color: "#b3202f" }}>+12%</b>
      </div>
      <div style={row}>
        <span>Caffè in grani · Lavazza</span>
        <b style={{ color: "#b3202f" }}>+5%</b>
      </div>
      <div style={row}>
        <span>Cornetti · Bindi</span>
        <b style={{ color: "#0f7a4f" }}>−3%</b>
      </div>
    </div>
  ),
  staffMonth: (
    <div style={card}>
      <div style={head}>
        <span>⏱ Personale del mese</span>
        <span style={{ ...cap, fontWeight: 400 }}>ottobre</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", textAlign: "center", marginTop: 10 }}>
        <span style={{ display: "grid" }}>
          <b style={{ fontSize: 19 }}>412h</b>
          <span style={cap}>lavorate</span>
        </span>
        <span style={{ display: "grid" }}>
          <b style={{ fontSize: 19, color: "#b45309" }}>18h</b>
          <span style={cap}>straordinari</span>
        </span>
        <span style={{ display: "grid" }}>
          <b style={{ fontSize: 19 }}>5.180 €</b>
          <span style={cap}>paga lorda</span>
        </span>
      </div>
    </div>
  ),
  deadlines: (
    <div style={card}>
      <div style={head}>
        <span>⏰ Scadenze</span>
        <span style={{ ...cap, fontWeight: 400 }}>prossimi 30 giorni</span>
      </div>
      <div style={{ ...row, borderTop: 0 }}>
        <span>
          <b>4 nov</b> HACCP di Sara
        </span>
        <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "#fdecec", color: "#b3202f" }}>fra 6 gg</span>
      </div>
      <div style={row}>
        <span>
          <b>12 nov</b> Corso antincendio
        </span>
        <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "#f4f3f9" }}>corso</span>
      </div>
    </div>
  ),
};

/**
 * Oggi, rearranged. Two tabs: the widgets that can be added, each shown as
 * it looks; and Oggi's own list, dragged by its handle into order, with −
 * to take a block off. Saved as one list.
 */
export function HomeEditor({ shown, choices, extras }: { shown: HomeBlockKey[]; choices: HomeBlock[]; extras: HomeBlockKey[] }) {
  const [on, setOn] = useState<HomeBlockKey[]>(shown.filter((key) => choices.some((choice) => choice.key === key)));
  const [tab, setTab] = useState<"add" | "mine">(extras.length ? "add" : "mine");
  const [dragging, setDragging] = useState<HomeBlockKey | null>(null);
  const rows = useRef(new Map<HomeBlockKey, HTMLDivElement>());
  const byKey = new Map(choices.map((choice) => [choice.key, choice]));
  const gallery = extras.filter((key) => byKey.has(key));
  const baseOff = choices.filter((choice) => !gallery.includes(choice.key) && !on.includes(choice.key));

  const add = (key: HomeBlockKey) =>
    setOn((current) => {
      const replaced = HOME_REPLACES[key];
      const kept = current.filter((item) => item !== replaced);
      // A widget goes where the block it replaces was, or on top.
      const at = replaced && current.includes(replaced) ? current.indexOf(replaced) : 0;
      return [...kept.slice(0, at), key, ...kept.slice(at)];
    });
  const remove = (key: HomeBlockKey) => setOn((current) => current.filter((item) => item !== key));

  // Dragging by the handle: the row under the finger takes the dragged one's place.
  const moveTo = (clientY: number) => {
    if (!dragging) return;
    setOn((current) => {
      const target = current.findIndex((key) => {
        const box = rows.current.get(key)?.getBoundingClientRect();
        return box ? clientY < box.top + box.height / 2 : false;
      });
      const from = current.indexOf(dragging);
      let to = target === -1 ? current.length - 1 : target > from ? target - 1 : target;
      to = Math.max(0, Math.min(current.length - 1, to));
      if (to === from) return current;
      const next = current.filter((key) => key !== dragging);
      next.splice(to, 0, dragging);
      return next;
    });
  };

  const tabButton = (id: "add" | "mine", label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      aria-pressed={tab === id}
      style={{
        flex: 1,
        border: 0,
        borderRadius: 11,
        padding: "9px 0",
        fontSize: 14,
        cursor: "pointer",
        background: tab === id ? "#ffffff" : "transparent",
        color: tab === id ? "#1f1b3a" : "#5b5675",
        fontWeight: tab === id ? 650 : 500,
        boxShadow: tab === id ? "0 1px 2px rgba(31,27,58,.08)" : "none",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "grid", gap: 14, color: "#1f1b3a" }}>
      {gallery.length ? (
        <div style={{ display: "flex", background: "#eeebf7", borderRadius: 14, padding: 3 }}>
          {tabButton("add", "Aggiungi")}
          {tabButton("mine", `La tua Oggi · ${on.length}`)}
        </div>
      ) : null}

      {tab === "add" && gallery.length ? (
        <div style={{ display: "grid", gap: 12 }}>
          {gallery.map((key) => {
            const block = byKey.get(key)!;
            const added = on.includes(key);
            return (
              <div key={key} style={{ display: "grid", gap: 10, padding: 12, borderRadius: 22, background: "#f7f5fd" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
                    <b style={{ fontSize: 15.5, fontWeight: 700 }}>{block.label}</b>
                    <span style={{ fontSize: 12.5, color: "#8a85a3" }}>{block.hint}</span>
                  </span>
                  <button
                    type="button"
                    aria-label={added ? `Togli ${block.label}` : `Aggiungi ${block.label}`}
                    onClick={() => (added ? remove(key) : add(key))}
                    style={{
                      marginLeft: "auto",
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      border: 0,
                      flex: "0 0 auto",
                      cursor: "pointer",
                      fontSize: added ? 15 : 21,
                      fontWeight: 800,
                      background: added ? "#e7f7ef" : "#6d4aed",
                      color: added ? "#0f7a4f" : "#ffffff",
                    }}
                  >
                    {added ? "✓" : "+"}
                  </button>
                </div>
                <div aria-hidden style={{ pointerEvents: "none", zoom: 0.92 }}>
                  {PREVIEWS[key]}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "grid" }}>
          {on.length === 0 ? <span style={{ padding: "12px 0", color: "#8a85a3", fontSize: 14.5 }}>Nessun blocco: aggiungine uno.</span> : null}
          {on.map((key, index) => {
            const block = byKey.get(key)!;
            return (
              <div
                key={key}
                ref={(node) => {
                  if (node) rows.current.set(key, node);
                  else rows.current.delete(key);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderTop: index ? "1px solid #f1eff8" : 0,
                  borderRadius: dragging === key ? 14 : 0,
                  background: dragging === key ? "#f1eeff" : "transparent",
                  boxShadow: dragging === key ? "0 8px 20px rgba(76,29,149,.15)" : "none",
                }}
              >
                <span
                  aria-label={`Trascina ${block.label}`}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDragging(key);
                  }}
                  onPointerMove={(event) => moveTo(event.clientY)}
                  onPointerUp={() => setDragging(null)}
                  onPointerCancel={() => setDragging(null)}
                  style={{ touchAction: "none", cursor: "grab", color: "#b9b4cc", fontSize: 18, letterSpacing: -3, padding: "8px 6px 8px 0", userSelect: "none" }}
                >
                  ⋮⋮
                </span>
                <span style={{ fontSize: 18 }} aria-hidden>
                  {block.emoji}
                </span>
                <span style={{ fontSize: 15.5, minWidth: 0 }}>{block.label}</span>
                <button
                  type="button"
                  aria-label={`Togli ${block.label}`}
                  onClick={() => remove(key)}
                  style={{ marginLeft: "auto", width: 30, height: 30, borderRadius: 999, border: 0, background: "#fdecec", color: "#b3202f", fontWeight: 900, fontSize: 16, cursor: "pointer", flex: "0 0 auto" }}
                >
                  −
                </button>
              </div>
            );
          })}
          {baseOff.length ? (
            <div style={{ display: "grid", marginTop: 10 }}>
              <span style={{ fontSize: 12.5, color: "#8a85a3", padding: "0 10px 4px" }}>Tolti</span>
              {baseOff.map((block) => (
                <div key={block.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderTop: "1px solid #f1eff8", color: "#8a85a3" }}>
                  <span style={{ fontSize: 18, opacity: 0.6 }} aria-hidden>
                    {block.emoji}
                  </span>
                  <span style={{ fontSize: 15 }}>{block.label}</span>
                  <button
                    type="button"
                    aria-label={`Rimetti ${block.label}`}
                    onClick={() => setOn((current) => [...current, block.key])}
                    style={{ marginLeft: "auto", width: 30, height: 30, borderRadius: 999, border: 0, background: "#6d4aed", color: "#ffffff", fontWeight: 800, fontSize: 18, cursor: "pointer", flex: "0 0 auto" }}
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <span style={{ fontSize: 12.5, color: "#8a85a3", textAlign: "center", marginTop: 10 }}>Tieni premuto ⋮⋮ e trascina · − per togliere</span>
        </div>
      )}

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
