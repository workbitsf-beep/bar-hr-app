"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { describeActionError, isActionFailure, type ActionFailure } from "@/lib/rule-error";

/**
 * Every console form saves the same way, and always says what happened.
 *
 * Before, a plan or a subscription was saved by a bare <form action>: the page
 * reloaded in place and nothing on screen changed, so nobody could tell a
 * save from a tap that went nowhere. Here the button itself carries the state
 * (Salvo… then a green Salvato), a line next to it says whether there are
 * changes still to save or when they were saved, a toast confirms it above
 * the bottom bar, and a refusal is written out in words under the button.
 */

export type ConsoleResult = { ok: true; message: string; redirectTo?: string } | ActionFailure;

type Phase = "idle" | "dirty" | "saving" | "saved" | "error";

function timeNow() {
  return new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

const TOAST_EVENT = "wbc-toast";

/** Shows a confirmation above the bottom bar, wherever the console is. */
export function showToast(text: string, tone: "ok" | "error" = "ok") {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { text, tone } }));
}

/**
 * Lives in the console shell, so a confirmation outlives the form that asked
 * for it: a removed row, or a new venue that opens its own page.
 */
export function ToastHost() {
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "error"; key: number } | null>(null);

  useEffect(() => {
    const show = (event: Event) => {
      const detail = (event as CustomEvent<{ text: string; tone: "ok" | "error" }>).detail;
      setToast({ ...detail, key: Date.now() });
    };
    window.addEventListener(TOAST_EVENT, show);
    return () => window.removeEventListener(TOAST_EVENT, show);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.tone === "error" ? 5200 : 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return (
    <div key={toast.key} className="wbc-toast" role="status" aria-live="polite" data-tone={toast.tone}>
      <b aria-hidden="true">{toast.tone === "ok" ? "✓" : "!"}</b>
      <span>{toast.text}</span>
    </div>
  );
}

export function ConsoleForm({
  action,
  label,
  pendingLabel = "Salvo…",
  confirm,
  resetOnSuccess = false,
  block = false,
  style,
  children,
}: {
  action: (formData: FormData) => Promise<ConsoleResult | void>;
  label: string;
  pendingLabel?: string;
  /** Asked before saving; returning a sentence shows it in a confirm dialog. */
  confirm?: (formData: FormData) => string | null;
  resetOnSuccess?: boolean;
  block?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [, startTransition] = useTransition();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState("");

  // Leaving the page with changes not saved asks first.
  useEffect(() => {
    if (phase !== "dirty") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase]);

  useEffect(() => {
    if (phase !== "saved") return;
    const timer = window.setTimeout(() => setPhase((current) => (current === "saved" ? "idle" : current)), 2600);
    return () => window.clearTimeout(timer);
  }, [phase]);

  function markDirty() {
    if (phase !== "saving") setPhase("dirty");
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const question = confirm?.(formData);
    if (question && !window.confirm(question)) return;

    setError("");
    setPhase("saving");
    startTransition(async () => {
      try {
        const result = await action(formData);
        if (isActionFailure(result)) {
          setError(result.ruleError);
          setPhase("error");
          return;
        }
        const message = result?.message ?? "Salvato.";
        setSavedAt(timeNow());
        showToast(message);
        setPhase("saved");
        if (resetOnSuccess) form.reset();
        if (result?.redirectTo) router.push(result.redirectTo);
        else router.refresh();
      } catch (caught) {
        setError(describeActionError(caught));
        setPhase("error");
      }
    });
  }

  const saving = phase === "saving";
  const saved = phase === "saved";

  return (
    <form ref={formRef} onSubmit={submit} onChange={markDirty} onInput={markDirty} style={{ display: "grid", gap: 16, ...style }}>
      {children}

      {error ? (
        <p className="wbc-save-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="wbc-savebar">
        <button
          type="submit"
          className={`wbc-btn ${saved ? "wbc-btn-saved" : "wbc-btn-primary"}${block ? " wbc-btn-block" : ""}`}
          disabled={saving}
          aria-busy={saving}
          style={saving ? { opacity: 0.8 } : undefined}
        >
          {saving ? <span className="wbc-spin" aria-hidden="true" /> : null}
          {saving ? pendingLabel : saved ? "✓ Salvato" : label}
        </button>
        {phase === "dirty" || phase === "error" ? (
          <span className="wbc-save-state" data-tone="dirty">
            Modifiche non salvate
          </span>
        ) : savedAt ? (
          <span className="wbc-save-state" data-tone="ok">
            Salvato alle {savedAt}
          </span>
        ) : null}
      </div>
    </form>
  );
}

/** A single button that does one thing, like removing a person, with the same feedback. */
export function ConsoleButton({
  action,
  fields,
  label,
  pendingLabel = "Un attimo…",
  confirm,
  className = "wbc-btn wbc-btn-danger wbc-btn-sm",
}: {
  action: (formData: FormData) => Promise<ConsoleResult | void>;
  fields: Record<string, string>;
  label: string;
  pendingLabel?: string;
  confirm?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    if (confirm && !window.confirm(confirm)) return;
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) formData.set(key, value);
    startTransition(async () => {
      try {
        const result = await action(formData);
        if (isActionFailure(result)) {
          showToast(result.ruleError, "error");
          return;
        }
        showToast(result?.message ?? "Fatto.");
        router.refresh();
      } catch (caught) {
        showToast(describeActionError(caught), "error");
      }
    });
  }

  return (
    <button type="button" className={className} onClick={run} disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}
