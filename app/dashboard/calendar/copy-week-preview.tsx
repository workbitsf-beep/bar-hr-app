"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { describeActionError, isActionFailure } from "@/lib/rule-error";
import { copyPreviousWeekShiftsAction, previewPreviousWeekShiftsAction } from "../actions";
import { useOverlayLock } from "../use-overlay-lock";

type PreviewItem = {
  title: string | null;
  isOnCall: boolean;
  department: string | null;
  dayKey: string;
  start: string;
  end: string;
  people: { id: string; name: string }[];
};

type Row = PreviewItem & { key: string; removed: boolean };

/**
 * "Copia la settimana scorsa", looked over first: the shifts it would put in,
 * by day, in a popup. Hours can be changed, a person or a whole shift taken
 * out (and put back), and only then "Copia" writes them as drafts. Copying
 * used to fill the week at once, and a wrong shift had to be found and fixed
 * by hand afterwards.
 */
export function CopyWeekPreview({
  weekStart,
  onClose,
  onCopied,
}: {
  weekStart: string;
  onClose: () => void;
  /** The copy's result, for the caller's toast and "not copied" report. */
  onCopied: (result: unknown) => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [left, setLeft] = useState<string[]>([]);
  const [alreadyThere, setAlreadyThere] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  useOverlayLock(true);

  useEffect(() => {
    const form = new FormData();
    form.set("weekStart", weekStart);
    let gone = false;
    previewPreviousWeekShiftsAction(form)
      .then((result) => {
        if (gone) return;
        if (isActionFailure(result)) {
          setError(describeActionError(result));
          setRows([]);
          return;
        }
        const value = result as { items?: PreviewItem[]; left?: string[]; alreadyThere?: number };
        setRows((value.items ?? []).map((item, index) => ({ ...item, key: String(index), removed: false })));
        setLeft(value.left ?? []);
        setAlreadyThere(value.alreadyThere ?? 0);
      })
      .catch((caught) => {
        if (gone) return;
        setError(describeActionError(caught));
        setRows([]);
      });
    return () => {
      gone = true;
    };
  }, [weekStart]);

  function change(key: string, patch: Partial<Row>) {
    setRows((current) => (current ?? []).map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  const kept = (rows ?? []).filter((row) => !row.removed && row.people.length > 0 && row.start !== row.end);

  function copy() {
    const form = new FormData();
    form.set("weekStart", weekStart);
    form.set(
      "plan",
      JSON.stringify(
        kept.map((row) => ({
          title: row.title,
          isOnCall: row.isOnCall,
          department: row.department,
          dayKey: row.dayKey,
          start: row.start,
          end: row.end,
          people: row.people.map((person) => person.id),
        })),
      ),
    );
    setError(null);
    startTransition(async () => {
      try {
        const result = await copyPreviousWeekShiftsAction(form);
        if (isActionFailure(result)) {
          setError(describeActionError(result));
          return;
        }
        onCopied(result);
      } catch (caught) {
        setError(describeActionError(caught));
      }
    });
  }

  const dayTitle = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const days = Array.from(new Set((rows ?? []).map((row) => row.dayKey)));

  const sheet = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Copia la settimana scorsa"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: "rgba(22, 22, 29, 0.42)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(600px, 100%)",
          maxHeight: "92dvh",
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr) auto",
          background: "#f7f6fb",
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -12px 40px rgba(30, 20, 70, 0.18)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "18px 18px 12px" }}>
          <span style={{ display: "grid", gap: 2 }}>
            <strong style={{ fontSize: 19, letterSpacing: "-0.02em", color: "#16161d" }}>Copia la settimana scorsa</strong>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#8a84a8" }}>
              {rows === null
                ? "Preparo i turni…"
                : `${kept.length === 1 ? "1 turno" : `${kept.length} turni`} da copiare · cambia o togli prima di copiare`}
            </span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            style={{ width: 36, height: 36, flex: "0 0 auto", borderRadius: 999, border: 0, background: "#efecff", color: "#4c1d95", fontSize: 20, cursor: "pointer" }}
          >
            ×
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "0 18px 14px", display: "grid", gap: 14, alignContent: "start" }}>
          {left.length ? (
            <div style={{ display: "grid", gap: 6, padding: "12px 14px", borderRadius: 16, border: "1px solid #fcd9a5", background: "#fff8eb", color: "#7a4a06" }}>
              <strong style={{ fontSize: 14 }}>{left.length === 1 ? "1 turno non si può copiare" : `${left.length} turni non si possono copiare`}</strong>
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 3, fontSize: 13 }}>
                {left.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {rows !== null && rows.length === 0 && !error ? (
            <p style={{ margin: 0, padding: "18px 4px", fontSize: 14.5, color: "#4c4670" }}>
              {alreadyThere > 0 ? "I turni della settimana scorsa ci sono già." : "Niente da copiare: la settimana prima è vuota."}
            </p>
          ) : null}

          {days.map((dayKey) => (
            <section key={dayKey} style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a84a8" }}>
                {dayTitle.format(new Date(`${dayKey}T12:00:00Z`))}
              </span>
              {(rows ?? [])
                .filter((row) => row.dayKey === dayKey)
                .map((row) => (
                  <ShiftRow key={row.key} row={row} onChange={(patch) => change(row.key, patch)} />
                ))}
            </section>
          ))}
        </div>

        <div style={{ display: "grid", gap: 8, padding: "12px 18px calc(14px + env(safe-area-inset-bottom))", borderTop: "1px solid #ebe8f6", background: "#ffffff" }}>
          {error ? (
            <span role="alert" style={{ fontSize: 13.5, fontWeight: 700, color: "#b3202f" }}>
              {error}
            </span>
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)", gap: 8 }}>
            <button type="button" onClick={onClose} style={buttonStyle("plain")}>
              Annulla
            </button>
            <button type="button" disabled={isPending || kept.length === 0} onClick={copy} style={{ ...buttonStyle("primary"), opacity: kept.length === 0 ? 0.5 : 1 }}>
              {isPending ? "Copio…" : kept.length === 1 ? "Copia 1 turno" : `Copia ${kept.length} turni`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(sheet, document.body);
}

function ShiftRow({ row, onChange }: { row: Row; onChange: (patch: Partial<Row>) => void }) {
  if (row.removed) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", borderRadius: 16, border: "1.5px dashed #e2deef", color: "#8a84a8" }}>
        <span style={{ fontSize: 13.5, textDecoration: "line-through" }}>
          {row.start}–{row.end} · {row.people.map((person) => person.name).join(", ") || "nessuno"}
        </span>
        <button type="button" onClick={() => onChange({ removed: false })} style={{ ...buttonStyle("edit"), minHeight: 34, padding: "0 12px" }}>
          Rimetti
        </button>
      </div>
    );
  }

  const empty = row.people.length === 0;
  return (
    <div style={{ display: "grid", gap: 10, padding: "12px 14px", borderRadius: 18, background: "#ffffff", border: `1.5px solid ${empty ? "#fecaca" : "#ebe8f6"}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <input type="time" aria-label="Inizio" value={row.start} onChange={(event) => event.target.value && onChange({ start: event.target.value })} style={timeStyle} />
        <span style={{ color: "#8a84a8", fontWeight: 800 }}>–</span>
        <input type="time" aria-label="Fine" value={row.end} onChange={(event) => event.target.value && onChange({ end: event.target.value })} style={timeStyle} />
        {row.end < row.start ? <span style={{ fontSize: 12, fontWeight: 700, color: "#8a84a8" }}>fino al giorno dopo</span> : null}
        <button
          type="button"
          onClick={() => onChange({ removed: true })}
          style={{ ...buttonStyle("danger"), minHeight: 34, padding: "0 12px", marginLeft: "auto" }}
        >
          Togli
        </button>
      </div>
      {row.title || row.isOnCall ? (
        <span style={{ fontSize: 13, fontWeight: 700, color: "#4c4670" }}>
          {[row.title, row.isOnCall ? "Reperibilità" : null].filter(Boolean).join(" · ")}
        </span>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {row.people.map((person) => (
          <span
            key={person.id}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32, padding: "0 4px 0 12px", borderRadius: 999, background: "#f5f3ff", color: "#3b1d8f", fontSize: 13.5, fontWeight: 700 }}
          >
            {person.name}
            <button
              type="button"
              aria-label={`Togli ${person.name}`}
              onClick={() => onChange({ people: row.people.filter((other) => other.id !== person.id) })}
              style={{ width: 26, height: 26, borderRadius: 999, border: 0, background: "transparent", color: "#6d5bd0", fontSize: 16, cursor: "pointer" }}
            >
              ×
            </button>
          </span>
        ))}
        {empty ? <span style={{ fontSize: 13, fontWeight: 700, color: "#b3202f" }}>Nessuno: non verrà copiato.</span> : null}
      </div>
    </div>
  );
}

const timeStyle = {
  minHeight: 38,
  padding: "0 10px",
  borderRadius: 12,
  border: "1.5px solid #e2deef",
  background: "#ffffff",
  color: "#16161d",
  fontSize: 16,
  fontWeight: 800,
  fontFamily: "inherit",
  fontVariantNumeric: "tabular-nums",
} as const;

function buttonStyle(kind: "edit" | "danger" | "plain" | "primary") {
  const base = { minHeight: 46, borderRadius: 14, fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" };
  switch (kind) {
    case "edit":
      return { ...base, border: "1.5px solid #ddd6fe", background: "#f5f3ff", color: "#5b21b6" };
    case "danger":
      return { ...base, border: "1.5px solid #fecaca", background: "#fff5f5", color: "#b3202f" };
    case "plain":
      return { ...base, border: "1.5px solid #e9e6f5", background: "#ffffff", color: "#4c4670" };
    default:
      return { ...base, border: 0, background: "linear-gradient(135deg, #3b1d8f 0%, #5e4ae3 55%, #8b5cf6 100%)", color: "#ffffff" };
  }
}
