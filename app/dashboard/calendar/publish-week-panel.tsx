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
    <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
      <div
        className="dashboard-publish-row"
        style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}
      >
        {before}

        <PrimaryButton
          type="button"
          onClick={handlePublish}
          disabled={isPending || pendingCount === 0}
        >
          {isPending ? "Invio in corso..." : "Conferma turni"}
        </PrimaryButton>

        <span style={{ color: "#64748b", fontSize: 14 }}>
          {pendingCount === 0
            ? "Nessun nuovo turno da confermare."
            : `${pendingCount} turni nuovi o aggiornati`}
        </span>
      </div>

      {feedback ? <SuccessCallout style={{ fontSize: 14 }}>{feedback}</SuccessCallout> : null}
    </div>
  );
}
