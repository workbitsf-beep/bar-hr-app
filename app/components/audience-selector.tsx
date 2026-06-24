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
}: {
  members: AudienceMember[];
  assignedToAll: boolean;
  assignedToId: string;
  onChange: (value: { assignedToAll: boolean; assignedToId: string }) => void;
  teamLabel?: string;
  peopleLabel?: string;
}) {
  const basePillStyle = {
    minHeight: 58,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: "13px 18px",
    fontSize: 18,
    fontWeight: 850,
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
            border: assignedToAll ? "2px solid #7c3aed" : "1px solid #e2e8f0",
            background: assignedToAll ? "#f3e8ff" : "#ffffff",
            color: assignedToAll ? "#4c1d95" : "#334155",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>
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
            border: !assignedToAll ? "2px solid #7c3aed" : "1px solid #e2e8f0",
            background: !assignedToAll ? "#f3e8ff" : "#ffffff",
            color: !assignedToAll ? "#4c1d95" : "#334155",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>
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
            const selected = assignedToId === member.id;

            return (
              <button
                key={member.id}
                className="dashboard-select-pill"
                type="button"
                onClick={() => onChange({ assignedToAll: false, assignedToId: selected ? "" : member.id })}
                aria-pressed={selected}
                style={{
                  borderRadius: 999,
                  border: selected ? "2px solid #7c3aed" : "1px solid #e2e8f0",
                  background: selected ? "#f3e8ff" : "#ffffff",
                  color: selected ? "#4c1d95" : "#334155",
                  padding: "10px 14px",
                  fontSize: 15,
                  fontWeight: 800,
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
        <span style={{ color: "#64748b", fontSize: 13, fontWeight: 700 }}>
          {assignedToId ? "1 selezionato" : "Nessun dipendente selezionato"}
        </span>
      ) : null}
    </div>
  );
}
