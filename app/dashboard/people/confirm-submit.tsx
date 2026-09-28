"use client";

import type { ReactNode } from "react";

/**
 * Asks before doing something that cannot be taken back.
 *
 * "Rimuovi dal locale" was a red button on every card, submitting on the first
 * touch. Everywhere else in the app deleting means swiping sideways on
 * purpose; here the most costly mistake was the easiest one to make.
 */
export function ConfirmSubmit({
  action,
  question,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  question: string;
  children: ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(question)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}
