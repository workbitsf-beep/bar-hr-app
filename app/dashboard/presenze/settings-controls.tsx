"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type CSSProperties } from "react";
import { showAppToast } from "@/app/components/app-toast";
import { savePayrollPeopleAction, saveSourceAction } from "./actions";

async function save(action: (formData: FormData) => Promise<unknown>, values: Record<string, string>, done = "Salvato") {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.append(key, value);
  const result = await action(formData);
  if (result && typeof result === "object" && "ruleError" in result) {
    showAppToast(String((result as { ruleError: string }).ruleError), "error");
    return false;
  }
  showAppToast(done);
  return true;
}

/** Timbrature or turni del calendario, saved as soon as it is tapped. */
export function SourceSwitch({ value }: { value: "CLOCK" | "SHIFTS" | "CONTRACT" }) {
  const router = useRouter();
  const [current, setCurrent] = useState(value);
  const [pending, start] = useTransition();
  const pick = (next: "CLOCK" | "SHIFTS" | "CONTRACT") => {
    if (next === current || pending) return;
    setCurrent(next);
    start(async () => {
      if (await save(saveSourceAction, { source: next }, next === "SHIFTS" ? "Ore dai turni del calendario" : next === "CONTRACT" ? "Ore dal contratto" : "Ore dalle timbrature")) router.refresh();
      else setCurrent(current);
    });
  };
  return (
    <div role="radiogroup" aria-label="Da dove prendere le ore" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", background: "#f3f1fa", borderRadius: 999, padding: 4 }}>
      {(
        [
          ["CLOCK", "Timbrature"],
          ["SHIFTS", "Turni"],
          ["CONTRACT", "Contratto"],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={current === key}
          onClick={() => pick(key)}
          style={{
            minHeight: 38,
            borderRadius: 999,
            border: 0,
            background: current === key ? "#ffffff" : "transparent",
            color: current === key ? "#1f1b3a" : "#6f6a88",
            fontSize: 13.5,
            fontWeight: current === key ? 700 : 600,
            boxShadow: current === key ? "0 2px 6px rgba(31,27,58,.08)" : "none",
            cursor: "pointer",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** "Conta gli straordinari", the house switch. */
export function OvertimeSwitch({ value }: { value: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(value);
  const [pending, start] = useTransition();
  return (
    <span className="workbit-switch">
      <input
        type="checkbox"
        role="switch"
        aria-label="Conta gli straordinari"
        checked={on}
        disabled={pending}
        onChange={(event) => {
          const next = event.currentTarget.checked;
          setOn(next);
          start(async () => {
            if (await save(saveSourceAction, { overtime: next ? "on" : "off" }, next ? "Straordinari contati" : "Straordinari non contati")) router.refresh();
            else setOn(!next);
          });
        }}
      />
      <i />
    </span>
  );
}

const field: CSSProperties = {
  minHeight: 42,
  borderRadius: 12,
  border: "1px solid #e9e6f5",
  background: "#fbfaff",
  fontSize: 15,
  color: "#1f1b3a",
  padding: "0 12px",
  width: "100%",
  minWidth: 0,
};

/** The break off each shift, only when the hours come from the shifts. */
export function BreakFields({ minutes, after }: { minutes: number | null; after: number | null }) {
  const router = useRouter();
  const [breakMinutes, setBreakMinutes] = useState(minutes ? String(minutes) : "");
  const [breakAfter, setBreakAfter] = useState(after ? String(after).replace(".", ",") : "");
  const commit = () => {
    if (String(minutes ?? "") === breakMinutes && String(after ?? "").replace(".", ",") === breakAfter) return;
    void save(saveSourceAction, { breakMinutes, breakAfterHours: breakAfter }, "Pausa salvata").then((ok) => ok && router.refresh());
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#6f6a88" }}>
        Pausa da togliere (minuti)
        <input inputMode="numeric" value={breakMinutes} placeholder="0" onChange={(event) => setBreakMinutes(event.currentTarget.value)} onBlur={commit} style={field} />
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#6f6a88" }}>
        Sui turni di almeno (ore)
        <input inputMode="decimal" value={breakAfter} placeholder="6" onChange={(event) => setBreakAfter(event.currentTarget.value)} onBlur={commit} style={field} />
      </label>
    </div>
  );
}

/** One person's matricola and contract hours: opens on tap, each field saves when left. */
export function PersonPayrollRow({
  userId,
  name,
  detail,
  initials,
  payrollCode,
  weeklyHours,
}: {
  userId: string;
  name: string;
  /** The email, for two people with the same name. */
  detail?: string | null;
  initials: string;
  payrollCode: string | null;
  weeklyHours: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(payrollCode ?? "");
  const [hours, setHours] = useState(weeklyHours ? String(weeklyHours).replace(".", ",") : "");
  const done = Boolean(payrollCode && weeklyHours);
  const commit = () => {
    if ((payrollCode ?? "") === code.trim().toUpperCase() && String(weeklyHours ?? "").replace(".", ",") === hours.trim()) return;
    void save(savePayrollPeopleAction, { userId, [`payrollCode_${userId}`]: code, [`weeklyHours_${userId}`]: hours }).then((ok) => ok && router.refresh());
  };
  return (
    <div style={{ borderTop: "1px solid #f1eff8", background: open ? "#fbfaff" : "transparent" }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        style={{ all: "unset", boxSizing: "border-box", width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer" }}
      >
        <span
          aria-hidden
          style={{ width: 32, height: 32, borderRadius: 999, background: "#eeecfb", color: "#4c1d95", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}
        >
          {initials}
        </span>
        <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
          <span style={{ fontSize: 15, color: "#1f1b3a" }}>{name}</span>
          {detail ? <span style={{ fontSize: 12, color: "#7c7894", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail}</span> : null}
        </span>
        {open ? (
          <span style={{ fontSize: 12.5, color: "#6d5ce7", fontWeight: 700 }}>Chiudi</span>
        ) : done ? (
          <span style={{ fontSize: 12.5, color: "#6f6a88", fontVariantNumeric: "tabular-nums" }}>
            {payrollCode} · {String(weeklyHours).replace(".", ",")} h
          </span>
        ) : (
          <span style={{ fontSize: 12.5, color: "#b45309" }}>Da completare</span>
        )}
        {open ? null : <span style={{ color: "#b7b2cc" }}>›</span>}
      </button>
      {open ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)", gap: 8, padding: "0 16px 14px" }}>
          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#6f6a88" }}>
            Matricola o codice fiscale
            <input value={code} onChange={(event) => setCode(event.currentTarget.value)} onBlur={commit} style={{ ...field, textTransform: "uppercase" }} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#6f6a88" }}>
            Ore a settimana
            <input inputMode="decimal" value={hours} placeholder="40" onChange={(event) => setHours(event.currentTarget.value)} onBlur={commit} style={field} />
          </label>
        </div>
      ) : null}
    </div>
  );
}
