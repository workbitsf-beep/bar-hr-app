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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectedCount = selected.size;

  return (
    <ActionForm
      action={markShoppingListItemsOrderedAction} success="Segnati come ordinati."
      onSubmit={() => setSelected(new Set())}
      style={{ display: "grid", gap: 14 }}
    >
      <div className="wb-mix-rows">
        {items.map((item) => (
          <label
            key={item.id}
            style={{
              display: "flex",
              alignItems: "center",
              position: "relative",
              gap: 12,
              padding: "10px 0",
              borderTop: "1px solid #f1eff8",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              name="itemIds"
              value={item.id}
              checked={selected.has(item.id)}
              onChange={(event) =>
                setSelected((current) => {
                  const next = new Set(current);
                  if (event.target.checked) next.add(item.id);
                  else next.delete(item.id);
                  return next;
                })
              }
              style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
            />
            <span style={{ display: "grid", gap: 2, minWidth: 0, flex: 1 }}>
              <span style={{ color: "#111827", fontWeight: 650, fontSize: 15 }}>
                {item.name}
                {item.quantity ? (
                  <span style={{ color: "#667085", fontWeight: 500 }}> × {item.quantity}</span>
                ) : null}
              </span>
              <span style={{ color: "#667085", fontSize: 13 }}>{item.createdByName}</span>
            </span>
            {/* The green tick of the rest of the app: light until picked, full once picked. */}
            <span
              aria-hidden="true"
              style={{
                width: 40,
                height: 40,
                flex: "0 0 auto",
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 900,
                border: "1px solid #bbf7d0",
                background: selected.has(item.id) ? "#10b981" : "#dcfce7",
                color: selected.has(item.id) ? "#ffffff" : "#166534",
              }}
            >
              ✓
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
