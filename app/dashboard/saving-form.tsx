"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { describeActionError, isActionFailure } from "@/lib/rule-error";

/**
 * A form in a popup that says it saved. Pressing Salva used to store the
 * change and leave the popup exactly as it was, with no word that anything
 * had happened. Now it shows "Salvato" and, a moment later, closes itself.
 */
export function SavingForm({
  action,
  children,
  style,
  message = "Salvato.",
  close = true,
}: {
  action: (formData: FormData) => unknown;
  children: ReactNode;
  style?: CSSProperties;
  message?: string;
  /** Close the popup after saving; off for forms meant for adding more. */
  close?: boolean;
}) {
  const router = useRouter();
  const closer = useRef<HTMLButtonElement>(null);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  return (
    <form
      style={style}
      aria-busy={pending}
      action={(formData) => {
        setStatus(null);
        start(async () => {
          try {
            const result = await action(formData);
            if (isActionFailure(result)) {
              setStatus({ tone: "error", text: result.ruleError });
              return;
            }
            setStatus({ tone: "ok", text: message });
            router.refresh();
            if (close) window.setTimeout(() => closer.current?.click(), 900);
          } catch (error) {
            setStatus({ tone: "error", text: describeActionError(error) });
          }
        });
      }}
    >
      {status ? (
        <div
          role="status"
          style={{
            padding: "10px 12px",
            borderRadius: 16,
            fontWeight: 800,
            ...(status.tone === "ok"
              ? { background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#166534" }
              : { background: "#fff1f2", border: "1px solid #fecdd3", color: "#b3202f" }),
          }}
        >
          {status.tone === "ok" ? "✓ " : ""}
          {status.text}
        </div>
      ) : null}
      {children}
      <button ref={closer} type="button" data-popup-close hidden aria-hidden="true" tabIndex={-1} />
    </form>
  );
}
