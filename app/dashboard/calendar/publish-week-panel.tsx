"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmationToast } from "@/app/components/confirmation-toast";
import { IconButton } from "../ui";

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
      <IconButton
        type="button"
        onClick={handlePublish}
        disabled={isPending}
        aria-label="Conferma turni"
        title="Conferma turni"
        style={{
          width: variant === "wide" ? "100%" : 38,
          minWidth: variant === "wide" ? "100%" : 38,
          height: variant === "wide" ? 62 : 38,
          background: hasPendingShifts ? "#f5f3ff" : "#ffffff",
          color: hasPendingShifts ? "#6d28d9" : "#7c3aed",
          border: "1px solid rgba(124, 58, 237, 0.16)",
          boxShadow: variant === "wide" ? "0 16px 34px rgba(88, 28, 135, 0.10)" : "none",
          opacity: isPending ? 0.7 : 1,
          fontSize: variant === "wide" ? 32 : 16,
          fontWeight: 900,
          borderRadius: 999,
          marginInline: 0,
        }}
      >
        {isPending ? "..." : "✓"}
      </IconButton>

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
