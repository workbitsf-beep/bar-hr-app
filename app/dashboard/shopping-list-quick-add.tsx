"use client";

import { useRef, useState } from "react";
import { createShoppingListItemAction } from "./actions";

/**
 * Adds something to the order list from the home screen.
 *
 * The list already has a page of its own, but you notice a carton is finished
 * while you are behind the counter, not while you are in a menu — and anything
 * that needs navigating to does not get written down. Two fields, closed until
 * asked for, so the home screen stays quiet.
 */
export function ShoppingListQuickAdd({ pendingCount }: { pendingCount: number }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button
        type="button"
        className="workbit-cart-trigger"
        onClick={() => setOpen(true)}
        aria-expanded="false"
      >
        <span aria-hidden="true">🛒</span>
        Aggiungi alla lista ordini
        {pendingCount > 0 ? <em>{pendingCount}</em> : null}
      </button>
    );
  }

  return (
    <div className="workbit-cart-card">
      <div className="workbit-cart-head">
        <strong>
          <span aria-hidden="true">🛒</span> Lista ordini
        </strong>
        <button type="button" onClick={() => setOpen(false)} aria-label="Chiudi">
          ✕
        </button>
      </div>

      <form
        ref={formRef}
        action={async (formData) => {
          await createShoppingListItemAction(formData);
          formRef.current?.reset();
        }}
        className="workbit-cart-form"
      >
        <div className="workbit-cart-fields">
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
        </div>
        <button type="submit">Aggiungi</button>
      </form>
    </div>
  );
}
