"use client";

import { useRef, useState } from "react";
import type { Department } from "@prisma/client";
import type { DepartmentInfo } from "@/lib/departments";
import { createShoppingListItemAction, markShoppingListItemsOrderedAction } from "./actions";
import { DepartmentDot } from "./department-forms";
import { PopupAction } from "./popup-action";

export type ShoppingListEntry = {
  id: string;
  name: string;
  quantity: string | null;
  createdByName: string;
  /** Pro: the department the item is for. */
  department?: DepartmentInfo | null;
};

/** Pro: the venue's departments, and the one the list opens on (null: Tutti). */
export type ShoppingDepartments = { list: DepartmentInfo[]; initial: Department | null };

/**
 * The whole order list, from the home screen.
 *
 * It used to be a page in the menu, which is two taps away from the counter
 * where you notice something has run out — and the list is only ever used at
 * the counter. Adding, ticking off and clearing all happen here now.
 */
export function ShoppingListQuickAdd({
  pendingCount,
  items,
  departments,
}: {
  pendingCount: number;
  items: ShoppingListEntry[];
  departments?: ShoppingDepartments | null;
}) {
  return (
    <PopupAction
      title="Lista ordini"
      ariaLabel={
        pendingCount > 0 ? `Lista ordini, ${pendingCount} articoli` : "Lista ordini, vuota"
      }
      className="workbit-cart-trigger"
      triggerContent={
        <>
          <span aria-hidden="true">🛒</span>
          {pendingCount > 0 ? <em>{pendingCount}</em> : null}
        </>
      }
    >
      <ShoppingListPanel items={items} departments={departments ?? null} />
    </PopupAction>
  );
}

const chipStyle = (on: boolean, ink?: string, soft?: string) => ({
  flex: "0 0 auto",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 32,
  padding: "0 12px",
  borderRadius: 999,
  border: "none",
  fontSize: 12.5,
  fontWeight: 800,
  cursor: "pointer",
  background: on ? ink ?? "#17161f" : soft ?? "#ffffff",
  color: on ? "#ffffff" : ink ?? "#4c4670",
  boxShadow: on ? "none" : "0 0 0 1px #ebe6f7",
});

function ShoppingListPanel({
  items,
  departments,
}: {
  items: ShoppingListEntry[];
  departments: ShoppingDepartments | null;
}) {
  const addFormRef = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  // Pro: which department is in view, as on the calendar; "Tutti" is null.
  const [view, setView] = useState<Department | null>(departments?.initial ?? null);
  // On "Tutti" an item asks which department it is for; none means the whole venue.
  const [addTo, setAddTo] = useState<Department | null>(departments?.initial ?? null);
  const shown = departments && view ? items.filter((item) => item.department?.id === view) : items;
  const groups = departments && !view
    ? [
        ...departments.list.map((department) => ({
          key: department.id,
          department,
          items: items.filter((item) => item.department?.id === department.id),
        })),
        { key: "ALL", department: null, items: items.filter((item) => !item.department) },
      ].filter((group) => group.items.length > 0)
    : [{ key: "ONE", department: null, items: shown }];
  const target = departments ? view ?? addTo : null;

  const renderItem = (item: ShoppingListEntry) => (
    <label key={item.id} className="workbit-cart-item">
      <input
        type="checkbox"
        name="itemIds"
        value={item.id}
        checked={selected.includes(item.id)}
        onChange={(event) =>
          setSelected((current) =>
            event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id)
          )
        }
      />
      <span>
        <b>
          {item.name}
          {item.quantity ? <i> · {item.quantity}</i> : null}
        </b>
        <small>da {item.createdByName}</small>
      </span>
    </label>
  );

  return (
    <div className="workbit-cart-panel">
      {departments ? (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
          <button type="button" aria-pressed={view === null} onClick={() => setView(null)} style={chipStyle(view === null)}>
            Tutti {items.length ? <b>{items.length}</b> : null}
          </button>
          {departments.list.map((department) => {
            const count = items.filter((item) => item.department?.id === department.id).length;
            const on = view === department.id;
            return (
              <button
                key={department.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setView(department.id);
                  setSelected([]);
                }}
                style={chipStyle(on, department.ink, department.soft)}
              >
                <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: on ? "#ffffff" : department.ink }} />
                {department.name}
                {count ? <b>{count}</b> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Adding comes first: it is why the list gets opened. */}
      <form
        ref={addFormRef}
        action={async (formData) => {
          await createShoppingListItemAction(formData);
          addFormRef.current?.reset();
          addFormRef.current?.querySelector("input")?.focus();
        }}
        className="workbit-cart-add"
      >
        <input
          id="workbit-cart-name"
          name="name"
          placeholder="Cosa manca"
          autoComplete="off"
          required
          maxLength={120}
        />
        <input
          id="workbit-cart-quantity"
          name="quantity"
          placeholder="Quanto"
          autoComplete="off"
          maxLength={40}
        />
        {target ? <input type="hidden" name="department" value={target} /> : null}
        <button type="submit" aria-label="Aggiungi alla lista">
          +
        </button>
      </form>

      {departments && !view ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#8a84a8" }}>Per</span>
          {departments.list.map((department) => (
            <button
              key={department.id}
              type="button"
              aria-pressed={addTo === department.id}
              onClick={() => setAddTo(addTo === department.id ? null : department.id)}
              style={{ ...chipStyle(addTo === department.id, department.ink, department.soft), height: 28 }}
            >
              {department.name}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={addTo === null}
            onClick={() => setAddTo(null)}
            style={{ ...chipStyle(addTo === null), height: 28 }}
          >
            Tutto il locale
          </button>
        </div>
      ) : null}

      {shown.length === 0 ? (
        <p className="workbit-cart-empty">La lista è vuota.</p>
      ) : (
        <form
          action={async (formData) => {
            await markShoppingListItemsOrderedAction(formData);
            setSelected([]);
          }}
          className="workbit-cart-list"
        >
          {groups.map((group) => (
            <div key={group.key} style={{ display: "grid", gap: 6 }}>
              {departments && !view ? (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: group.department?.ink ?? "#8a84a8",
                    marginTop: 4,
                  }}
                >
                  {group.department ? <DepartmentDot department={group.department} size={18} /> : null}
                  {group.department?.name ?? "Tutto il locale"} · {group.items.length}
                </span>
              ) : null}
              {group.items.map(renderItem)}
            </div>
          ))}

          <button type="submit" disabled={selected.length === 0}>
            {selected.length === 0
              ? "Seleziona cosa hai ordinato"
              : `Segna ${selected.length} come ${selected.length === 1 ? "ordinato" : "ordinati"}`}
          </button>
        </form>
      )}
    </div>
  );
}
