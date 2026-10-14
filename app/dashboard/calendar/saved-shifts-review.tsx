"use client";

import { useState } from "react";

export type SavedShiftRow = {
  id: string;
  shiftId: string | null;
  dayLabel: string;
  time: string;
  people: string;
  onCall: boolean;
  /** False for a day already gone: shown, not changed. */
  editable: boolean;
};

/**
 * The shifts just put in, behind one button above "Nuovo turno": the list
 * squeezed above the form, with swipe-to-edit, was hard to read and to use.
 * Here each shift is a row with its day, hours and people in full, and two
 * plain buttons. Deleting asks once more on the same row.
 */
export function SavedShiftsButton({ count, summary, onOpen }: { count: number; summary: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        padding: "12px 14px",
        borderRadius: 18,
        border: "1.5px solid #dcfce7",
        background: "#f3fdf6",
        textAlign: "left",
        cursor: "pointer",
        font: "inherit",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 30,
          height: 30,
          flex: "0 0 auto",
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          background: "#dcfce7",
          color: "#166534",
          fontWeight: 900,
        }}
      >
        ✓
      </span>
      <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
        <strong style={{ fontSize: 15, color: "#14532d" }}>
          Rivedi i turni inseriti · {count}
        </strong>
        <span
          style={{
            fontSize: 12.5,
            color: "#3f6b4f",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {summary}
        </span>
      </span>
      <span aria-hidden="true" style={{ color: "#16a34a", fontSize: 20, fontWeight: 700 }}>
        ›
      </span>
    </button>
  );
}

export function SavedShiftsReview({
  rows,
  pending,
  onBack,
  onEdit,
  onDelete,
}: {
  rows: SavedShiftRow[];
  pending: boolean;
  onBack: () => void;
  onEdit: (row: SavedShiftRow) => void;
  onDelete: (row: SavedShiftRow) => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Torna al nuovo turno"
          style={{
            width: 36,
            height: 36,
            flex: "0 0 auto",
            borderRadius: 999,
            border: 0,
            background: "#efecff",
            color: "#4c1d95",
            fontSize: 18,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          ‹
        </button>
        <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
          <strong style={{ fontSize: 19, letterSpacing: "-0.02em", color: "#16161d" }}>Turni inseriti</strong>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#8a84a8" }}>
            {rows.length === 1 ? "1 turno" : `${rows.length} turni`} · da pubblicare con la settimana
          </span>
        </span>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((row) => {
          const asking = confirming === row.id;
          return (
            <div
              key={row.id}
              style={{
                display: "grid",
                gap: 10,
                padding: "13px 14px",
                borderRadius: 18,
                background: "#ffffff",
                border: `1.5px solid ${asking ? "#fecaca" : "#ebe8f6"}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <strong style={{ fontSize: 16, color: "#16161d" }}>{row.dayLabel}</strong>
                <strong style={{ fontSize: 17, color: "#16161d", fontVariantNumeric: "tabular-nums" }}>{row.time}</strong>
              </div>
              <span style={{ fontSize: 14, color: "#4c4670", lineHeight: 1.4 }}>
                {row.people}
                {row.onCall ? " · Reperibilità" : ""}
              </span>

              {row.editable ? (
                asking ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "#b3202f" }}>
                      Eliminare questo turno? Non si torna indietro.
                    </span>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                      <button type="button" onClick={() => setConfirming(null)} style={buttonStyle("plain")}>
                        Annulla
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setConfirming(null);
                          onDelete(row);
                        }}
                        style={buttonStyle("danger-strong")}
                      >
                        Sì, elimina
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                    <button type="button" disabled={pending} onClick={() => onEdit(row)} style={buttonStyle("edit")}>
                      Modifica
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setConfirming(row.id)}
                      style={buttonStyle("danger")}
                    >
                      Elimina
                    </button>
                  </div>
                )
              ) : (
                <span style={{ fontSize: 12.5, color: "#8a84a8" }}>Giorno passato: non si modifica.</span>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" onClick={onBack} style={buttonStyle("primary")}>
        Aggiungi un altro turno
      </button>
    </div>
  );
}

function buttonStyle(kind: "edit" | "danger" | "danger-strong" | "plain" | "primary") {
  const base = {
    minHeight: 44,
    borderRadius: 14,
    fontSize: 14.5,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "inherit",
  };
  switch (kind) {
    case "edit":
      return { ...base, fontWeight: 800, border: "1.5px solid #ddd6fe", background: "#f5f3ff", color: "#5b21b6" };
    case "danger":
      return { ...base, fontWeight: 800, border: "1.5px solid #fecaca", background: "#fff5f5", color: "#b3202f" };
    case "danger-strong":
      return { ...base, fontWeight: 800, border: 0, background: "#dc2626", color: "#ffffff" };
    case "plain":
      return { ...base, fontWeight: 800, border: "1.5px solid #e9e6f5", background: "#ffffff", color: "#4c4670" };
    default:
      return {
        ...base,
        minHeight: 50,
        fontWeight: 800,
        border: 0,
        borderRadius: 16,
        background: "linear-gradient(135deg, #3b1d8f 0%, #5e4ae3 55%, #8b5cf6 100%)",
        color: "#ffffff",
      };
  }
}
