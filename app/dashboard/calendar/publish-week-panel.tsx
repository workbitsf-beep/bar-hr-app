"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "../ui";

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
    <>
      <div
        className="calendar-publish-actions"
        style={{
          display: "grid",
          justifyItems: "end",
          gap: 6,
          justifyContent: "flex-end",
          minWidth: 0,
          width: "auto",
          overflow: "visible",
          maxWidth: "100%",
        }}
      >
        <PrimaryButton
          type="button"
          onClick={handlePublish}
          disabled={isPending || !canPublish}
          tone="dark"
          style={{
            minHeight: 34,
            borderRadius: 999,
            padding: "7px 13px",
            fontSize: 12,
            boxShadow: canPublish ? "0 8px 18px rgba(15, 23, 42, 0.12)" : "none",
            whiteSpace: "nowrap",
            opacity: canPublish ? 1 : 0.42,
            width: "auto",
            minWidth: "max-content",
            maxWidth: "100%",
            overflow: "visible",
          }}
        >
          {isPending ? "Confermo..." : "Conferma turni"}
        </PrimaryButton>
        {feedback ? (
          <span style={{ color: feedback.includes("confermati") ? "#166534" : "#9a3412", fontSize: 12, fontWeight: 800 }}>
            {feedback.includes("confermati") ? "✓ " : ""}{feedback}
          </span>
        ) : null}
      </div>
    </>
  );
}
