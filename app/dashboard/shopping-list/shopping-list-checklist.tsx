"use client";

import { useState } from "react";
import { markShoppingListItemsOrderedAction } from "../actions";
import { PrimaryButton } from "../ui";
import { ActionForm } from "@/app/components/action-form";

type ShoppingListItemView = {
  id: string;
  name: string;
  quantity: string | null;
  createdByName: string;
};

export function ShoppingListChecklist({ items }: { items: ShoppingListItemView[] }) {
  const [selectedCount, setSelectedCount] = useState(0);

  return (
    <ActionForm
      action={markShoppingListItemsOrderedAction} success="Segnati come ordinati."
      onSubmit={() => setSelectedCount(0)}
      style={{ display: "grid", gap: 14 }}
    >
      <div className="wb-mix-rows">
        {items.map((item) => (
          <label
            key={item.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 0",
              borderTop: "1px solid #f1eff8",
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
              <span style={{ color: "#111827", fontWeight: 650, fontSize: 15 }}>
                {item.name}
                {item.quantity ? (
                  <span style={{ color: "#64748b", fontWeight: 500 }}> — {item.quantity}</span>
                ) : null}
              </span>
              <span style={{ color: "#667085", fontSize: 13 }}>da {item.createdByName}</span>
            </span>
          </label>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <PrimaryButton type="submit" disabled={selectedCount === 0}>
          {`Segna come ordinati${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
        </PrimaryButton>
      </div>
    </ActionForm>
  );
}
