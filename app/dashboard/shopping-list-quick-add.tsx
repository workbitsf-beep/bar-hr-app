"use client";

import { useRef, useState } from "react";
import { createShoppingListItemAction, markShoppingListItemsOrderedAction } from "./actions";
import { PopupAction } from "./popup-action";

export type ShoppingListEntry = {
  id: string;
  name: string;
  quantity: string | null;
  createdByName: string;
};

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
}: {
  pendingCount: number;
  items: ShoppingListEntry[];
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
      <ShoppingListPanel items={items} />
    </PopupAction>
  );
}

function ShoppingListPanel({ items }: { items: ShoppingListEntry[] }) {
  const addFormRef = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <div className="workbit-cart-panel">
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
        <button type="submit" aria-label="Aggiungi alla lista">
          +
        </button>
      </form>

      {items.length === 0 ? (
        <p className="workbit-cart-empty">La lista è vuota.</p>
      ) : (
        <form
          action={async (formData) => {
            await markShoppingListItemsOrderedAction(formData);
            setSelected([]);
          }}
          className="workbit-cart-list"
        >
          {items.map((item) => (
            <label key={item.id} className="workbit-cart-item">
              <input
                type="checkbox"
                name="itemIds"
                value={item.id}
                checked={selected.includes(item.id)}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...current, item.id]
                      : current.filter((id) => id !== item.id)
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
