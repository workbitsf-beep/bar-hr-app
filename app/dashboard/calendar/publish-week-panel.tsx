"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "../ui";

type WeekOption = {
  start: string;
  label: string;
  pendingCount: number;
};

const fieldStyle = {
  borderRadius: 16,
  border: "1px solid #dbe3ee",
  padding: "12px 14px",
  fontSize: 15,
  background: "#ffffff",
  width: "100%",
  color: "#0f172a",
  boxSizing: "border-box" as const,
};

export function PublishWeekPanel({
  weeks,
  defaultWeekStart,
}: {
  weeks: WeekOption[];
  defaultWeekStart: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedWeekStart, setSelectedWeekStart] = useState(defaultWeekStart);
  const [feedback, setFeedback] = useState<string | null>(null);

  const selectedWeek = useMemo(
    () => weeks.find((week) => week.start === selectedWeekStart) ?? weeks[0] ?? null,
    [selectedWeekStart, weeks]
  );

  function handlePublish() {
    if (!selectedWeek) {
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
            weekStart: selectedWeek.start,
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
      <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
        Conferma ufficialmente i turni della settimana scelta e invia una sola email riepilogativa per ogni persona coinvolta.
      </p>

      <label style={{ display: "grid", gap: 8 }}>
        <span style={{ fontWeight: 600, color: "#1e293b" }}>Settimana</span>
        <select
          value={selectedWeekStart}
          onChange={(event) => setSelectedWeekStart(event.target.value)}
          style={fieldStyle}
        >
          {weeks.map((week) => (
            <option key={week.start} value={week.start}>
              {week.label} - {week.pendingCount} da confermare
            </option>
          ))}
        </select>
      </label>

      <div
        className="dashboard-publish-row"
        style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}
      >
        <PrimaryButton
          type="button"
          onClick={handlePublish}
          disabled={isPending || !selectedWeek || selectedWeek.pendingCount === 0}
        >
          {isPending ? "Invio in corso..." : "Conferma e invia turni"}
        </PrimaryButton>

        <span style={{ color: "#64748b", fontSize: 14 }}>
          {selectedWeek
            ? selectedWeek.pendingCount === 0
              ? "Nessun nuovo turno da pubblicare."
              : `${selectedWeek.pendingCount} turni nuovi o aggiornati`
            : "Nessuna settimana disponibile."}
        </span>
      </div>

      {feedback ? <div style={{ color: "#334155", fontSize: 14 }}>{feedback}</div> : null}
    </div>
  );
}
