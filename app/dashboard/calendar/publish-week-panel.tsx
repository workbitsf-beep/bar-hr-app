"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton, SuccessCallout } from "../ui";

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
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          minWidth: 0,
          width: "auto",
          overflow: "visible",
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
            paddingInline: 9,
            fontSize: 10.5,
            boxShadow: canPublish ? "0 8px 18px rgba(15, 23, 42, 0.12)" : "none",
            whiteSpace: "nowrap",
            opacity: canPublish ? 1 : 0.42,
            width: "auto",
            minWidth: 92,
            maxWidth: "100%",
            overflow: "visible",
          }}
        >
          {isPending ? "..." : "Conferma"}
        </PrimaryButton>
      </div>

      {feedback ? <SuccessCallout style={{ gridColumn: "1 / -1", fontSize: 13 }}>{feedback}</SuccessCallout> : null}
    </>
  );
}
