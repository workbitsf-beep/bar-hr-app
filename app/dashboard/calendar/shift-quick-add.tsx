"use client";

import { useMemo, useState } from "react";
import type { ShiftPreset } from "@/lib/shift-presets";

export type QuickAddMember = {
  id: string;
  name: string;
  /** Why they cannot take this shift, when they cannot: "ferie", "non c'è". */
  busy?: string | null;
};

type Step = "time" | "people";

/** How many times the same two hours have to appear before the app offers to keep them. */
const OFFER_AFTER = 3;

/**
 * Putting a shift in, in two screens.
 *
 * Few venues work to fixed hours, so writing the two times is the road and the
 * standard slots are the shortcut: the keypad is always there, and one row of
 * chips above it offers the venue's own slots and the times it has used
 * lately. The row goes as soon as the hours are in.
 *
 * The keypad is the app's own rather than the phone's: the digits are twice
 * the size, nothing slides in and out from the bottom, and the two times stay
 * on screen the whole time.
 */
export function ShiftQuickAdd({
  dayLabel,
  members,
  presets,
  recent,
  pending = false,
  onCancel,
  onSave,
  onSavePreset,
}: {
  dayLabel: string;
  members: QuickAddMember[];
  presets: ShiftPreset[];
  /** The times this venue has actually used lately, most used first. */
  recent: { startTime: string; endTime: string; count: number }[];
  pending?: boolean;
  onCancel: () => void;
  onSave: (shift: { startTime: string; endTime: string; memberIds: string[]; isOnCall: boolean }) => void;
  /** Absent when the venue's standard slots cannot be edited from here. */
  onSavePreset?: (slot: { startTime: string; endTime: string }) => void;
}) {
  const [step, setStep] = useState<Step>("time");
  const [digits, setDigits] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [isOnCall, setIsOnCall] = useState(false);
  const [presetOffered, setPresetOffered] = useState<string[]>([]);

  const start = formatSlice(digits, 0);
  const end = formatSlice(digits, 4);
  const complete = digits.length === 8 && isValidTime(digits.slice(0, 4)) && isValidTime(digits.slice(4));
  const minutes = complete ? spanMinutes(digits.slice(0, 4), digits.slice(4)) : 0;

  function press(value: string) {
    setDigits((current) => {
      if (current.length >= 8) {
        return current;
      }

      const next = current + value;

      // Refuse a first digit that cannot begin an hour, so 9 becomes 09 rather
      // than the start of 9x:xx.
      if (next.length === 1 && Number(next) > 2) {
        return `0${next}`;
      }

      if (next.length === 5 && Number(value) > 2) {
        return `${current}0${value}`;
      }

      return next;
    });
  }

  function applyRange(startTime: string, endTime: string) {
    setDigits(`${startTime.replace(":", "")}${endTime.replace(":", "")}`.slice(0, 8));
  }

  const shortcuts = useMemo(() => {
    const seen = new Set<string>();
    const rows: { key: string; label: string; detail: string; startTime: string; endTime: string; standard: boolean }[] = [];

    for (const preset of presets) {
      const key = `${preset.startTime}-${preset.endTime}`;
      seen.add(key);
      rows.push({
        key,
        label: preset.label,
        detail: `${preset.startTime.slice(0, 2)}–${preset.endTime.slice(0, 2)}`,
        startTime: preset.startTime,
        endTime: preset.endTime,
        standard: true,
      });
    }

    for (const entry of recent) {
      const key = `${entry.startTime}-${entry.endTime}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      rows.push({
        key,
        label: `${entry.startTime}–${entry.endTime}`,
        detail: "",
        startTime: entry.startTime,
        endTime: entry.endTime,
        standard: false,
      });
    }

    return rows.slice(0, 5);
  }, [presets, recent]);

  const offer = useMemo(() => {
    if (!complete || !onSavePreset || presetOffered.includes(`${start}-${end}`)) {
      return false;
    }

    if (presets.some((preset) => preset.startTime === start && preset.endTime === end)) {
      return false;
    }

    const used = recent.find((entry) => entry.startTime === start && entry.endTime === end);

    return (used?.count ?? 0) >= OFFER_AFTER;
  }, [complete, end, onSavePreset, presetOffered, presets, recent, start]);

  if (step === "people") {
    return (
      <div style={{ display: "grid", gap: 13 }}>
        <Head
          title="Chi ci lavora"
          detail={`${dayLabel} · ${start}–${end}`}
          onBack={() => setStep("time")}
          backLabel="‹"
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {members.map((member) => {
            const chosen = memberIds.includes(member.id);

            return (
              <button
                key={member.id}
                type="button"
                disabled={Boolean(member.busy)}
                onClick={() =>
                  setMemberIds((current) =>
                    current.includes(member.id)
                      ? current.filter((id) => id !== member.id)
                      : current.concat(member.id)
                  )
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 13px 6px 6px",
                  borderRadius: 999,
                  border: chosen ? "1.5px solid #6d5ce7" : "1.5px solid #ebedf3",
                  background: chosen ? "#efecff" : "#ffffff",
                  color: chosen ? "#4c1d95" : "#16161d",
                  fontSize: 13.5,
                  fontWeight: chosen ? 820 : 720,
                  opacity: member.busy ? 0.45 : 1,
                  cursor: member.busy ? "default" : "pointer",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 27,
                    height: 27,
                    borderRadius: 999,
                    display: "inline-grid",
                    placeItems: "center",
                    background: chosen ? "#ffffff" : "#f1effe",
                    color: "#4c1d95",
                    fontSize: 10,
                    fontWeight: 850,
                  }}
                >
                  {initialsOf(member.name)}
                </span>
                {member.name.split(" ")[0]}
                {member.busy ? ` ${member.busy}` : ""}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setIsOnCall((current) => !current)}
          style={{
            justifySelf: "start",
            padding: "9px 14px",
            borderRadius: 999,
            border: isOnCall ? "1.5px solid #6d5ce7" : "1.5px dashed #d8d5ee",
            background: isOnCall ? "#efecff" : "transparent",
            color: isOnCall ? "#4c1d95" : "#6b7280",
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {isOnCall ? "✓ Reperibilità" : "＋ Reperibilità"}
        </button>

        <button
          type="button"
          disabled={pending || memberIds.length === 0}
          onClick={() =>
            onSave({
              startTime: start,
              endTime: end,
              memberIds,
              isOnCall,
            })
          }
          style={ctaStyle(memberIds.length > 0 && !pending)}
        >
          {pending ? "Salvo…" : "Salva turno"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Head title="Orario" detail={dayLabel} onBack={onCancel} backLabel="✕" />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) 24px minmax(0,1fr)",
          alignItems: "center",
          gap: 4,
        }}
      >
        <TimeBox value={start} caption="inizio" active={digits.length < 4} />
        <span style={{ textAlign: "center", color: "#a3a3b5", fontSize: 16, fontWeight: 800 }}>→</span>
        <TimeBox value={end} caption="fine" active={digits.length >= 4} />
      </div>

      {complete ? (
        offer ? (
          // The third time the same two times get typed, the app asks once
          // whether they should become one of the venue's slots.
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 14,
              background: "#efecff",
              border: "1.5px solid #ddd8f8",
            }}
          >
            <span style={{ minWidth: 0, flex: 1, fontSize: 12.5, fontWeight: 760, color: "#4c1d95" }}>
              Usi spesso {start}–{end}. Vuoi salvarlo fra le fasce?
            </span>
            <button
              type="button"
              onClick={() => {
                onSavePreset?.({ startTime: start, endTime: end });
                setPresetOffered((current) => current.concat(`${start}-${end}`));
              }}
              style={{
                flex: "0 0 auto",
                padding: "7px 13px",
                borderRadius: 999,
                border: 0,
                background: "#4c1d95",
                color: "#ffffff",
                fontSize: 12.5,
                fontWeight: 820,
                cursor: "pointer",
              }}
            >
              Salva
            </button>
            <button
              type="button"
              aria-label="No grazie"
              onClick={() => setPresetOffered((current) => current.concat(`${start}-${end}`))}
              style={{
                flex: "0 0 auto",
                width: 26,
                height: 26,
                borderRadius: 999,
                border: 0,
                background: "transparent",
                color: "#7c6bd6",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <span style={{ textAlign: "center", fontSize: 12.5, fontWeight: 750, color: "#a3a3b5" }}>
            {describeSpan(minutes)}
          </span>
        )
      ) : shortcuts.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {shortcuts.map((shortcut) => (
            <button
              key={shortcut.key}
              type="button"
              onClick={() => applyRange(shortcut.startTime, shortcut.endTime)}
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                border: shortcut.standard ? "1.5px solid #6d5ce7" : "1.5px dashed #ebedf3",
                background: shortcut.standard ? "#efecff" : "#ffffff",
                color: shortcut.standard ? "#4c1d95" : "#6b7280",
                fontSize: 12.5,
                fontWeight: shortcut.standard ? 830 : 780,
                fontVariantNumeric: "tabular-nums",
                cursor: "pointer",
              }}
            >
              {shortcut.label}
              {shortcut.detail ? (
                <span style={{ fontWeight: 780, opacity: 0.75, marginLeft: 5 }}>{shortcut.detail}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 7 }}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((key) => (
          <button key={key} type="button" onClick={() => press(key)} style={keyStyle(false)}>
            {key}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setDigits((current) => (current.length === 2 || current.length === 6 ? `${current}00` : current))}
          style={keyStyle(true)}
        >
          :00
        </button>
        <button type="button" onClick={() => press("0")} style={keyStyle(false)}>
          0
        </button>
        <button
          type="button"
          onClick={() => setDigits((current) => current.slice(0, -1))}
          style={keyStyle(true)}
        >
          ⌫
        </button>
      </div>

      <button
        type="button"
        disabled={!complete || minutes <= 0}
        onClick={() => setStep("people")}
        style={ctaStyle(complete && minutes > 0)}
      >
        Avanti
      </button>
    </div>
  );
}

function Head({
  title,
  detail,
  onBack,
  backLabel,
}: {
  title: string;
  detail: string;
  onBack: () => void;
  backLabel: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
        <strong style={{ fontSize: 18, fontWeight: 820, letterSpacing: "-0.02em", color: "#16161d" }}>
          {title}
        </strong>
        <span style={{ fontSize: 12.5, fontWeight: 750, color: "#a3a3b5" }}>{detail}</span>
      </span>
      <button
        type="button"
        onClick={onBack}
        aria-label="Indietro"
        style={{
          width: 34,
          height: 34,
          flex: "0 0 auto",
          display: "inline-grid",
          placeItems: "center",
          borderRadius: 999,
          border: 0,
          background: "#efecff",
          color: "#4c1d95",
          fontSize: 14,
          fontWeight: 750,
          cursor: "pointer",
        }}
      >
        {backLabel}
      </button>
    </div>
  );
}

function TimeBox({ value, caption, active }: { value: string; caption: string; active: boolean }) {
  const empty = value.includes("-");

  return (
    <span
      style={{
        display: "grid",
        gap: 2,
        justifyItems: "center",
        padding: "12px 6px",
        borderRadius: 16,
        background: active ? "#efecff" : "#ffffff",
        border: `1.5px solid ${active ? "#6d5ce7" : "#ebedf3"}`,
      }}
    >
      <strong
        style={{
          fontSize: 26,
          fontWeight: 830,
          letterSpacing: "-0.03em",
          fontVariantNumeric: "tabular-nums",
          color: empty ? "#d4d2e6" : active ? "#4c1d95" : "#16161d",
        }}
      >
        {value}
      </strong>
      <span
        style={{
          fontSize: 10,
          fontWeight: 850,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: active ? "#7c6bd6" : "#a3a3b5",
        }}
      >
        {caption}
      </span>
    </span>
  );
}

function keyStyle(soft: boolean) {
  return {
    minHeight: 46,
    display: "inline-grid",
    placeItems: "center",
    borderRadius: 14,
    background: soft ? "#efecff" : "#ffffff",
    border: soft ? "1px solid transparent" : "1px solid #ebedf3",
    color: soft ? "#4c1d95" : "#16161d",
    fontSize: soft ? 15 : 19,
    fontWeight: soft ? 820 : 750,
    fontVariantNumeric: "tabular-nums" as const,
    cursor: "pointer",
  };
}

function ctaStyle(enabled: boolean) {
  return {
    minHeight: 50,
    display: "inline-grid",
    placeItems: "center",
    borderRadius: 16,
    border: 0,
    background: enabled ? "linear-gradient(135deg, #3b1d8f 0%, #5e4ae3 55%, #8b5cf6 100%)" : "#eef1f6",
    color: enabled ? "#ffffff" : "#b6bfcc",
    fontSize: 15,
    fontWeight: 820,
    boxShadow: enabled ? "0 10px 22px rgba(94, 74, 227, 0.26)" : "none",
    cursor: enabled ? "pointer" : "default",
  };
}

function formatSlice(digits: string, from: number) {
  const part = digits.slice(from, from + 4).padEnd(4, "-");

  return `${part.slice(0, 2)}:${part.slice(2)}`;
}

function isValidTime(part: string) {
  return part.length === 4 && Number(part.slice(0, 2)) < 24 && Number(part.slice(2)) < 60;
}

function spanMinutes(startPart: string, endPart: string) {
  const start = Number(startPart.slice(0, 2)) * 60 + Number(startPart.slice(2));
  const end = Number(endPart.slice(0, 2)) * 60 + Number(endPart.slice(2));

  // A shift that ends before it starts has run past midnight.
  return end > start ? end - start : end + 24 * 60 - start;
}

function describeSpan(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) {
    return `${rest} minuti`;
  }

  return rest === 0
    ? `${hours} ${hours === 1 ? "ora" : "ore"}`
    : `${hours} ${hours === 1 ? "ora" : "ore"} e ${rest}`;
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
