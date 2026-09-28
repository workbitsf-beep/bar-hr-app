"use client";

import { useState } from "react";

export type TaskRepeatUnitValue = "DAY" | "WEEK" | "MONTH";

export type TaskRepeatDraft = {
  every: number;
  unit: TaskRepeatUnitValue;
} | null;

const UNIT_OPTIONS: { value: TaskRepeatUnitValue; singular: string; plural: string }[] = [
  { value: "DAY", singular: "giorno", plural: "giorni" },
  { value: "WEEK", singular: "settimana", plural: "settimane" },
  { value: "MONTH", singular: "mese", plural: "mesi" },
];

const UNIT_MAX: Record<TaskRepeatUnitValue, number> = {
  DAY: 365,
  WEEK: 104,
  MONTH: 60,
};

/**
 * The periods a venue actually works to. Everything else exists too, behind
 * "Altro", but nobody should have to type "1" and pick "mese" to say monthly.
 */
const PRESETS: { label: string; repeat: TaskRepeatDraft }[] = [
  { label: "Ogni giorno", repeat: { every: 1, unit: "DAY" } },
  { label: "Ogni settimana", repeat: { every: 1, unit: "WEEK" } },
  { label: "Ogni mese", repeat: { every: 1, unit: "MONTH" } },
  { label: "Ogni 3 mesi", repeat: { every: 3, unit: "MONTH" } },
  { label: "Ogni 6 mesi", repeat: { every: 6, unit: "MONTH" } },
  { label: "Ogni anno", repeat: { every: 12, unit: "MONTH" } },
];

export const DEFAULT_TASK_REPEAT: TaskRepeatDraft = { every: 1, unit: "MONTH" };

export function describeTaskRepeatDraft(repeat: TaskRepeatDraft) {
  if (!repeat) {
    return null;
  }

  const option = UNIT_OPTIONS.find((item) => item.value === repeat.unit);

  if (!option) {
    return null;
  }

  if (repeat.every === 12 && repeat.unit === "MONTH") {
    return "ogni anno";
  }

  return repeat.every === 1 ? `ogni ${option.singular}` : `ogni ${repeat.every} ${option.plural}`;
}

function matchesPreset(repeat: TaskRepeatDraft, preset: TaskRepeatDraft) {
  return Boolean(repeat && preset && repeat.every === preset.every && repeat.unit === preset.unit);
}

/**
 * How often a note comes back.
 *
 * The periods people ask for are a short list, so the list is what is shown;
 * the free number is there for the odd one out and stays folded away until it
 * is needed.
 */
export function TaskRepeatField({
  repeat,
  onChange,
  allowNever = true,
  disabled = false,
}: {
  repeat: TaskRepeatDraft;
  onChange: (repeat: TaskRepeatDraft) => void;
  allowNever?: boolean;
  disabled?: boolean;
}) {
  const isPreset = PRESETS.some((preset) => matchesPreset(repeat, preset.repeat));
  const [showCustom, setShowCustom] = useState(Boolean(repeat) && !isPreset);
  const customActive = showCustom || (Boolean(repeat) && !isPreset);

  return (
    <div style={{ display: "grid", gap: 9 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {allowNever ? (
          <PresetButton
            label="Mai"
            active={repeat === null}
            disabled={disabled}
            onClick={() => {
              setShowCustom(false);
              onChange(null);
            }}
          />
        ) : null}

        {PRESETS.map((preset) => (
          <PresetButton
            key={preset.label}
            label={preset.label}
            active={matchesPreset(repeat, preset.repeat)}
            disabled={disabled}
            onClick={() => {
              setShowCustom(false);
              onChange(preset.repeat);
            }}
          />
        ))}

        <PresetButton
          label="Altro…"
          active={customActive}
          disabled={disabled}
          onClick={() => {
            setShowCustom(true);

            if (!repeat) {
              onChange(DEFAULT_TASK_REPEAT);
            }
          }}
        />
      </div>

      {customActive && repeat ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 800, color: "#0f172a" }}>Ogni</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={UNIT_MAX[repeat.unit]}
            value={repeat.every}
            disabled={disabled}
            onChange={(event) => {
              const next = Number(event.target.value);

              onChange({ ...repeat, every: Number.isFinite(next) ? Math.trunc(next) : 1 });
            }}
            onBlur={() =>
              onChange({
                ...repeat,
                every: Math.min(Math.max(1, repeat.every || 1), UNIT_MAX[repeat.unit]),
              })
            }
            aria-label="Ogni quanto si ripete"
            style={{
              width: 72,
              minHeight: 42,
              padding: "0 12px",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              color: "#0f172a",
              fontSize: 16,
              fontWeight: 800,
            }}
          />
          <select
            value={repeat.unit}
            disabled={disabled}
            onChange={(event) => {
              const unit = event.target.value as TaskRepeatUnitValue;

              onChange({ unit, every: Math.min(repeat.every || 1, UNIT_MAX[unit]) });
            }}
            aria-label="Unità di ripetizione"
            style={{
              flex: "1 1 120px",
              minHeight: 42,
              padding: "0 12px",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              color: "#0f172a",
              fontSize: 16,
              fontWeight: 800,
            }}
          >
            {UNIT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {repeat.every === 1 ? option.singular : option.plural}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}

function PresetButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: 38,
        padding: "0 13px",
        borderRadius: 999,
        border: active ? "1px solid rgba(124, 58, 237, 0.46)" : "1px solid #e2e8f0",
        background: active ? "#f3e8ff" : "#ffffff",
        color: active ? "#4c1d95" : "#475569",
        fontSize: 13,
        fontWeight: 800,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {label}
    </button>
  );
}
