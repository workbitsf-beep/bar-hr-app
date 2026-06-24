"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton, SuccessCallout } from "../ui";

export function PublishWeekPanel({
  before,
  rangeStart,
  rangeEnd,
  pendingCount,
}: {
  before?: ReactNode;
  rangeStart: string;
  rangeEnd: string;
  pendingCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

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
          | { ok?: boolean; sentCount?: number; failedCount?: number; message?: string }
          | null;

        if (!response.ok || !result?.ok) {
          setFeedback(result?.message || "Impossibile inviare le email dei turni.");
          return;
        }

        if (result.message) {
          setFeedback(result.message);
        } else {
          setFeedback(
            result.sentCount === 1
              ? "1 email inviata."
              : `${result.sentCount ?? 0} email inviate.`
          );
        }

        router.refresh();
      } catch {
        setFeedback("Impossibile inviare le email dei turni.");
      }
    });
  }

  return (
    <div className="calendar-publish-panel" style={{ display: "grid", gap: 8, alignContent: "start" }}>
      <div
        className="calendar-publish-actions"
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          justifyContent: "flex-end",
          flexWrap: "wrap",
        }}
      >
        {before}

        <PrimaryButton
          type="button"
          onClick={handlePublish}
          disabled={isPending || pendingCount === 0}
          tone={pendingCount === 0 ? "sand" : "dark"}
          style={{
            minHeight: 44,
            borderRadius: 999,
            paddingInline: 16,
            boxShadow: "0 10px 24px rgba(88, 28, 135, 0.10)",
            whiteSpace: "nowrap",
          }}
        >
          {isPending ? "Invio in corso..." : "Conferma turni"}
        </PrimaryButton>

        <span style={{ color: "#64748b", fontSize: 13, fontWeight: 700 }}>
          {pendingCount === 0
            ? "✓ Tutto confermato"
            : `${pendingCount} da confermare`}
        </span>
      </div>

      {feedback ? <SuccessCallout style={{ fontSize: 14 }}>{feedback}</SuccessCallout> : null}
    </div>
  );
}
