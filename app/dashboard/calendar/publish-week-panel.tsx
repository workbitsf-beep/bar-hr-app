"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createShiftAction } from "../actions";
import { PrimaryButton } from "../ui";
import { ShiftPhotoImportButton } from "./shift-photo-import-button";
import { combineDateAndTime } from "@/lib/shift-datetime";

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

  async function handlePhotoImport(drafts: Array<{
    date: string;
    startTime: string;
    endTime: string;
    employeeId: string;
  }>) {
    if (drafts.length === 0) {
      return 0;
    }

    let importedCount = 0;

    for (const draft of drafts) {
      const formData = new FormData();
      formData.set("title", "");
      formData.set("startTime", combineDateAndTime(draft.date, draft.startTime));
      formData.set("endTime", combineDateAndTime(draft.date, draft.endTime));
      formData.append("employeeIds", draft.employeeId);

      await createShiftAction(formData);
      importedCount += 1;
    }

    router.refresh();
    return importedCount;
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
