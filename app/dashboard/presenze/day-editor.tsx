"use client";

import { useState } from "react";
import { ActionForm } from "@/app/components/action-form";
import { PendingButton } from "@/app/components/pending-button";
import { PAYROLL_CODE_LABELS, PAYROLL_KINDS, type PayrollCodeKey } from "@/lib/payroll/template";
import { resetDayAction, saveDayAction } from "./actions";

type Entry = { kind: PayrollCodeKey; hours: number; days: number };

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

const soft = {
  minHeight: 36,
  borderRadius: 999,
  border: "1px solid #ddd6fe",
  background: "#f6f3ff",
  color: "#4c1d95",
  fontSize: 13.5,
  fontWeight: 740,
  cursor: "pointer",
  padding: "0 14px",
} as const;

/** "7:30" (or 7,5 or 7) to hours. */
function parseHours(text: string) {
  const value = text.trim();
  if (!value) return 0;
  const clock = /^(\d{1,2})[:.](\d{1,2})$/.exec(value);
  if (clock && value.includes(":")) return Number(clock[1]) + Number(clock[2]) / 60;
  return Number(value.replace(",", ".")) || 0;
}

function clockOf(hours: number) {
  if (!hours) return "";
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Hours written as a clock, 7:30; sent to the action as a number. */
function HoursField({ hours, onChange }: { hours: number; onChange: (hours: number) => void }) {
  const [text, setText] = useState(clockOf(hours));
  return (
    <>
      <input
        inputMode="text"
        value={text}
        placeholder="0:00"
        aria-label="Ore"
        onChange={(event) => setText(event.currentTarget.value)}
        onBlur={() => {
          const next = parseHours(text);
          setText(clockOf(next));
          onChange(Math.round(next * 100) / 100);
        }}
        style={{ ...input, textAlign: "center", fontVariantNumeric: "tabular-nums" }}
      />
      <input type="hidden" name="hours" value={String(hours)} />
    </>
  );
}

const WHOLE_DAY: PayrollCodeKey[] = ["holiday", "sickness", "closure", "publicHoliday"];

/**
 * One day of one person, as the files will say it: kinds of hours, hours,
 * whole days. Saved, it replaces that day in the files only; the clock-ins
 * and the shifts stay as they were, and "Torna com'era" takes it back.
 */
export type DayEditorProps = {
  userId: string;
  /** null: a new day, chosen in the form. */
  date: string | null;
  entries: Entry[];
  overridden: boolean;
  note: string | null;
  dailyHours: number | null;
  minDate: string;
  maxDate: string;
};

export function DayEditor({ userId, date, entries, overridden, note, dailyHours, minDate, maxDate }: DayEditorProps) {
  const [rows, setRows] = useState<Entry[]>(entries.length ? entries : [{ kind: "ordinary", hours: 0, days: 0 }]);

  const update = (index: number, patch: Partial<Entry>) =>
    setRows((current) =>
      current.map((row, position) => {
        if (position !== index) return row;
        const next = { ...row, ...patch };
        // A whole day away: one day, with the contract's hours when known.
        if (patch.kind && WHOLE_DAY.includes(patch.kind) && !WHOLE_DAY.includes(row.kind)) {
          next.days = 1;
          next.hours = dailyHours ?? 0;
        }
        if (patch.kind && !WHOLE_DAY.includes(patch.kind)) next.days = 0;
        return next;
      }),
    );

  return (
    <div style={{ display: "grid", gap: 10, padding: "4px 0 2px" }}>
      <ActionForm action={saveDayAction} success="Giorno corretto" style={{ display: "grid", gap: 8 }}>
        <input type="hidden" name="userId" value={userId} />
        {date ? (
          <input type="hidden" name="date" value={date} />
        ) : (
          <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#7c7894" }}>
            Giorno
            <input type="date" className="wb-centered-field" name="date" min={minDate} max={maxDate} required style={input} />
          </label>
        )}
        {rows.map((row, index) => (
          <div key={index} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 76px 64px 32px", gap: 6, alignItems: "end" }}>
            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#7c7894" }}>
              {index === 0 ? "Voce" : <span aria-hidden> </span>}
              <select name="kind" value={row.kind} onChange={(event) => update(index, { kind: event.currentTarget.value as PayrollCodeKey })} style={input}>
                {PAYROLL_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {PAYROLL_CODE_LABELS[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#7c7894" }}>
              {index === 0 ? "Ore" : <span aria-hidden> </span>}
              <HoursField key={`${index}-${row.kind}`} hours={row.hours} onChange={(hours) => update(index, { hours })} />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#7c7894" }}>
              {index === 0 ? "Giorni" : <span aria-hidden> </span>}
              <select name="days" value={String(row.days)} onChange={(event) => update(index, { days: Number(event.currentTarget.value) })} style={input}>
                <option value="0">–</option>
                <option value="0.5">½</option>
                <option value="1">1</option>
              </select>
            </label>
            <button
              type="button"
              aria-label="Togli la voce"
              onClick={() => setRows((current) => current.filter((_, position) => position !== index))}
              style={{ minHeight: 38, border: 0, background: "transparent", color: "#7c7894", fontSize: 18, cursor: "pointer" }}
            >
              ×
            </button>
          </div>
        ))}
        <div>
          <button type="button" style={{ ...soft, background: "transparent" }} onClick={() => setRows((current) => [...current, { kind: "overtime", hours: 0, days: 0 }])}>
            + Aggiungi voce
          </button>
        </div>
        <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#7c7894" }}>
          Nota per te (non va nel file)
          <input name="note" defaultValue={note ?? ""} maxLength={200} placeholder="es. timbratura dimenticata" style={input} />
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <PendingButton type="submit" style={{ ...soft, background: "#4c1d95", color: "#ffffff", border: "1px solid #4c1d95" }} pendingLabel="Salvo…">
            Salva il giorno
          </PendingButton>
        </div>
      </ActionForm>
      {overridden && date ? (
        <ActionForm action={resetDayAction} success="Il giorno è tornato com'era">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="date" value={date} />
          <PendingButton type="submit" style={{ ...soft, background: "transparent", border: "1px solid transparent", color: "#b45309" }} pendingLabel="…">
            Torna com&apos;era
          </PendingButton>
        </ActionForm>
      ) : null}
    </div>
  );
}

/** A day with nothing on it yet: a sickness not asked in the app, a shift not entered. */
export function AddDay({ editor }: { editor: Omit<DayEditorProps, "date" | "entries" | "overridden" | "note"> }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: "1px solid #f1eff8", padding: "10px 15px", display: "grid", gap: 6 }}>
      <button type="button" onClick={() => setOpen((value) => !value)} style={{ ...soft, justifySelf: "start", background: "transparent" }}>
        {open ? "Chiudi" : "+ Aggiungi un giorno"}
      </button>
      {open ? <DayEditor {...editor} date={null} entries={[]} overridden={false} note={null} /> : null}
    </div>
  );
}
