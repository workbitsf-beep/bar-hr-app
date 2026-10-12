"use client";

import { useRouter } from "next/navigation";
import { createContext, useTransition, type ComponentProps } from "react";
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
  onSubmit,
  ...props
}: Omit<ComponentProps<"form">, "action"> & {
  action: (formData: FormData) => Promise<unknown>;
  /** Left out when the action itself moves on with a ?success= code. */
  success?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

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
            } catch (error) {
              // A redirect or notFound from the action is a page change the
              // router is already making, not a failure to report.
              const digest = (error as { digest?: unknown } | null)?.digest;
              if (typeof digest === "string" && digest.startsWith("NEXT_")) return;
              showAppToast(describeActionError(error), "error");
            }
          });
        }}
      />
    </ActionFormPending.Provider>
  );
}
