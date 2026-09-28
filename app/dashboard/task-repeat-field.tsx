"use client";

export type TaskRepeatUnitValue = "DAY" | "WEEK" | "MONTH";

export type TaskRepeatDraft = {
  every: number;
  unit: TaskRepeatUnitValue;
} | null;

/** What a new series starts as: once a month, the commonest venue check. */
export const DEFAULT_TASK_REPEAT: TaskRepeatDraft = { every: 1, unit: "MONTH" };

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

export function describeTaskRepeatDraft(repeat: TaskRepeatDraft) {
  if (!repeat) {
    return null;
  }

  const option = UNIT_OPTIONS.find((item) => item.value === repeat.unit);

  if (!option) {
    return null;
  }

  return repeat.every === 1 ? `ogni ${option.singular}` : `ogni ${repeat.every} ${option.plural}`;
}

/**
 * Turns a note into one that comes back on its own.
 *
 * Off is the answer nearly every time, so off is what it shows: one pair of
 * pills, and the number only appears once repeating has been chosen.
 */
export function TaskRepeatField({
  repeat,
  onChange,
  disabled = false,
}: {
  repeat: TaskRepeatDraft;
  onChange: (repeat: TaskRepeatDraft) => void;
  disabled?: boolean;
}) {
  const active = repeat !== null;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 8,
        }}
      >
        {[
          { repeating: false, label: "Una volta" },
          { repeating: true, label: "Si ripete" },
        ].map((option) => (
          <button
            key={option.label}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.repeating ? (repeat ?? DEFAULT_TASK_REPEAT) : null)}
            style={{
              minHeight: 40,
              borderRadius: 14,
              border:
                active === option.repeating
                  ? "1px solid rgba(124, 58, 237, 0.46)"
                  : "1px solid #e2e8f0",
              background: active === option.repeating ? "#f3e8ff" : "#ffffff",
              color: active === option.repeating ? "#4c1d95" : "#334155",
              fontWeight: 800,
              cursor: disabled ? "default" : "pointer",
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {repeat ? (
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

              onChange({
                ...repeat,
                every: Number.isFinite(next) ? Math.trunc(next) : 1,
              });
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
