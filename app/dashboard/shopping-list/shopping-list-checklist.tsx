"use client";

import { useState } from "react";
import { markShoppingListItemsOrderedAction } from "../actions";
import { PrimaryButton } from "../ui";

type ShoppingListItemView = {
  id: string;
  name: string;
  quantity: string | null;
  createdByName: string;
};

export function ShoppingListChecklist({ items }: { items: ShoppingListItemView[] }) {
  const [selectedCount, setSelectedCount] = useState(0);

  return (
    <form
      action={markShoppingListItemsOrderedAction}
      onSubmit={() => setSelectedCount(0)}
      style={{ display: "grid", gap: 14 }}
    >
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((item) => (
          <label
            key={item.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 16,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              name="itemIds"
              value={item.id}
              onChange={(event) =>
                setSelectedCount((current) => current + (event.target.checked ? 1 : -1))
              }
              style={{ width: 18, height: 18, flex: "0 0 auto" }}
            />
            <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
              <span style={{ color: "#0f172a", fontWeight: 700 }}>
                {item.name}
                {item.quantity ? (
                  <span style={{ color: "#64748b", fontWeight: 500 }}> — {item.quantity}</span>
                ) : null}
              </span>
              <span style={{ color: "#94a3b8", fontSize: 12 }}>aggiunto da {item.createdByName}</span>
            </span>
          </label>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <PrimaryButton type="submit" disabled={selectedCount === 0}>
          {`Segna come ordinati${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
        </PrimaryButton>
      </div>
    </form>
  );
}
