"use client";

import { useState } from "react";
import { ActionForm } from "@/app/components/action-form";
import { PendingButton } from "@/app/components/pending-button";
import { createManualTimeLogAction, deleteTimeLogPairAction } from "../actions";
import { DayEditor, type DayEditorProps } from "./day-editor";

export type StampPair = {
  /** Both log ids, or one when the pair is half open. */
  logIds: string[];
  label: string;
  manual: boolean;
};

const soft = {
  minHeight: 34,
  borderRadius: 999,
  border: "1px solid #ddd6fe",
  background: "#f6f3ff",
  color: "#4c1d95",
  fontSize: 13,
  fontWeight: 720,
  cursor: "pointer",
  padding: "0 13px",
} as const;

const quiet = { ...soft, background: "transparent", border: "1px solid #e9e6f5", color: "#4b4763" } as const;

const input = {
  minHeight: 38,
  borderRadius: 12,
  border: "1px solid #e9e6f5",
  padding: "0 9px",
  fontSize: 15,
  width: "100%",
  minWidth: 0,
  background: "#ffffff",
} as const;

/** Clock-ins of one day: take a wrong one away, or add the one that was forgotten. */
function StampFix({ userId, date, pairs }: { userId: string; date: string; pairs: StampPair[] }) {
  const [inTime, setInTime] = useState("");
  const [outTime, setOutTime] = useState("");
  // A shift that ends after midnight ends the next day.
  const outDate = (() => {
    if (!inTime || !outTime || outTime > inTime) return date;
    const next = new Date(`${date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString().slice(0, 10);
  })();

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {pairs.length ? (
        <div style={{ display: "grid", gap: 6 }}>
          {pairs.map((pair) => (
            <div key={pair.logIds.join(",")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
              <span>
                {pair.label}
                {pair.manual ? <span style={{ color: "#7c7894", fontSize: 12.5 }}> · aggiunta a mano</span> : null}
              </span>
              <ActionForm action={deleteTimeLogPairAction} success="Timbratura tolta">
                <input type="hidden" name="userId" value={userId} />
                <input type="hidden" name="logIds" value={pair.logIds.join(",")} />
                <PendingButton type="submit" pendingLabel="…" style={{ ...quiet, color: "#b45309", minHeight: 30 }}>
                  Togli
                </PendingButton>
              </ActionForm>
            </div>
          ))}
        </div>
      ) : null}
      <ActionForm action={createManualTimeLogAction} success="Timbratura aggiunta" style={{ display: "grid", gap: 8 }}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="clockInAt" value={inTime ? `${date}T${inTime}` : ""} />
        <input type="hidden" name="clockOutAt" value={outTime ? `${outDate}T${outTime}` : ""} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#7c7894" }}>
            Entrata
            <input type="time" required value={inTime} onChange={(event) => setInTime(event.currentTarget.value)} style={input} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#7c7894" }}>
            Uscita
            <input type="time" required value={outTime} onChange={(event) => setOutTime(event.currentTarget.value)} style={input} />
          </label>
        </div>
        <input name="note" placeholder="Nota (facoltativa): timbratura dimenticata" maxLength={200} style={input} />
        <div>
          <PendingButton type="submit" pendingLabel="Salvo…" style={{ ...soft, background: "#4c1d95", color: "#ffffff", border: "1px solid #4c1d95" }}>
            Aggiungi timbratura
          </PendingButton>
        </div>
        <span style={{ fontSize: 12, color: "#7c7894" }}>La persona riceve una notifica se una sua timbratura viene tolta.</span>
      </ActionForm>
    </div>
  );
}

/**
 * One day of one person: what the files will say, the clock-ins behind it,
 * and, for whoever may, the two ways to fix it: the clock-ins themselves, or
 * the file only.
 */
export function DayItem({
  label,
  summary,
  stamps,
  flags,
  overridden,
  editor,
  fix,
}: {
  label: string;
  summary: string;
  /** "09:58–14:02 · 17:00–21:10" */
  stamps: string;
  flags: string[];
  overridden: boolean;
  /** Present when this person may correct the file. */
  editor: DayEditorProps | null;
  /** Present when this person may fix clock-ins. */
  fix: { userId: string; date: string; pairs: StampPair[] } | null;
}) {
  const [open, setOpen] = useState<"stamps" | "file" | null>(null);
  const actionable = Boolean(editor || fix);

  return (
    <div
      style={{
        borderTop: "1px solid #f1eff8",
        padding: "10px 15px",
        display: "grid",
        gap: 4,
        boxShadow: flags.length ? "inset 3px 0 0 #f59e0b" : overridden ? "inset 3px 0 0 #6d5ce7" : undefined,
      }}
    >
      <button
        type="button"
        onClick={() => actionable && setOpen((value) => (value ? null : fix ? "stamps" : "file"))}
        aria-expanded={actionable ? open !== null : undefined}
        style={{ all: "unset", cursor: actionable ? "pointer" : "default", display: "grid", gap: 2 }}
      >
        <span style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14 }}>
          <span style={{ textTransform: "capitalize", color: "#1f1b3a", flex: "0 0 auto" }}>{label}</span>
          <span style={{ color: "#1f1b3a", textAlign: "right" }}>{summary || "–"}</span>
        </span>
        {stamps ? <span style={{ fontSize: 12.5, color: "#7c7894", fontVariantNumeric: "tabular-nums" }}>{stamps}</span> : null}
        {flags.map((flag) => (
          <span key={flag} style={{ fontSize: 12.5, color: "#b45309" }}>
            {flag}
          </span>
        ))}
        {overridden ? <span style={{ fontSize: 12.5, color: "#6d5ce7" }}>Corretto nel file del consulente</span> : null}
      </button>

      {open ? (
        <div style={{ display: "grid", gap: 10, paddingTop: 6 }}>
          {fix && editor ? (
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" onClick={() => setOpen("stamps")} style={open === "stamps" ? soft : quiet}>
                Sistema timbratura
              </button>
              <button type="button" onClick={() => setOpen("file")} style={open === "file" ? soft : quiet}>
                Solo nel file
              </button>
            </div>
          ) : null}
          {open === "stamps" && fix ? <StampFix {...fix} /> : null}
          {open === "file" && editor ? (
            <>
              <span style={{ fontSize: 12.5, color: "#7c7894" }}>Cambia solo il file del consulente: timbrature e turni restano come sono.</span>
              <DayEditor {...editor} />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** A stamp on a day that has none yet: forgotten entirely, shift or not. */
export function AddStamp({ userId, minDate, maxDate }: { userId: string; minDate: string; maxDate: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  return (
    <div style={{ borderTop: "1px solid #f1eff8", padding: "10px 15px", display: "grid", gap: 8 }}>
      <button type="button" onClick={() => setOpen((value) => !value)} style={{ ...quiet, justifySelf: "start" }}>
        {open ? "Chiudi" : "+ Aggiungi timbratura"}
      </button>
      {open ? (
        <>
          <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#7c7894" }}>
            Giorno
            <input type="date" min={minDate} max={maxDate} value={date} onChange={(event) => setDate(event.currentTarget.value)} style={input} />
          </label>
          {date ? <StampFix key={date} userId={userId} date={date} pairs={[]} /> : null}
        </>
      ) : null}
    </div>
  );
}
