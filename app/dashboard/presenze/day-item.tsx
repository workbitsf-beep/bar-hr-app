"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ActionForm } from "@/app/components/action-form";
import { TimeInput } from "@/app/components/time-input";
import { PendingButton } from "@/app/components/pending-button";
import { createManualTimeLogAction, deleteTimeLogPairAction } from "../actions";
import { DayEditor, type DayEditorProps } from "./day-editor";

export type StampPair = {
  /** Both log ids, or one when the pair is half open. */
  logIds: string[];
  label: string;
};

/** A span on the day's track, in percent of 6:00–24:00. */
export type Span = { left: number; width: number };

export type DayView = {
  date: string;
  weekday: string;
  day: number;
  segments: Span[];
  /** The shift nobody stamped, drawn dashed. */
  planned: Span | null;
  /** A whole day away: the track is tinted and the right side says it. */
  away: string | null;
  times: string;
  right: string;
  flags: string[];
  overridden: boolean;
  shift: { start: string; end: string } | null;
  pairs: StampPair[];
  editor: DayEditorProps | null;
};

const input: CSSProperties = {
  minHeight: 50,
  borderRadius: 14,
  border: "1px solid #e9e6f5",
  background: "#fbfaff",
  fontSize: 22,
  fontWeight: 600,
  color: "#1f1b3a",
  textAlign: "center",
  width: "100%",
  minWidth: 0,
  fontVariantNumeric: "tabular-nums",
};

const chip = (active: boolean): CSSProperties => ({
  minHeight: 34,
  borderRadius: 999,
  border: active ? "1px solid #6d5ce7" : "1px solid #e9e6f5",
  background: active ? "#f1eeff" : "#ffffff",
  color: active ? "#4c1d95" : "#4b4763",
  fontSize: 13,
  fontWeight: active ? 700 : 600,
  padding: "0 13px",
  cursor: "pointer",
});

const primary: CSSProperties = {
  minHeight: 50,
  borderRadius: 999,
  border: 0,
  background: "linear-gradient(135deg,#3b1d8f,#5e4ae3 55%,#8b5cf6)",
  color: "#ffffff",
  fontSize: 15.5,
  fontWeight: 700,
  boxShadow: "0 10px 22px rgba(124,58,237,.2)",
  cursor: "pointer",
  width: "100%",
};

function minutesOf(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function durationText(inTime: string, outTime: string) {
  if (!inTime || !outTime) return null;
  let minutes = minutesOf(outTime) - minutesOf(inTime);
  if (minutes <= 0) minutes += 24 * 60;
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")} ore`;
}

function nextDay(date: string) {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

const longDate = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/**
 * The sheet that rises over the page for one day: the clock-ins to fix, or
 * the file only. Saving closes it (ActionForm presses the hidden closer).
 */
function DaySheet({
  view,
  userId,
  personName,
  canFix,
  onClose,
  top,
}: {
  view: DayView;
  userId: string;
  personName: string;
  canFix: boolean;
  onClose: () => void;
  /** Above the form: the choice of day, for a stamp added from the month. */
  top?: ReactNode;
}) {
  const [mode, setMode] = useState<"stamps" | "file">(canFix ? "stamps" : "file");
  const [inTime, setInTime] = useState(view.shift?.start ?? "");
  const [outTime, setOutTime] = useState(view.shift?.end ?? "");
  const fromShift = Boolean(view.shift && inTime === view.shift.start && outTime === view.shift.end);
  const duration = durationText(inTime, outTime);
  const outDate = inTime && outTime && minutesOf(outTime) <= minutesOf(inTime) ? nextDay(view.date) : view.date;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <button type="button" aria-label="Chiudi" onClick={onClose} style={{ position: "absolute", inset: 0, border: 0, background: "rgba(31,27,58,.32)", cursor: "pointer" }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Sistema ${longDate.format(new Date(`${view.date}T00:00:00Z`))}`}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("[data-popup-close]")) onClose();
        }}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 560,
          maxHeight: "92vh",
          overflowY: "auto",
          background: "#ffffff",
          borderRadius: "28px 28px 0 0",
          padding: "12px 20px calc(24px + env(safe-area-inset-bottom, 0px))",
          display: "grid",
          gap: 16,
          boxShadow: "0 -20px 40px rgba(31,27,58,.18)",
          color: "#1f1b3a",
        }}
      >
        <span aria-hidden style={{ width: 40, height: 5, borderRadius: 3, background: "#e4e1ef", justifySelf: "center" }} />
        <div style={{ display: "grid", gap: 2 }}>
          <span style={{ fontSize: 21, fontWeight: 750, letterSpacing: "-0.02em", textTransform: "capitalize" }}>
            {longDate.format(new Date(`${view.date}T00:00:00Z`))}
          </span>
          <span style={{ fontSize: 13, color: "#6f6a88" }}>
            {personName}
            {view.shift ? ` · turno ${view.shift.start} – ${view.shift.end}` : ""}
          </span>
        </div>
        {top}

        {view.flags.length ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff7e8", borderRadius: 14, padding: "11px 14px", color: "#92400e", fontSize: 13.5 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v6M12 16.5v.5" />
            </svg>
            {view.flags[0]}
          </div>
        ) : null}

        {canFix && view.editor ? (
          <div role="tablist" aria-label="Cosa correggere" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", background: "#f3f1fa", borderRadius: 999, padding: 4 }}>
            {(
              [
                ["stamps", "Sistema timbratura"],
                ["file", "Solo nel file"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                onClick={() => setMode(key)}
                style={{
                  minHeight: 40,
                  borderRadius: 999,
                  border: 0,
                  background: mode === key ? "#ffffff" : "transparent",
                  color: mode === key ? "#1f1b3a" : "#6f6a88",
                  fontSize: 14,
                  fontWeight: mode === key ? 700 : 600,
                  boxShadow: mode === key ? "0 2px 6px rgba(31,27,58,.08)" : "none",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {mode === "stamps" && canFix ? (
          <>
            {view.pairs.length ? (
              <div style={{ display: "grid", gap: 6 }}>
                {view.pairs.map((pair) => (
                  <div key={pair.logIds.join(",")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 14.5, fontVariantNumeric: "tabular-nums" }}>
                    <span>{pair.label}</span>
                    <ActionForm action={deleteTimeLogPairAction} success="Timbratura tolta" keepOpen>
                      <input type="hidden" name="userId" value={userId} />
                      <input type="hidden" name="logIds" value={pair.logIds.join(",")} />
                      <PendingButton type="submit" pendingLabel="…" style={{ ...chip(false), color: "#b45309" }}>
                        Togli
                      </PendingButton>
                    </ActionForm>
                  </div>
                ))}
              </div>
            ) : null}
            {view.pairs.length ? (
              <span style={{ fontSize: 13, color: "#6f6a88" }}>
                Una timbratura sbagliata si toglie, poi si aggiunge quella giusta: così resta chiaro chi ha cambiato cosa.
              </span>
            ) : (
            <ActionForm action={createManualTimeLogAction} success="Timbratura salvata" style={{ display: "grid", gap: 14 }}>
              <input type="hidden" name="userId" value={userId} />
              <input type="hidden" name="clockInAt" value={inTime ? `${view.date}T${inTime}` : ""} />
              <input type="hidden" name="clockOutAt" value={outTime ? `${outDate}T${outTime}` : ""} />
              {view.shift ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    style={chip(fromShift)}
                    onClick={() => {
                      setInTime(view.shift!.start);
                      setOutTime(view.shift!.end);
                    }}
                  >
                    Orari del turno
                  </button>
                  <button
                    type="button"
                    style={chip(!fromShift && !inTime && !outTime)}
                    onClick={() => {
                      setInTime("");
                      setOutTime("");
                    }}
                  >
                    Altri orari
                  </button>
                </div>
              ) : null}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ display: "grid", gap: 6, fontSize: 12.5, color: "#6f6a88" }}>
                  Entrata
                  <TimeInput value={inTime} onChange={setInTime} required />
                </div>
                <div style={{ display: "grid", gap: 6, fontSize: 12.5, color: "#6f6a88" }}>
                  Uscita
                  <TimeInput value={outTime} onChange={setOutTime} required />
                </div>
              </div>
              <label style={{ display: "grid", gap: 6, fontSize: 12.5, color: "#6f6a88" }}>
                Nota per {personName.split(" ")[0]}
                <input
                  name="note"
                  maxLength={200}
                  placeholder="Timbratura dimenticata"
                  style={{ ...input, fontSize: 15, fontWeight: 400, textAlign: "left", padding: "0 14px", minHeight: 46 }}
                />
              </label>
              <PendingButton type="submit" pendingLabel="Salvo…" style={{ ...primary, opacity: inTime && outTime ? 1 : 0.55 }} disabled={!inTime || !outTime}>
                {duration ? `Salva ${duration}` : "Salva timbratura"}
              </PendingButton>
              <span style={{ fontSize: 12.5, color: "#6f6a88", textAlign: "center" }}>
                Le ore del mese e il file del consulente si aggiornano da soli.
              </span>
            </ActionForm>
            )}
          </>
        ) : null}

        {mode === "file" && view.editor ? (
          <>
            <span style={{ fontSize: 13, color: "#6f6a88" }}>Cambia solo il file del consulente: timbrature e turni restano come sono.</span>
            <DayEditor {...view.editor} />
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

function Track({ view }: { view: DayView }) {
  return (
    <span
      aria-hidden
      style={{
        position: "relative",
        display: "block",
        width: "100%",
        maxWidth: 190,
        height: 12,
        borderRadius: 6,
        background: view.away ? "#e2f6ed" : "#f3f1fa",
      }}
    >
      {view.segments.map((segment, index) => (
        <span
          key={index}
          style={{ position: "absolute", top: 0, height: 12, borderRadius: 6, background: "#6d5ce7", left: `${segment.left}%`, width: `${Math.max(segment.width, 2)}%` }}
        />
      ))}
      {view.planned ? (
        <span
          style={{
            position: "absolute",
            top: 0,
            height: 12,
            borderRadius: 6,
            border: "1.5px dashed #f59e0b",
            boxSizing: "border-box",
            left: `${view.planned.left}%`,
            width: `${Math.max(view.planned.width, 3)}%`,
          }}
        />
      ) : null}
    </span>
  );
}

/**
 * One day of the month: the date, the day's track (6:00–24:00) with the
 * stamped spans, the exact times under it, the hours on the right. Tapped,
 * for whoever may, it opens the sheet.
 */
export function DayRow({ view, userId, personName, canFix }: { view: DayView; userId: string; personName: string; canFix: boolean }) {
  const [open, setOpen] = useState(false);
  const actionable = canFix || Boolean(view.editor);
  const flagged = view.flags.length > 0;
  const content = (
    <>
      <span style={{ width: 40, display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1, flex: "0 0 auto" }}>
        <small style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#7c7894" }}>{view.weekday}</small>
        <b style={{ fontSize: 18, fontWeight: 600 }}>{view.day}</b>
      </span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
        <Track view={view} />
        {view.times ? <span style={{ fontSize: 12, color: "#6f6a88", fontVariantNumeric: "tabular-nums" }}>{view.times}</span> : null}
        {flagged ? <span style={{ fontSize: 12, color: "#b45309" }}>{view.flags.join(" · ")}</span> : null}
        {view.overridden ? <span style={{ fontSize: 12, color: "#6d5ce7" }}>Corretto nel file del consulente</span> : null}
      </span>
      <span
        style={{
          marginLeft: "auto",
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          fontSize: flagged && actionable ? 13 : view.away ? 13 : 14.5,
          fontWeight: flagged && actionable ? 700 : 400,
          color: flagged && actionable ? "#b45309" : view.away ? "#0f7a4f" : "#1f1b3a",
          whiteSpace: "nowrap",
        }}
      >
        {flagged && actionable ? "Sistema ›" : view.right}
      </span>
    </>
  );
  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "11px 14px",
    borderTop: "1px solid #f1eff8",
    background: flagged ? "#fffaf0" : "transparent",
    color: "#1f1b3a",
    width: "100%",
    textAlign: "left",
    font: "inherit",
  };
  return (
    <>
      {actionable ? (
        <button type="button" onClick={() => setOpen(true)} style={{ ...rowStyle, border: 0, borderTop: "1px solid #f1eff8", cursor: "pointer" }}>
          {content}
        </button>
      ) : (
        <div style={rowStyle}>{content}</div>
      )}
      {open ? <DaySheet view={view} userId={userId} personName={personName} canFix={canFix} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export type DayChoice = { date: string; weekday: string; day: number; shift: { start: string; end: string } | null };

/** "+ Timbratura": one of the month's days without a stamp, then the same sheet. */
export function AddStampButton({
  userId,
  personName,
  choices,
  style,
}: {
  userId: string;
  personName: string;
  /** Days so far with no stamp and no day away, newest first. */
  choices: DayChoice[];
  style: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<DayChoice | null>(null);
  const first = choices.find((choice) => choice.shift) ?? choices[0] ?? null;
  const current = picked ?? first;
  if (!choices.length) return null;

  const chooser = (
    <div style={{ display: "grid", gap: 8 }}>
      <span style={{ fontSize: 12.5, color: "#6f6a88" }}>Che giorno? Solo quelli senza timbratura.</span>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
        {choices.map((choice) => {
          const active = current?.date === choice.date;
          return (
            <button
              key={choice.date}
              type="button"
              onClick={() => setPicked(choice)}
              style={{
                flex: "0 0 auto",
                minWidth: 64,
                minHeight: 62,
                borderRadius: 16,
                border: active ? "1.5px solid #6d5ce7" : choice.shift ? "1px solid #fcd9a0" : "1px solid #e9e6f5",
                background: active ? "#f1eeff" : choice.shift ? "#fffaf0" : "#ffffff",
                color: "#1f1b3a",
                display: "grid",
                justifyItems: "center",
                alignContent: "center",
                gap: 2,
                cursor: "pointer",
                padding: "6px 8px",
              }}
            >
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#7c7894" }}>{choice.weekday}</span>
              <span style={{ fontSize: 18, fontWeight: 650 }}>{choice.day}</span>
              {choice.shift ? <span style={{ fontSize: 10.5, color: "#b45309" }}>turno</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={style}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Timbratura
      </button>
      {open && current ? (
        <DaySheet
          key={current.date}
          view={{
            date: current.date,
            weekday: current.weekday,
            day: current.day,
            segments: [],
            planned: null,
            away: null,
            times: "",
            right: "",
            flags: [],
            overridden: false,
            shift: current.shift,
            pairs: [],
            editor: null,
          }}
          userId={userId}
          personName={personName}
          canFix
          top={chooser}
          onClose={() => {
            setOpen(false);
            setPicked(null);
          }}
        />
      ) : null}
    </>
  );
}
