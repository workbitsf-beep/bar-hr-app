"use client";

import { IconButton } from "../ui";

type OwnerOption = {
  id: string;
  firstName: string;
  lastName: string;
};

export function AdditionalOwnersPicker({
  owners,
  excludeOwnerId,
  selectedIds,
  onChange,
  draftId,
  onDraftChange,
  emitHiddenInputs,
}: {
  owners: OwnerOption[];
  excludeOwnerId: string;
  selectedIds: string[];
  onChange: (next: string[]) => void;
  draftId: string;
  onDraftChange: (id: string) => void;
  emitHiddenInputs: boolean;
}) {
  const visibleIds = selectedIds.filter((id) => id !== excludeOwnerId);

  function addOwner() {
    if (!draftId || draftId === excludeOwnerId) {
      return;
    }

    onChange(selectedIds.includes(draftId) ? selectedIds : [...selectedIds, draftId]);
    onDraftChange("");
  }

  function removeOwner(ownerId: string) {
    onChange(selectedIds.filter((id) => id !== ownerId));
  }

  return (
    <div
      style={{
        gridColumn: "1 / -1",
        display: "grid",
        gap: 10,
        padding: 16,
        borderRadius: 20,
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <strong style={{ color: "#f5f3ff" }}>Titolari aggiuntivi</strong>
        <span style={{ color: "#9296b8", fontSize: 13 }}>{visibleIds.length} selezionati</span>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
        <div style={{ flex: "1 1 220px", minWidth: 0, display: "grid", gap: 8 }}>
          <span style={{ color: "#9296b8", fontSize: 13, fontWeight: 600 }}>Seleziona titolare</span>
          <select
            value={draftId}
            onChange={(event) => onDraftChange(event.target.value)}
            style={{
              borderRadius: 16,
              border: "1px solid rgba(255, 255, 255, 0.16)",
              padding: "12px 14px",
              fontSize: 15,
              background: "rgba(255, 255, 255, 0.05)",
              color: "#f5f3ff",
              colorScheme: "dark",
            }}
          >
            <option value="">Aggiungi titolare</option>
            {owners
              .filter((owner) => owner.id !== excludeOwnerId && !selectedIds.includes(owner.id))
              .map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.firstName} {owner.lastName}
                </option>
              ))}
          </select>
        </div>

        <IconButton type="button" onClick={addOwner} disabled={!draftId} aria-label="Aggiungi titolare">
          +
        </IconButton>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          maxHeight: 140,
          overflowY: "auto",
          paddingRight: 4,
        }}
      >
        {visibleIds.map((ownerId) => {
          const owner = owners.find((item) => item.id === ownerId);

          if (!owner) {
            return null;
          }

          return (
            <span
              key={owner.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                borderRadius: 999,
                padding: "8px 12px",
                background: "rgba(123, 47, 247, 0.18)",
                color: "#d8c9fe",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {emitHiddenInputs ? <input type="hidden" name="additionalOwnerIds" value={owner.id} /> : null}
              {owner.firstName} {owner.lastName}
              <button
                type="button"
                onClick={() => removeOwner(owner.id)}
                style={{
                  border: 0,
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                  fontSize: 16,
                  lineHeight: 1,
                }}
                aria-label={`Rimuovi ${owner.firstName} ${owner.lastName}`}
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
