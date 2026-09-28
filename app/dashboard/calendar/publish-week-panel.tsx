"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmationToast } from "@/app/components/confirmation-toast";

type PublishFeedback = {
  tone: "success" | "danger";
  message: string;
} | null;

export function PublishWeekPanel({
  rangeStart,
  rangeEnd,
  pendingCount,
  variant = "icon",
}: {
  rangeStart: string;
  rangeEnd: string;
  pendingCount: number;
  variant?: "icon" | "wide";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<PublishFeedback>(null);
  const hasPendingShifts = pendingCount > 0;

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeout = window.setTimeout(
      () => setFeedback(null),
      feedback.tone === "success" ? 1700 : 2600
    );
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  function handlePublish() {
    setFeedback(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/shifts/publish-week", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rangeStart,
            rangeEnd,
          }),
        });

        const result = (await response.json().catch(() => null)) as
          | { ok?: boolean; message?: string; confirmedCount?: number }
          | null;

        if (!response.ok || !result?.ok) {
          setFeedback({
            tone: "danger",
            message: result?.message || "Impossibile confermare i turni.",
          });
          return;
        }

        setFeedback({
          tone: "success",
          message:
            result.confirmedCount && result.confirmedCount > 0
              ? "Turni inviati"
              : "Nessun turno da inviare",
        });
        router.refresh();
      } catch {
        setFeedback({
          tone: "danger",
          message: "Impossibile confermare i turni.",
        });
      }
    });
  }

  return (
    <div
      className="calendar-publish-actions"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: variant === "wide" ? "center" : "flex-end",
        gap: 8,
        minWidth: 0,
        width: variant === "wide" ? "100%" : "auto",
        overflow: "visible",
        maxWidth: "100%",
        paddingInline: 0,
      }}
    >
      {/* It says what it does. A tick in a circle is the most important
          action on this page and nobody could guess it published the week. */}
      <button
        type="button"
        onClick={handlePublish}
        disabled={isPending}
        aria-label="Pubblica la settimana"
        title="Pubblica la settimana"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          width: variant === "wide" ? "100%" : "auto",
          height: variant === "wide" ? 62 : 38,
          padding: variant === "wide" ? "0 20px" : "0 13px",
          background: hasPendingShifts
            ? "linear-gradient(135deg, #30217f 0%, #5e5ce6 58%, #8b5cf6 100%)"
            : "#ffffff",
          color: hasPendingShifts ? "#ffffff" : "#6d28d9",
          border: hasPendingShifts ? "0" : "1px solid rgba(124, 58, 237, 0.24)",
          boxShadow: hasPendingShifts ? "0 8px 18px rgba(94, 92, 230, 0.24)" : "none",
          opacity: isPending ? 0.7 : 1,
          fontSize: variant === "wide" ? 17 : 12.5,
          fontWeight: 850,
          borderRadius: 999,
          whiteSpace: "nowrap",
          cursor: isPending ? "default" : "pointer",
        }}
      >
        {isPending
          ? "Pubblico…"
          : hasPendingShifts
            ? `Pubblica ${pendingCount}`
            : "Pubblicata"}
      </button>

      {feedback ? (
        <ConfirmationToast
          key={`${feedback.tone}-${feedback.message}`}
          duration={feedback.tone === "success" ? 1700 : 2600}
          tone={feedback.tone}
        >
          {feedback.message}
        </ConfirmationToast>
      ) : null}
    </div>
  );
}
