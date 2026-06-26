"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconButton } from "../ui";

export function PublishWeekPanel({
  rangeStart,
  rangeEnd,
  pendingCount,
}: {
  rangeStart: string;
  rangeEnd: string;
  pendingCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const canPublish = pendingCount > 0;

  function handlePublish() {
    if (!canPublish) {
      return;
    }

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
          | { ok?: boolean; message?: string }
          | null;

        if (!response.ok || !result?.ok) {
          setFeedback(result?.message || "Impossibile confermare i turni.");
          return;
        }

        setFeedback("Turni confermati.");
        router.refresh();
      } catch {
        setFeedback("Impossibile confermare i turni.");
      }
    });
  }

  return (
    <div
      className="calendar-publish-actions"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 8,
        minWidth: 0,
        width: "auto",
        overflow: "visible",
        maxWidth: "100%",
      }}
    >
      <IconButton
        type="button"
        onClick={handlePublish}
        disabled={isPending || !canPublish}
        aria-label="Conferma turni"
        title="Conferma turni"
        style={{
          width: 38,
          height: 38,
          background: canPublish ? "#dcfce7" : "#f1f5f9",
          color: canPublish ? "#166534" : "#94a3b8",
          border: canPublish ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
          boxShadow: canPublish ? "0 8px 18px rgba(22, 163, 74, 0.12)" : "none",
          opacity: canPublish ? 1 : 0.42,
          fontSize: 16,
          fontWeight: 900,
        }}
      >
        {isPending ? "..." : "✓"}
      </IconButton>
      {feedback ? (
        <span
          aria-live="polite"
          style={{
            color: feedback.includes("confermati") ? "#166534" : "#9a3412",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {feedback.includes("confermati") ? "✓" : "!"}
        </span>
      ) : null}
    </div>
  );
}
