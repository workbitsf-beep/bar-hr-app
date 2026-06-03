"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "../ui";
import {
  ShiftPhotoImportButton,
  type ShiftPhotoImportRow,
} from "./shift-photo-import-button";

type MemberOption = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

export function PublishWeekPanel({
  before,
  rangeStart,
  rangeEnd,
  pendingCount,
  members,
}: {
  before?: ReactNode;
  rangeStart: string;
  rangeEnd: string;
  pendingCount: number;
  members: MemberOption[];
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

  async function handlePhotoImport(drafts: ShiftPhotoImportRow[]) {
    const payload = drafts
      .filter((draft) => Boolean(draft.employeeId))
      .map((draft) => ({
        employeeId: draft.employeeId,
        employeeName: draft.employeeName,
        date: draft.date,
        startTime: draft.startTime,
        endTime: draft.endTime,
        confidence: draft.confidence,
        notes: draft.notes,
      }));

    if (payload.length === 0) {
      return 0;
    }

    const response = await fetch("/api/shifts/import-confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        shifts: payload,
      }),
    });

    const result = (await response.json().catch(() => null)) as
      | {
          ok?: boolean;
          createdCount?: number;
          skippedCount?: number;
          message?: string;
        }
      | null;

    if (!response.ok || !result?.ok) {
      throw new Error(result?.message || "Impossibile importare i turni.");
    }

    router.refresh();
    return result.createdCount ?? payload.length;
  }

  return (
    <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
      <div
        className="dashboard-publish-row"
        style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}
      >
        {before}

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ShiftPhotoImportButton
            members={members}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            disabled={isPending}
            onImport={handlePhotoImport}
          />

          <PrimaryButton
            type="button"
            onClick={handlePublish}
            disabled={isPending || pendingCount === 0}
          >
            {isPending ? "Invio in corso..." : "Conferma turni"}
          </PrimaryButton>
        </div>

        <span style={{ color: "#64748b", fontSize: 14 }}>
          {pendingCount === 0
            ? "Nessun nuovo turno da confermare."
            : `${pendingCount} turni nuovi o aggiornati`}
        </span>
      </div>

      {feedback ? <div style={{ color: "#334155", fontSize: 14 }}>{feedback}</div> : null}
    </div>
  );
}
