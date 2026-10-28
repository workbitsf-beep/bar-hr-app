"use client";

import { ActionForm } from "@/app/components/action-form";
import { COST_CATEGORIES } from "@/lib/costs/categories";
import { correctCategoryAction } from "./actions";

/** A line's category, changed on the spot; remembered for the supplier's next invoices. */
export function CategorySelect({ lineId, category, supplierName }: { lineId: string; category: string; supplierName: string }) {
  return (
    <ActionForm
      // Remounted with the saved category: the form resets after a save.
      key={category}
      action={correctCategoryAction}
      success="Categoria salvata, vale anche per le prossime fatture"
      style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
    >
      <input type="hidden" name="lineId" value={lineId} />
      <label style={{ display: "inline-flex", gap: 5, alignItems: "center", fontSize: 12, color: "#7c7894" }}>
        <input type="checkbox" name="wholeSupplier" />
        vale per tutto {supplierName.length > 24 ? "il fornitore" : supplierName}
      </label>
      <select
        name="category"
        defaultValue={category}
        aria-label="Categoria"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        style={{ minHeight: 32, borderRadius: 10, border: "1px solid #e9e6f5", background: "#ffffff", fontSize: 13, padding: "0 8px", maxWidth: "100%" }}
      >
        {COST_CATEGORIES.map((item) => (
          <option key={item.key} value={item.key} disabled={item.key === "da_classificare"}>
            {item.label}
          </option>
        ))}
      </select>
    </ActionForm>
  );
}
