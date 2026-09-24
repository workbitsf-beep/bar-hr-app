"use client";

import { useRef } from "react";
import { createShoppingListItemAction } from "./actions";
import { PopupAction } from "./popup-action";

/**
 * Adds something to the order list from the home screen.
 *
 * The list has a page of its own, but you notice a carton is finished while
 * you are behind the counter, not while you are in a menu — and anything that
 * needs navigating to does not get written down. A single round button beside
 * the heading, and the two fields in a popup.
 */
export function ShoppingListQuickAdd({ pendingCount }: { pendingCount: number }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <PopupAction
      title="Lista ordini"
      ariaLabel={
        pendingCount > 0
          ? `Aggiungi alla lista ordini, ${pendingCount} già in lista`
          : "Aggiungi alla lista ordini"
      }
      className="workbit-cart-trigger"
      closeOnSubmit
      triggerContent={
        <>
          <span aria-hidden="true">🛒</span>
          {pendingCount > 0 ? <em>{pendingCount}</em> : null}
        </>
      }
    >
      <form
        ref={formRef}
        action={async (formData) => {
          await createShoppingListItemAction(formData);
          formRef.current?.reset();
        }}
        className="workbit-cart-form"
      >
        <label htmlFor="workbit-cart-name">Cosa manca</label>
        <input
          id="workbit-cart-name"
          name="name"
          placeholder="Tovaglioli"
          autoComplete="off"
          required
          maxLength={120}
        />

        <label htmlFor="workbit-cart-quantity">Quanto</label>
        <input
          id="workbit-cart-quantity"
          name="quantity"
          placeholder="2 confezioni"
          autoComplete="off"
          maxLength={40}
        />

        <button type="submit">Aggiungi alla lista</button>
      </form>
    </PopupAction>
  );
}
