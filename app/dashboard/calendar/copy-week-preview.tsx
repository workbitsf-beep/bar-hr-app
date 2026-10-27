"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { describeActionError, isActionFailure } from "@/lib/rule-error";
import { copyPreviousWeekShiftsAction, previewPreviousWeekShiftsAction } from "../actions";
import { SwipeRevealAction } from "../swipe-reveal-action";
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

type Row = PreviewItem & { key: string; selected: boolean };

/**
 * "Copia la settimana scorsa" as a pick list: last week's shifts, by day,
 * none chosen at first. The owner taps the ones worth keeping (or a whole
 * day, or all), can swipe one open to change hours or people, and "Copia"
 * writes only those as drafts; the rest of the week is added by hand from the
 * calendar as usual.
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
        setRows((value.items ?? []).map((item, index) => ({ ...item, key: String(index), selected: false })));
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

  const kept = (rows ?? []).filter((row) => row.selected && row.people.length > 0 && row.start !== row.end);

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

  function selectWhere(match: (row: Row) => boolean, selected: boolean) {
    setRows((current) => (current ?? []).map((row) => (match(row) ? { ...row, selected } : row)));
  }

  const allSelected = Boolean(rows?.length) && (rows ?? []).every((row) => row.selected);

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
                : rows.length === 0
                  ? "Niente da scegliere"
                  : "Tocca i turni che vuoi · scorri a destra per cambiarli · il resto lo aggiungi tu"}
            </span>
          </span>
          {rows?.length ? (
            <button
              type="button"
              onClick={() => selectWhere(() => true, !allSelected)}
              style={{ ...buttonStyle("edit"), minHeight: 36, padding: "0 12px", fontSize: 13.5, flex: "0 0 auto" }}
            >
              {allSelected ? "Nessuno" : "Tutti"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            style={{ width: 36, height: 36, flex: "0 0 auto", borderRadius: 999, border: 0, background: "#efecff", color: "#4c1d95", fontSize: 20, cursor: "pointer" }}
          >
            ×
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "0 18px 14px", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 14, alignContent: "start" }}>
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

          {days.map((dayKey) => {
            const dayRows = (rows ?? []).filter((row) => row.dayKey === dayKey);
            const chosen = dayRows.filter((row) => row.selected).length;
            const whole = chosen === dayRows.length;
            return (
              <section key={dayKey} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8 }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 2px" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a84a8" }}>
                    {dayTitle.format(new Date(`${dayKey}T12:00:00Z`))}
                  </span>
                  <button
                    type="button"
                    onClick={() => selectWhere((row) => row.dayKey === dayKey, !whole)}
                    style={{ border: 0, background: "transparent", padding: "4px 2px", fontSize: 12.5, fontWeight: 800, color: "#6d28d9", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    {whole ? "Togli il giorno" : chosen ? `${chosen} di ${dayRows.length} · tutto il giorno` : "Tutto il giorno"}
                  </button>
                </span>
                {dayRows.map((row) => (
                  <ShiftRow key={row.key} row={row} onChange={(patch) => change(row.key, patch)} />
                ))}
              </section>
            );
          })}
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
              {isPending ? "Copio…" : kept.length === 0 ? "Scegli i turni" : kept.length === 1 ? "Copia 1 turno" : `Copia ${kept.length} turni`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(sheet, document.body);
}

function ShiftRow({ row, onChange }: { row: Row; onChange: (patch: Partial<Row>) => void }) {
  const [editing, setEditing] = useState(false);
  // A mouse drag that opens the swipe still ends in a click; only a tap toggles.
  const pressX = useRef<number | null>(null);

  const empty = row.people.length === 0;
  const overnight = row.end < row.start;

  if (editing) {
    return (
      <div style={{ display: "grid", gap: 12, padding: 14, borderRadius: 16, background: "#ffffff", border: "1.5px solid #c4b5fd", boxShadow: "0 8px 22px rgba(94, 74, 227, 0.12)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)", alignItems: "end", gap: 8 }}>
          <label style={fieldStyle}>
            Inizio
            <input type="time" value={row.start} onChange={(event) => event.target.value && onChange({ start: event.target.value })} style={timeStyle} />
          </label>
          <span style={{ paddingBottom: 12, color: "#a49fc0", fontWeight: 800 }}>–</span>
          <label style={fieldStyle}>
            Fine
            <input type="time" value={row.end} onChange={(event) => event.target.value && onChange({ end: event.target.value })} style={timeStyle} />
          </label>
        </div>
        {overnight ? <span style={{ marginTop: -4, fontSize: 12.5, fontWeight: 700, color: "#8a84a8" }}>Finisce il giorno dopo.</span> : null}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {row.people.map((person) => (
            <span
              key={person.id}
              style={{ display: "inline-flex", alignItems: "center", gap: 2, minHeight: 34, padding: "0 4px 0 12px", borderRadius: 999, background: "#f5f3ff", color: "#3b1d8f", fontSize: 13.5, fontWeight: 700 }}
            >
              {person.name}
              <button
                type="button"
                aria-label={`Togli ${person.name}`}
                onClick={() => onChange({ people: row.people.filter((other) => other.id !== person.id) })}
                style={{ width: 28, height: 28, borderRadius: 999, border: 0, background: "transparent", color: "#6d5bd0", fontSize: 17, cursor: "pointer" }}
              >
                ×
              </button>
            </span>
          ))}
          {empty ? <span style={{ fontSize: 13, fontWeight: 700, color: "#b3202f" }}>Nessuno: non verrà copiato.</span> : null}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              onChange({ selected: false });
            }}
            style={{ ...buttonStyle("plain"), minHeight: 40 }}
          >
            Non copiarlo
          </button>
          <button type="button" onClick={() => setEditing(false)} style={{ ...buttonStyle("edit"), minHeight: 40 }}>
            Fatto
          </button>
        </div>
      </div>
    );
  }

  const note = [row.title, row.isOnCall ? "Reperibilità" : null, overnight ? "fino al giorno dopo" : null].filter(Boolean).join(" · ");
  const on = row.selected;

  return (
    <SwipeRevealAction
      resetKey={`${row.key}-${row.start}-${row.end}-${row.people.length}-${on}`}
      revealWidth={62}
      actionInset={8}
      borderRadius={16}
      leadingAction={
        <button
          type="button"
          aria-label="Modifica turno"
          onClick={() => {
            onChange({ selected: true });
            setEditing(true);
          }}
          style={swipeButtonStyle("#7c3aed", "#ddd6fe")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m14.5 5.5 4 4M4 20l4.5-1 10.5-10.5a2.8 2.8 0 0 0-4-4L4.5 15 4 20Z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      }
      action={
        <button type="button" aria-label="Non copiarlo" onClick={() => onChange({ selected: false })} style={swipeButtonStyle("#ef4444", "#fecaca")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      }
    >
      <div
        aria-pressed={on}
        aria-label={`${on ? "Scelto" : "Non scelto"}: ${row.start}–${row.end} ${row.people.map((person) => person.name).join(", ")}`}
        onPointerDown={(event) => {
          pressX.current = event.clientX;
        }}
        onClick={(event) => {
          if (pressX.current !== null && Math.abs(event.clientX - pressX.current) > 8) return;
          onChange({ selected: !on });
        }}
        style={{
          display: "grid",
          gridTemplateColumns: "24px 52px minmax(0, 1fr)",
          alignItems: "center",
          gap: 12,
          minHeight: 60,
          padding: "10px 14px",
          borderRadius: 16,
          background: on ? "#ffffff" : "#fbfaff",
          border: `1.5px solid ${on ? (empty ? "#fecaca" : "#a78bfa") : "#ebe8f6"}`,
          cursor: "pointer",
          userSelect: "none",
          WebkitUserSelect: "none",
          transition: "border-color 140ms ease, background 140ms ease",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            border: on ? 0 : "2px solid #d4cfe8",
            background: on ? "linear-gradient(135deg, #5e4ae3, #8b5cf6)" : "#ffffff",
            color: "#ffffff",
          }}
        >
          {on ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </span>
        <span style={{ display: "grid", gap: 1, paddingRight: 12, borderRight: "1.5px solid #efecff", fontVariantNumeric: "tabular-nums", opacity: on ? 1 : 0.55 }}>
          <strong style={{ fontSize: 15.5, color: "#16161d" }}>{row.start}</strong>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#8a84a8" }}>{row.end}</span>
        </span>
        <span style={{ display: "grid", gap: 2, minWidth: 0, opacity: on ? 1 : 0.55 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14.5, fontWeight: 800, color: empty ? "#b3202f" : "#16161d" }}>
            {empty ? "Nessuno: non verrà copiato" : row.people.map((person) => person.name).join(", ")}
          </span>
          {note ? <span style={{ fontSize: 12.5, fontWeight: 700, color: "#8a84a8" }}>{note}</span> : null}
        </span>
      </div>
    </SwipeRevealAction>
  );
}

function swipeButtonStyle(background: string, border: string) {
  return { width: 38, height: 38, borderRadius: 13, border: `1px solid ${border}`, background, color: "#ffffff", cursor: "pointer", fontWeight: 900 } as const;
}

const fieldStyle = { display: "grid", gap: 4, fontSize: 11.5, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8a84a8" } as const;

const timeStyle = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 44,
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
