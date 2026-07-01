"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconButton } from "../ui";

type PublishFeedback = {
  tone: "success" | "danger";
  message: string;
} | null;

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
        disabled={isPending}
        aria-label="Conferma turni"
        title="Conferma turni"
        style={{
          width: 38,
          height: 38,
          background: hasPendingShifts ? "#dcfce7" : "#f8fafc",
          color: hasPendingShifts ? "#166534" : "#475569",
          border: hasPendingShifts ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
          boxShadow: hasPendingShifts ? "0 8px 18px rgba(22, 163, 74, 0.12)" : "none",
          opacity: isPending ? 0.7 : 1,
          fontSize: 16,
          fontWeight: 900,
        }}
      >
        {isPending ? "..." : "✓"}
      </IconButton>

      {feedback ? (
        <div
          aria-live="polite"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "grid",
            placeItems: "center",
            padding: 24,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: "min(86vw, 320px)",
              borderRadius: 28,
              border: "1px solid rgba(168, 85, 247, 0.18)",
              background: "rgba(255, 255, 255, 0.94)",
              boxShadow: "0 28px 70px rgba(36, 20, 77, 0.22)",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              padding: "26px 22px",
              textAlign: "center",
              animation: "workbit-confirm-pop 170ms ease-out",
            }}
          >
            <svg
              aria-hidden="true"
              width="82"
              height="82"
              viewBox="0 0 60 60"
              style={{ display: "block", margin: "0 auto 14px" }}
            >
              <circle
                cx="30"
                cy="30"
                r="28"
                fill={feedback.tone === "success" ? "#dcfce7" : "#fee2e2"}
                stroke={feedback.tone === "success" ? "#86efac" : "#fecaca"}
                strokeWidth="2"
              />
              <path
                className="workbit-confirm-check"
                d={
                  feedback.tone === "success"
                    ? "M18 30.5l7.2 7.2L42 22"
                    : "M22 22l16 16M38 22L22 38"
                }
                fill="none"
                stroke={feedback.tone === "success" ? "#16a34a" : "#dc2626"}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="4.5"
              />
            </svg>
            <strong
              style={{
                display: "block",
                color: "#111827",
                fontSize: 19,
                lineHeight: 1.2,
                fontWeight: 900,
              }}
            >
              {feedback.message}
            </strong>
          </div>
          <style jsx>{`
            @keyframes workbit-confirm-pop {
              from {
                opacity: 0;
                transform: translateY(10px) scale(0.96);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }

            .workbit-confirm-check {
              stroke-dasharray: 44;
              stroke-dashoffset: 44;
              animation: workbit-draw-check 520ms ease forwards 100ms;
            }

            @keyframes workbit-draw-check {
              to {
                stroke-dashoffset: 0;
              }
            }
          `}</style>
        </div>
      ) : null}
    </div>
  );
}
