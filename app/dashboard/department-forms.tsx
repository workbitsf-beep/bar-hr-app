"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Department, DepartmentMode } from "@prisma/client";
import type { DepartmentInfo } from "@/lib/departments";
import { describeActionError, isActionFailure } from "@/lib/rule-error";
import { updateDepartmentSettingsAction, updateMemberDepartmentAction } from "./department-actions";
import { PrimaryButton } from "./ui";

const labelStyle = {
  fontSize: 12,
  fontWeight: 820,
  color: "#334155",
} as const;

function useSave(action: (formData: FormData) => Promise<unknown>) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function submit(formData: FormData) {
    setMessage(null);
    start(async () => {
      try {
        const result = await action(formData);
        if (isActionFailure(result)) {
          setMessage({ tone: "error", text: result.ruleError });
          return;
        }
        setMessage({ tone: "ok", text: "Salvato." });
        router.refresh();
      } catch (error) {
        setMessage({ tone: "error", text: describeActionError(error) });
      }
    });
  }

  return { pending, message, submit };
}

function Message({ value }: { value: { tone: "ok" | "error"; text: string } | null }) {
  if (!value) return null;
  return (
    <span
      role="status"
      style={{
        fontSize: 13,
        fontWeight: 760,
        color: value.tone === "ok" ? "#15803d" : "#b3202f",
      }}
    >
      {value.text}
    </span>
  );
}

/** The dot with the department's letter, as it sits next to a shift. */
export function DepartmentDot({ department, size = 22 }: { department: DepartmentInfo; size?: number }) {
  return (
    <span
      title={department.name}
      aria-label={department.name}
      style={{
        flex: "0 0 auto",
        width: size,
        height: size,
        borderRadius: 999,
        display: "inline-grid",
        placeItems: "center",
        color: "#ffffff",
        fontSize: size * 0.48,
        fontWeight: 900,
        letterSpacing: "-0.02em",
        background: `radial-gradient(120% 120% at 30% 20%, color-mix(in srgb, ${department.ink} 70%, #fff) 0%, ${department.ink} 60%)`,
        boxShadow: `0 2px 6px color-mix(in srgb, ${department.ink} 40%, transparent), inset 0 1px 0 rgba(255,255,255,.35)`,
      }}
    >
      {department.initials}
    </span>
  );
}

function DepartmentChip({
  department,
  active,
  onClick,
}: {
  department: DepartmentInfo;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        minHeight: 38,
        padding: "0 14px",
        borderRadius: 999,
        border: active ? "1px solid transparent" : "1px solid #e2e8f0",
        background: active ? department.ink : "#ffffff",
        color: active ? "#ffffff" : "#475569",
        fontSize: 13,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {department.name}
    </button>
  );
}

/** Settings → Reparti: how the calendar is split, and the owner's own department. */
export function DepartmentSettingsForm({
  mode,
  customName,
  departments,
  counts,
}: {
  mode: DepartmentMode;
  customName: string | null;
  departments: DepartmentInfo[];
  counts: Record<string, number>;
}) {
  const [current, setCurrent] = useState<DepartmentMode>(mode);
  const { pending, message, submit } = useSave(updateDepartmentSettingsAction);
  const options: Array<{ value: DepartmentMode; title: string; lead: string }> = [
    { value: "UNIFIED", title: "Un calendario unico", lead: "La settimana di sempre, con i filtri per reparto" },
    { value: "SEPARATE", title: "Un calendario per reparto", lead: "Ogni capo reparto gestisce il suo" },
  ];

  return (
    <form action={submit} style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <span style={labelStyle}>Come vuoi i turni</span>
        <input type="hidden" name="mode" value={current} />
        {options.map((option) => {
          const active = current === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setCurrent(option.value)}
              style={{
                display: "flex",
                gap: 11,
                alignItems: "flex-start",
                padding: "12px 13px",
                borderRadius: 16,
                border: active ? "2px solid #6d3df0" : "1px solid #e9e6f5",
                background: active ? "#faf7ff" : "#ffffff",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 18,
                  height: 18,
                  marginTop: 1,
                  borderRadius: 999,
                  flex: "0 0 auto",
                  boxShadow: active ? "inset 0 0 0 5px #6d3df0" : "inset 0 0 0 2px #cfc3f2",
                }}
              />
              <span style={{ display: "grid", gap: 2 }}>
                <strong style={{ fontSize: 14, color: "#17161f" }}>{option.title}</strong>
                <span style={{ fontSize: 12, color: "#8a84a8" }}>{option.lead}</span>
              </span>
            </button>
          );
        })}
        <span style={{ fontSize: 12, color: "#8a84a8" }}>Puoi cambiare quando vuoi: i turni restano gli stessi.</span>
      </div>

      <div style={{ display: "grid", gap: 4 }}>
        <span style={labelStyle}>I reparti</span>
        {departments
          .filter((department) => department.id !== "CUSTOM")
          .map((department) => (
            <span
              key={department.id}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f3effc" }}
            >
              <DepartmentDot department={department} />
              <strong style={{ flex: 1, fontSize: 14, fontWeight: 650 }}>{department.name}</strong>
              <span style={{ fontSize: 12, color: "#8a84a8" }}>
                {counts[department.id] ?? 0} persone
              </span>
            </span>
          ))}
      </div>

      <label style={{ display: "grid", gap: 7 }}>
        <span style={labelStyle}>Il tuo reparto (facoltativo)</span>
        <input
          name="customName"
          defaultValue={customName ?? ""}
          maxLength={18}
          placeholder="Es. Pizzeria, Forno, Lavaggio"
          style={{ height: 44, borderRadius: 14, border: "1px solid #e2e8f0", padding: "0 12px", fontSize: 15 }}
        />
        <span style={{ fontSize: 12, color: "#8a84a8" }}>
          Lascialo vuoto per non averlo. Se lo togli, chi ci lavorava resta senza reparto.
        </span>
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Salvo..." : "Salva"}
        </PrimaryButton>
        <Message value={message} />
      </div>
    </form>
  );
}

/** In a person's card: their department, where they help, and the lead switch. */
export function MemberDepartmentForm({
  membershipId,
  isOwner,
  department,
  helpsIn,
  isLead,
  currentLeadName,
  departments,
}: {
  membershipId: string;
  isOwner: boolean;
  department: Department | null;
  helpsIn: Department[];
  isLead: boolean;
  /** Who leads the chosen department today, if somebody else does. */
  currentLeadName: Partial<Record<Department, string>>;
  departments: DepartmentInfo[];
}) {
  const [main, setMain] = useState<Department | null>(department);
  const [help, setHelp] = useState<Department[]>(helpsIn);
  const [lead, setLead] = useState(isLead);
  const { pending, message, submit } = useSave(updateMemberDepartmentAction);
  const other = main ? currentLeadName[main] : undefined;
  const mainName = departments.find((entry) => entry.id === main)?.name.toLowerCase();

  return (
    <form action={submit} style={{ display: "grid", gap: 14, paddingTop: 4 }}>
      <input type="hidden" name="membershipId" value={membershipId} />
      <input type="hidden" name="department" value={main ?? ""} />
      {help.map((entry) => (
        <input key={entry} type="hidden" name="helpsIn" value={entry} />
      ))}
      {lead ? <input type="hidden" name="isLead" value="on" /> : null}

      <div style={{ display: "grid", gap: 8 }}>
        <span style={labelStyle}>Reparto</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {departments.map((entry) => (
            <DepartmentChip
              key={entry.id}
              department={entry}
              active={main === entry.id}
              onClick={() => {
                const next = main === entry.id ? null : entry.id;
                setMain(next);
                setHelp((list) => list.filter((value) => value !== next));
                setLead(false);
              }}
            />
          ))}
        </div>
      </div>

      {main ? (
        <div style={{ display: "grid", gap: 8 }}>
          <span style={labelStyle}>Può dare una mano in</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {departments
              .filter((entry) => entry.id !== main)
              .map((entry) => (
                <DepartmentChip
                  key={entry.id}
                  department={entry}
                  active={help.includes(entry.id)}
                  onClick={() =>
                    setHelp((list) =>
                      list.includes(entry.id) ? list.filter((value) => value !== entry.id) : [...list, entry.id]
                    )
                  }
                />
              ))}
          </div>
        </div>
      ) : null}

      {main && !isOwner ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, borderTop: "1px solid #f0ebfb", paddingTop: 12 }}>
          <span style={{ flex: 1, display: "grid", gap: 2 }}>
            <strong style={{ fontSize: 14 }}>Capo reparto</strong>
            <span style={{ fontSize: 12, color: "#8a84a8" }}>
              {other && !lead
                ? `Oggi è ${other}: lo sostituisce.`
                : `Gestisce turni, ferie e cambi di ${mainName}.`}
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={lead}
            aria-label="Capo reparto"
            onClick={() => setLead((value) => !value)}
            style={{
              width: 48,
              height: 29,
              borderRadius: 999,
              border: 0,
              position: "relative",
              background: lead ? "#6d3df0" : "#e3dcf7",
              cursor: "pointer",
              flex: "0 0 auto",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 3,
                left: lead ? 22 : 3,
                width: 23,
                height: 23,
                borderRadius: 999,
                background: "#ffffff",
                boxShadow: "0 1px 3px rgba(0,0,0,.15)",
                transition: "left .15s",
              }}
            />
          </button>
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Salvo..." : "Salva reparto"}
        </PrimaryButton>
        <Message value={message} />
      </div>
    </form>
  );
}
