"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ChecklistMoment, Department } from "@prisma/client";
import type { DepartmentInfo } from "@/lib/departments";
import { describeActionError, isActionFailure } from "@/lib/rule-error";
import { saveChecklistAction, toggleChecklistItemAction } from "./department-actions";
import { DepartmentDot } from "./department-forms";
import { PrimaryButton } from "./ui";

const MOMENTS: Array<{ id: ChecklistMoment; label: string }> = [
  { id: "OPENING", label: "Apertura" },
  { id: "CLOSING", label: "Chiusura" },
];

/* ---------------- the owner writes them ---------------- */

export function ChecklistEditor({
  departments,
  saved,
}: {
  departments: DepartmentInfo[];
  /** What each department already has, by moment. */
  saved: Partial<Record<Department, Partial<Record<ChecklistMoment, string[]>>>>;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Department>(departments[0]?.id ?? "BANCO");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const current = saved[picked] ?? {};

  function submit(formData: FormData) {
    setMessage(null);
    start(async () => {
      try {
        const result = await saveChecklistAction(formData);
        if (isActionFailure(result)) {
          setMessage({ tone: "error", text: result.ruleError });
          return;
        }
        setMessage({ tone: "ok", text: "Salvata." });
        router.refresh();
      } catch (error) {
        setMessage({ tone: "error", text: describeActionError(error) });
      }
    });
  }

  return (
    <form key={picked} action={submit} style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="department" value={picked} />
      <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(0, 1fr)", gap: 6 }}>
        {departments.map((department) => {
          const on = picked === department.id;
          return (
            <button
              key={department.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setPicked(department.id);
                setMessage(null);
              }}
              style={{
                minWidth: 0,
                height: 36,
                borderRadius: 13,
                border: "none",
                fontSize: 13,
                fontWeight: 800,
                whiteSpace: "nowrap",
                cursor: "pointer",
                background: on ? `linear-gradient(160deg, ${department.light}, ${department.ink})` : department.soft,
                color: on ? "#ffffff" : department.ink,
              }}
            >
              {department.name}
            </button>
          );
        })}
      </div>

      {MOMENTS.map((moment) => (
        <label key={moment.id} style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 820, color: "#334155" }}>{moment.label}</span>
          <textarea
            name={moment.id}
            defaultValue={(current[moment.id] ?? []).join("\n")}
            rows={4}
            placeholder={
              moment.id === "OPENING"
                ? "Una voce per riga, es.\nAccendere la macchina del caffè\nControllare i frigo"
                : "Una voce per riga, es.\nContare la cassa\nPulire il piano"
            }
            style={{ borderRadius: 14, border: "1px solid #e2e8f0", padding: "10px 12px", fontSize: 14, lineHeight: 1.5, resize: "vertical" }}
          />
        </label>
      ))}
      <span style={{ fontSize: 12, color: "#8a84a8" }}>Ogni giorno riparte da zero. Lascia vuoto quello che non serve.</span>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Salvo..." : "Salva checklist"}
        </PrimaryButton>
        {message ? (
          <span role="status" style={{ fontSize: 13, fontWeight: 760, color: message.tone === "ok" ? "#15803d" : "#b3202f" }}>
            {message.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}

/* ---------------- the day ticks them ---------------- */

export type ChecklistView = {
  id: string;
  department: DepartmentInfo;
  moment: ChecklistMoment;
  items: string[];
  done: string[];
  completedBy: string | null;
  completedAt: string | null;
  canTick: boolean;
};

export function ChecklistsCard({ checklists }: { checklists: ChecklistView[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(checklists.map((checklist) => [checklist.id, checklist.done]))
  );
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(checklist: ChecklistView, item: string) {
    const was = done[checklist.id] ?? [];
    const checked = !was.includes(item);
    setDone({ ...done, [checklist.id]: checked ? [...was, item] : was.filter((entry) => entry !== item) });
    setError(null);
    start(async () => {
      const formData = new FormData();
      formData.set("checklistId", checklist.id);
      formData.set("item", item);
      if (checked) formData.set("checked", "on");
      try {
        const result = await toggleChecklistItemAction(formData);
        if (isActionFailure(result)) {
          setDone((current) => ({ ...current, [checklist.id]: was }));
          setError(result.ruleError);
          return;
        }
        router.refresh();
      } catch (caught) {
        setDone((current) => ({ ...current, [checklist.id]: was }));
        setError(describeActionError(caught));
      }
    });
  }

  if (checklists.length === 0) return null;

  return (
    <section className="workbit-crew">
      <div className="workbit-crew-head">
        <strong>Apertura e chiusura</strong>
        <span>
          {checklists.filter((checklist) => checklist.items.every((item) => (done[checklist.id] ?? []).includes(item))).length} su{" "}
          {checklists.length} fatte
        </span>
      </div>

      {checklists.map((checklist) => {
        const ticked = done[checklist.id] ?? [];
        const complete = checklist.items.every((item) => ticked.includes(item));
        const expanded = open === checklist.id;
        return (
          <div key={checklist.id} style={{ borderBottom: "1px solid #f3effc" }}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : checklist.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 0",
                border: 0,
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <DepartmentDot department={checklist.department} size={22} />
              <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
                <b style={{ fontSize: 14.5, fontWeight: 650 }}>
                  {checklist.moment === "OPENING" ? "Apertura" : "Chiusura"} {checklist.department.name.toLowerCase()}
                </b>
                <span style={{ fontSize: 12, color: "#8a84a8" }}>
                  {complete && checklist.completedAt
                    ? `Fatta alle ${checklist.completedAt}${checklist.completedBy ? ` da ${checklist.completedBy}` : ""}`
                    : `${ticked.length} su ${checklist.items.length}`}
                </span>
              </span>
              <span
                className={`workbit-crew-state workbit-crew-state--${complete ? "in" : ticked.length ? "next" : "waiting"}`}
              >
                {complete ? "✓ Fatta" : ticked.length ? "In corso" : "Da fare"}
              </span>
            </button>

            {expanded ? (
              <div style={{ display: "grid", gap: 6, padding: "0 0 12px 32px" }}>
                {checklist.items.map((item) => {
                  const on = ticked.includes(item);
                  return (
                    <label
                      key={item}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontSize: 14,
                        color: on ? "#8a84a8" : "#17161f",
                        textDecoration: on ? "line-through" : "none",
                        cursor: checklist.canTick ? "pointer" : "default",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={!checklist.canTick}
                        onChange={() => toggle(checklist, item)}
                        style={{ width: 20, height: 20, accentColor: checklist.department.ink }}
                      />
                      {item}
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}

      {error ? <span style={{ color: "#b3202f", fontSize: 13 }}>{error}</span> : null}
    </section>
  );
}
