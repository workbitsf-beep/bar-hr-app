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
          setFeedback(result?.message || "Impossibile confermare i turni.");
          return;
        }

        setFeedback(
          result.message ||
            (result.sentCount === 1
              ? "1 notifica inviata."
              : `${result.sentCount ?? 0} notifiche inviate.`)
        );
        router.refresh();
      } catch {
        setFeedback("Impossibile confermare i turni.");
      }
    });
  }

  return (
    <div className="calendar-publish-panel" style={{ display: "grid", gap: 6, alignContent: "start" }}>
      <div
        className="calendar-publish-actions"
        style={{
          display: "flex",
          gap: 7,
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
            minHeight: 36,
            borderRadius: 999,
            paddingInline: 12,
            fontSize: 13,
            boxShadow: "0 8px 18px rgba(88, 28, 135, 0.08)",
            whiteSpace: "nowrap",
          }}
        >
          {isPending ? "Confermo..." : "Conferma turni"}
        </PrimaryButton>

        <span
          className="calendar-publish-status"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 28,
            padding: "0 10px",
            borderRadius: 999,
            background: pendingCount === 0 ? "#ecfdf5" : "#fff7ed",
            color: pendingCount === 0 ? "#166534" : "#9a3412",
            border: pendingCount === 0 ? "1px solid #bbf7d0" : "1px solid #fed7aa",
            fontSize: 12,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          {pendingCount === 0 ? "✓ Confermati" : `${pendingCount} da confermare`}
        </span>
      </div>

      {feedback ? <SuccessCallout style={{ fontSize: 13 }}>{feedback}</SuccessCallout> : null}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 520px) {
              .calendar-publish-panel .calendar-publish-actions {
                gap: 5px !important;
              }
              .calendar-publish-panel .calendar-publish-status {
                display: none !important;
              }
            }
          `,
        }}
      />
    </div>
  );
}
