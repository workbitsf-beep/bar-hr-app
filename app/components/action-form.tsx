"use client";

import { useRouter } from "next/navigation";
import { createContext, useRef, useTransition, type ComponentProps } from "react";
import { describeActionError, isActionFailure } from "@/lib/rule-error";
import { showAppToast } from "./app-toast";

/**
 * A <form> bound to a server action that says what happened. A bare
 * <form action={deleteCourseAction}> did its work and the page simply
 * changed, or did not, with no word either way; this one shows the toast
 * with `success`, or the reason it was refused. An action that moves to
 * another page says its own "done" there, through the address.
 *
 * It submits by itself rather than through React's form action, because
 * React empties a form after its action even when the save was refused, and
 * the person would lose what they wrote. The buttons inside still know the
 * form is busy, through ActionFormPending.
 */

export const ActionFormPending = createContext(false);

export function ActionForm({
  action,
  success,
  keepOpen = false,
  onSubmit,
  children,
  ...props
}: Omit<ComponentProps<"form">, "action"> & {
  action: (formData: FormData) => Promise<unknown>;
  /** Left out when the action itself moves on with a ?success= code. */
  success?: string;
  /** Inside a popup, stay open after saving (for adding several in a row). */
  keepOpen?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const closer = useRef<HTMLButtonElement>(null);
  // Done: a popup around the form closes, as a finished form should. Only
  // inside one: elsewhere the click would bubble to a row that opens on tap.
  const finish = () => {
    if (keepOpen) return;
    window.setTimeout(() => {
      if (closer.current?.closest('[role="dialog"]')) closer.current.click();
    }, 250);
  };

  return (
    <ActionFormPending.Provider value={pending}>
      <form
        {...props}
        aria-busy={pending || undefined}
        onSubmit={(event) => {
          onSubmit?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          if (pending) return;

          const form = event.currentTarget;
          const submitter = (event.nativeEvent as SubmitEvent).submitter;
          let formData: FormData;
          try {
            // Keeps the pressed button's name and value, as a native submit does.
            formData = new FormData(form, submitter);
          } catch {
            formData = new FormData(form);
            if (submitter instanceof HTMLButtonElement && submitter.name) formData.append(submitter.name, submitter.value);
          }

          start(async () => {
            try {
              const result = await action(formData);
              if (isActionFailure(result)) {
                showAppToast(result.ruleError, "error");
                return;
              }
              if (success) {
                showAppToast(success);
                form.reset();
                router.refresh();
              }
              finish();
            } catch (error) {
              // A redirect or notFound from the action is a page change the
              // router is already making, not a failure to report.
              const digest = (error as { digest?: unknown } | null)?.digest;
              if (typeof digest === "string" && digest.startsWith("NEXT_")) {
                finish();
                return;
              }
              showAppToast(describeActionError(error), "error");
            }
          });
        }}
      >
        {children}
        <button ref={closer} type="button" data-popup-close hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </ActionFormPending.Provider>
  );
}
