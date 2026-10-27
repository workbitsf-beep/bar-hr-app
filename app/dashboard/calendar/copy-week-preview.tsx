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

type PreviewResult = { items?: PreviewItem[]; left?: string[]; alreadyThere?: number };

/** How long a fetched preview is trusted before the popup asks again. */
const FRESH_MS = 60_000;
const previewCache = new Map<string, { at: number; promise: Promise<unknown>; value?: unknown }>();

/**
 * Starts loading the week's preview before the popup opens, so it opens full.
 * The calendar calls it when the "Copia" button appears and again on press;
 * a fresh entry is reused, so repeated calls cost nothing.
 */
export function prefetchCopyWeekPreview(weekStart: string, force = false) {
  const cached = previewCache.get(weekStart);
  if (cached && !force && Date.now() - cached.at < FRESH_MS) return cached.promise;
  const form = new FormData();
  form.set("weekStart", weekStart);
  const entry: { at: number; promise: Promise<unknown>; value?: unknown } = { at: Date.now(), promise: Promise.resolve() };
  entry.promise = previewPreviousWeekShiftsAction(form).then(
    (result) => {
      if (isActionFailure(result)) previewCache.delete(weekStart);
      else entry.value = result;
      return result;
    },
    (caught) => {
      previewCache.delete(weekStart);
      throw caught;
    },
  );
  previewCache.set(weekStart, entry);
  return entry.promise;
}

function toRows(value: PreviewResult) {
  return (value.items ?? []).map((item, index) => ({ ...item, key: String(index), selected: false }));
}

const INK = "#16161d";
const MUTED = "#8a84a8";
const VIOLET = "#6d5ce7";
const HAIRLINE = "#f0eef8";

/**
 * "Copia la settimana scorsa" as a pick list: last week's shifts, one white
 * card per day, none chosen at first. The owner taps the ones worth keeping
 * (or a whole day, or all), can swipe one open to change hours or people, and
 * "Copia" writes only those as drafts; the rest of the week is added by hand
 * from the calendar as usual.
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
  // Already fetched (the button prefetches): the popup opens full, no loading state.
  const [ready] = useState(() => {
    const cached = previewCache.get(weekStart);
    return cached?.value && Date.now() - cached.at < FRESH_MS ? (cached.value as PreviewResult) : null;
  });
  const [rows, setRows] = useState<Row[] | null>(() => (ready ? toRows(ready) : null));
  const [left, setLeft] = useState<string[]>(() => ready?.left ?? []);
  const [alreadyThere, setAlreadyThere] = useState(() => ready?.alreadyThere ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  useOverlayLock(true);

  useEffect(() => {
    if (ready) return;
    let gone = false;
    prefetchCopyWeekPreview(weekStart)
      .then((result) => {
        if (gone) return;
        if (isActionFailure(result)) {
          setError(describeActionError(result));
          setRows([]);
          return;
        }
        const value = result as PreviewResult;
        setRows(toRows(value));
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
  }, [weekStart, ready]);

  function change(key: string, patch: Partial<Row>) {
    setRows((current) => (current ?? []).map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function selectWhere(match: (row: Row) => boolean, selected: boolean) {
    setRows((current) => (current ?? []).map((row) => (match(row) ? { ...row, selected } : row)));
  }

  const kept = (rows ?? []).filter((row) => row.selected && row.people.length > 0 && row.start !== row.end);
  const total = rows?.length ?? 0;
  const allSelected = total > 0 && (rows ?? []).every((row) => row.selected);

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
        previewCache.delete(weekStart);
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
        alignItems: "center",
        justifyContent: "center",
        padding: "max(16px, env(safe-area-inset-top)) 14px max(16px, env(safe-area-inset-bottom))",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(560px, 100%)",
          maxHeight: "min(86dvh, 780px)",
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr) auto",
          background: "#f4f3fa",
          borderRadius: 26,
          boxShadow: "0 24px 60px rgba(30, 20, 70, 0.28)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "grid", gap: 14, padding: "18px 20px 14px", background: "#f4f3fa", borderBottom: `1px solid #e9e6f5` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
              <strong style={{ fontSize: 20, letterSpacing: "-0.02em", color: INK }}>Copia la settimana scorsa</strong>
              <span style={{ fontSize: 13.5, color: MUTED }}>
                {rows === null ? "Scegli i turni da ripetere, il resto lo aggiungi tu" : total === 0 ? "Niente da scegliere" : "Scegli i turni da ripetere, il resto lo aggiungi tu"}
              </span>
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Chiudi"
              style={{ width: 34, height: 34, flex: "0 0 auto", display: "grid", placeItems: "center", borderRadius: 999, border: 0, background: "#e9e6f5", color: "#4c4670", cursor: "pointer" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {total ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#4c4670", fontVariantNumeric: "tabular-nums" }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: VIOLET }} />
                {kept.length} di {total} scelti
              </span>
              <button type="button" onClick={() => selectWhere(() => true, !allSelected)} style={linkStyle}>
                {allSelected ? "Togli tutti" : "Scegli tutti"}
              </button>
            </div>
          ) : null}
        </div>

        <div style={{ overflowY: "auto", padding: "16px 16px 18px", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 18, alignContent: "start" }}>
          {left.length ? (
            <div style={{ display: "grid", gap: 6, padding: "12px 14px", borderRadius: 18, background: "#ffffff", border: "1px solid #e9e6f5", boxShadow: "inset 3px 0 0 #f59e0b", color: "#7a4a06" }}>
              <span style={{ fontSize: 14 }}>{left.length === 1 ? "1 turno non si può copiare" : `${left.length} turni non si possono copiare`}</span>
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 3, fontSize: 13, color: "#4c4670" }}>
                {left.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {rows === null ? (
            <div aria-hidden="true" style={{ display: "grid", gap: 8 }}>
              <span style={{ width: 150, height: 10, margin: "2px 6px", borderRadius: 999, background: "#e6e3f2" }} />
              <div style={{ borderRadius: 20, background: "#ffffff", border: "1px solid #e9e6f5", overflow: "hidden" }}>
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    style={{ display: "grid", gridTemplateColumns: "38px minmax(0, 1fr) 26px", alignItems: "center", gap: 12, minHeight: 64, padding: "10px 16px", borderTop: index ? `1px solid ${HAIRLINE}` : 0 }}
                  >
                    <span style={{ width: 38, height: 38, borderRadius: 999, background: "#f1effa" }} />
                    <span style={{ display: "grid", gap: 7 }}>
                      <span style={{ width: `${62 - index * 12}%`, height: 11, borderRadius: 999, background: "#ece9f7" }} />
                      <span style={{ width: "34%", height: 9, borderRadius: 999, background: "#f1effa" }} />
                    </span>
                    <span style={{ width: 24, height: 24, borderRadius: 999, border: "1.5px solid #ece9f7" }} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {rows !== null && total === 0 && !error ? (
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
                <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, padding: "0 6px" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>
                    {dayTitle.format(new Date(`${dayKey}T12:00:00Z`))}
                  </span>
                  <button type="button" onClick={() => selectWhere((row) => row.dayKey === dayKey, !whole)} style={linkStyle}>
                    {whole ? "Togli" : chosen ? `${chosen} di ${dayRows.length} · tutti` : "Tutti"}
                  </button>
                </span>
                <div style={{ borderRadius: 20, background: "#ffffff", border: "1px solid #e9e6f5", overflow: "hidden" }}>
                  {dayRows.map((row, index) => (
                    <div key={row.key} style={{ borderTop: index ? `1px solid ${HAIRLINE}` : 0 }}>
                      <ShiftRow row={row} onChange={(patch) => change(row.key, patch)} />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          {total ? (
            <span style={{ padding: "0 6px", fontSize: 12.5, color: MUTED, textAlign: "center" }}>
              Scorri un turno a destra per cambiare orari o persone.
            </span>
          ) : null}
        </div>

        <div style={{ display: "grid", gap: 8, padding: "12px 16px 14px", borderTop: "1px solid #e9e6f5", background: "#ffffff" }}>
          {error ? (
            <span role="alert" style={{ fontSize: 13.5, fontWeight: 700, color: "#b3202f" }}>
              {error}
            </span>
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)", gap: 8 }}>
            <button type="button" onClick={onClose} style={buttonStyle("plain")}>
              Annulla
            </button>
            <button
              type="button"
              disabled={isPending || kept.length === 0}
              onClick={copy}
              style={kept.length === 0 ? { ...buttonStyle("plain"), background: "#f4f3fa", border: 0, color: MUTED, cursor: "default" } : buttonStyle("primary")}
            >
              {isPending ? "Copio…" : kept.length === 0 ? "Nessun turno scelto" : kept.length === 1 ? "Copia 1 turno" : `Copia ${kept.length} turni`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(sheet, document.body);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function ShiftRow({ row, onChange }: { row: Row; onChange: (patch: Partial<Row>) => void }) {
  const [editing, setEditing] = useState(false);
  // A mouse drag that opens the swipe still ends in a click; only a tap toggles.
  const pressX = useRef<number | null>(null);

  const empty = row.people.length === 0;
  const overnight = row.end < row.start;

  if (editing) {
    return (
      <div style={{ display: "grid", gap: 14, padding: "14px 16px 16px", background: "#faf9ff", boxShadow: `inset 3px 0 0 ${VIOLET}` }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)", alignItems: "end", gap: 8 }}>
          <label style={fieldStyle}>
            Inizio
            <input type="time" value={row.start} onChange={(event) => event.target.value && onChange({ start: event.target.value })} style={timeStyle} />
          </label>
          <span style={{ paddingBottom: 12, color: "#a49fc0" }}>–</span>
          <label style={fieldStyle}>
            Fine
            <input type="time" value={row.end} onChange={(event) => event.target.value && onChange({ end: event.target.value })} style={timeStyle} />
          </label>
        </div>
        {overnight ? <span style={{ marginTop: -6, fontSize: 12.5, color: MUTED }}>Finisce il giorno dopo.</span> : null}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {row.people.map((person) => (
            <span
              key={person.id}
              style={{ display: "inline-flex", alignItems: "center", gap: 2, minHeight: 34, padding: "0 4px 0 12px", borderRadius: 999, background: "#efecff", color: "#3b1d8f", fontSize: 13.5 }}
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
          {empty ? <span style={{ fontSize: 13, color: "#b3202f" }}>Nessuno: non verrà copiato.</span> : null}
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
  const names = row.people.map((person) => person.name).join(", ");

  return (
    <SwipeRevealAction
      resetKey={`${row.key}-${row.start}-${row.end}-${row.people.length}-${on}`}
      revealWidth={62}
      actionInset={8}
      borderRadius={0}
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
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
      }
    >
      <div
        aria-pressed={on}
        aria-label={`${on ? "Scelto" : "Non scelto"}: ${row.start}–${row.end} ${names}`}
        onPointerDown={(event) => {
          pressX.current = event.clientX;
        }}
        onClick={(event) => {
          if (pressX.current !== null && Math.abs(event.clientX - pressX.current) > 8) return;
          onChange({ selected: !on });
        }}
        style={{
          display: "grid",
          gridTemplateColumns: "38px minmax(0, 1fr) 26px",
          alignItems: "center",
          gap: 12,
          minHeight: 64,
          padding: "10px 16px",
          background: on ? "#f8f6ff" : "#ffffff",
          boxShadow: on ? `inset 3px 0 0 ${VIOLET}` : "none",
          cursor: "pointer",
          userSelect: "none",
          WebkitUserSelect: "none",
          transition: "background 160ms ease, box-shadow 160ms ease",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 38,
            height: 38,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            background: empty ? "#fff1f2" : "#efecff",
            color: empty ? "#b3202f" : "#5b4bd6",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.02em",
          }}
        >
          {empty ? "!" : row.people.length > 1 ? `+${row.people.length}` : initials(row.people[0].name)}
        </span>
        <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 15, color: empty ? "#b3202f" : INK }}>
            {empty ? "Nessuno: non verrà copiato" : names}
          </span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
            {row.start} – {row.end}
            {note ? ` · ${note}` : ""}
          </span>
        </span>
        <span
          aria-hidden="true"
          style={{
            width: 26,
            height: 26,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            border: on ? 0 : "1.5px solid #d4cfe8",
            background: on ? "linear-gradient(135deg, #5e4ae3, #8b5cf6)" : "transparent",
            color: "#ffffff",
            transform: on ? "scale(1)" : "scale(0.92)",
            transition: "transform 160ms ease, background 160ms ease",
          }}
        >
          {on ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </span>
      </div>
    </SwipeRevealAction>
  );
}

const linkStyle = {
  border: 0,
  background: "transparent",
  padding: "4px 2px",
  fontSize: 13,
  fontWeight: 700,
  color: "#5b4bd6",
  cursor: "pointer",
  fontFamily: "inherit",
} as const;

function swipeButtonStyle(background: string, border: string) {
  return { width: 38, height: 38, borderRadius: 13, border: `1px solid ${border}`, background, color: "#ffffff", cursor: "pointer", fontWeight: 900 } as const;
}

const fieldStyle = { display: "grid", gap: 4, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED } as const;

const timeStyle = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 44,
  padding: "0 10px",
  borderRadius: 12,
  border: "1.5px solid #e2deef",
  background: "#ffffff",
  color: INK,
  fontSize: 16,
  fontWeight: 700,
  fontFamily: "inherit",
  fontVariantNumeric: "tabular-nums",
} as const;

function buttonStyle(kind: "edit" | "plain" | "primary") {
  const base = { minHeight: 48, borderRadius: 15, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" };
  switch (kind) {
    case "edit":
      return { ...base, border: "1.5px solid #ddd6fe", background: "#f5f3ff", color: "#5b21b6" };
    case "plain":
      return { ...base, border: "1.5px solid #e9e6f5", background: "#ffffff", color: "#4c4670" };
    default:
      return { ...base, border: 0, background: "linear-gradient(135deg, #3b1d8f 0%, #5e4ae3 55%, #8b5cf6 100%)", color: "#ffffff", boxShadow: "0 8px 20px rgba(94, 74, 227, 0.28)" };
  }
}
