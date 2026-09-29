"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getNoteKind, type NoteKind } from "../note-kinds";
import {
  NoteKindBadge,
  NoteKindFields,
  NoteKindPicker,
  appendNoteDraft,
  createNoteDraft,
  describeNoteDraft,
  type NoteDraft,
  type NoteMember,
} from "../note-composer";
import { toDateInputValueInTimeZone } from "@/lib/time-zone";
import { IconButton, PrimaryButton } from "../ui";

function toDateInputValue(dateIso: string | null) {
  return dateIso ? toDateInputValueInTimeZone(dateIso) : "";
}

function describeDay(dateIso: string | null) {
  if (!dateIso) {
    return "";
  }

  return new Date(dateIso).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * The day popup writes a note exactly the way the Note page does - same four
 * kinds, same questions - with one difference it has earned: the day was
 * already tapped, so it is stated rather than asked for again.
 */
export function QuickCalendarEntryModal({
  open,
  mode,
  dateIso,
  members,
  canChooseAudience = true,
  canCreateTask = true,
  isPending,
  onClose,
  onSubmitTask,
}: {
  open: boolean;
  mode: "task" | "board" | null;
  dateIso: string | null;
  members: NoteMember[];
  canPinBoard?: boolean;
  canChooseAudience?: boolean;
  canCreateTask?: boolean;
  canCreateBoard?: boolean;
  isPending: boolean;
  onClose: () => void;
  onSubmitTask: (formData: FormData) => void;
  onSubmitBoard?: (formData: FormData) => void;
}) {
  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft(null);
    setDueDate(toDateInputValue(dateIso));
  }, [dateIso, open, mode]);

  if (!open || !mode || !canCreateTask) {
    return null;
  }

  const kind = draft ? getNoteKind(draft.kindId) : null;

  function chooseKind(nextKind: NoteKind) {
    setDraft(createNoteDraft(nextKind));
  }

  function submitNote() {
    if (!draft?.value.trim() || !dueDate || isPending) {
      return;
    }

    const formData = new FormData();
    appendNoteDraft(formData, draft);
    formData.set("description", "");
    formData.set("dueDate", dueDate);

    onSubmitTask(formData);
    setDraft(null);
  }

  return createPortal(
    <div
      className="dashboard-modal-wrap"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "rgba(15, 23, 42, 0.28)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <section
        className="dashboard-modal-panel"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 520,
          maxHeight: "calc(100dvh - 32px)",
          overflowY: "auto",
          background: "rgba(255,255,255,0.98)",
          border: "1px solid rgba(226,232,240,0.9)",
          borderRadius: 28,
          padding: 22,
          boxShadow: "0 20px 48px rgba(15, 23, 42, 0.16)",
        }}
      >
        <IconButton
          type="button"
          onClick={onClose}
          aria-label="Chiudi popup rapido"
          disabled={isPending}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 40,
            height: 40,
            color: "#475569",
            background: "#ffffff",
            zIndex: 2,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6 6 18"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </IconButton>

        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gap: 2, paddingRight: 52 }}>
            <strong style={{ fontSize: 20, color: "#0f172a" }}>Nuova nota</strong>
            <span style={{ color: "#64748b", fontSize: 13, fontWeight: 700 }}>
              {describeDay(dateIso)}
            </span>
          </div>

          {!draft || !kind ? (
            <NoteKindPicker heading="Che nota è?" onPick={chooseKind} />
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              <NoteKindBadge kind={kind} onBack={() => setDraft(null)} />

              <NoteKindFields
                draft={draft}
                members={members}
                canChooseAudience={canChooseAudience}
                dueDate={dueDate}
                onDueDateChange={setDueDate}
                showDate={false}
                onChange={setDraft}
              />

              <span style={{ color: "#64748b", fontSize: 12.5, fontWeight: 650 }}>
                {describeNoteDraft(draft, members, canChooseAudience)}
              </span>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <PrimaryButton
                  type="button"
                  onClick={submitNote}
                  disabled={isPending || !draft.value.trim() || !dueDate}
                >
                  {kind.saveLabel}
                </PrimaryButton>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}
