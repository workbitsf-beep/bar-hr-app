"use client";

type AudienceMember = {
  id: string;
  label: string;
};

export function AudienceSelector({
  members,
  assignedToAll,
  assignedToId,
  onChange,
  teamLabel = "Team",
  peopleLabel = "Dipendenti",
  multiple = true,
}: {
  members: AudienceMember[];
  assignedToAll: boolean;
  assignedToId: string;
  onChange: (value: { assignedToAll: boolean; assignedToId: string }) => void;
  teamLabel?: string;
  peopleLabel?: string;
  multiple?: boolean;
}) {
  const selectedIds = assignedToId
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const basePillStyle = {
    minHeight: 42,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "9px 13px",
    fontSize: 14,
    fontWeight: 760,
    cursor: "pointer",
    transition: "background 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease",
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.04)",
  } as const;

  return (
    <div className="dashboard-audience-selector" style={{ display: "grid", gap: 12 }}>
      <div
        className="dashboard-audience-options"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
      >
        <button
          className="dashboard-select-pill"
          type="button"
          onClick={() => onChange({ assignedToAll: true, assignedToId: "" })}
          aria-pressed={assignedToAll}
          style={{
            ...basePillStyle,
            border: assignedToAll ? "1.5px solid var(--workbit-purple)" : "1px solid var(--workbit-border)",
            background: assignedToAll ? "var(--workbit-gradient-soft)" : "var(--workbit-surface-elevated)",
            color: assignedToAll ? "var(--workbit-purple-dark)" : "var(--workbit-text-secondary)",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
            {assignedToAll ? "✓" : "○"}
          </span>
          <span>{teamLabel}</span>
        </button>
        <button
          className="dashboard-select-pill"
          type="button"
          onClick={() => onChange({ assignedToAll: false, assignedToId })}
          aria-pressed={!assignedToAll}
          style={{
            ...basePillStyle,
            border: !assignedToAll ? "1.5px solid var(--workbit-purple)" : "1px solid var(--workbit-border)",
            background: !assignedToAll ? "var(--workbit-gradient-soft)" : "var(--workbit-surface-elevated)",
            color: !assignedToAll ? "var(--workbit-purple-dark)" : "var(--workbit-text-secondary)",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
            {!assignedToAll ? "✓" : "○"}
          </span>
          <span>{peopleLabel}</span>
        </button>
      </div>

      {!assignedToAll ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            maxHeight: 148,
            overflowY: "auto",
            padding: 4,
          }}
        >
          {members.map((member) => {
            const selected = selectedIds.includes(member.id);

            return (
              <button
                key={member.id}
                className="dashboard-select-pill"
                type="button"
                onClick={() => {
                  if (!multiple) {
                    onChange({ assignedToAll: false, assignedToId: selected ? "" : member.id });
                    return;
                  }

                  const nextIds = selected
                    ? selectedIds.filter((id) => id !== member.id)
                    : selectedIds.concat(member.id);

                  onChange({ assignedToAll: false, assignedToId: nextIds.join(",") });
                }}
                aria-pressed={selected}
                style={{
                  borderRadius: 999,
                  border: selected ? "1.5px solid var(--workbit-purple)" : "1px solid var(--workbit-border)",
                  background: selected ? "var(--workbit-gradient-soft)" : "var(--workbit-surface-elevated)",
                  color: selected ? "var(--workbit-purple-dark)" : "var(--workbit-text-secondary)",
                  padding: "8px 12px",
                  fontSize: 13,
                  fontWeight: 750,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: selected ? "0 8px 18px rgba(124, 58, 237, 0.10)" : "none",
                  cursor: "pointer",
                }}
              >
                <span aria-hidden="true">{selected ? "✓" : "○"}</span>
                <span>{member.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {!assignedToAll ? (
        <span style={{ color: "var(--workbit-muted)", fontSize: 13, fontWeight: 700 }}>
          {selectedIds.length === 0
            ? "Nessun dipendente selezionato"
            : selectedIds.length === 1
              ? "1 selezionato"
              : `${selectedIds.length} selezionati`}
        </span>
      ) : null}
    </div>
  );
}
