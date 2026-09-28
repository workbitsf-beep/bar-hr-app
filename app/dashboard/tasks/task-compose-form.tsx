"use client";

import { useState } from "react";
import { getNoteKind, todayDateInputValue, type NoteKind } from "../note-kinds";
import {
  NoteDraftFields,
  NoteKindBadge,
  NoteKindFields,
  NoteKindPicker,
  createNoteDraft,
  describeNoteDraft,
  type NoteDraft,
  type NoteMember,
} from "../note-composer";
import { IconButton, PrimaryButton } from "../ui";

export function TaskComposeForm({
  action,
  members,
  canChooseAudience = true,
  notifySuccess = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  members: NoteMember[];
  canChooseAudience?: boolean;
  notifySuccess?: boolean;
}) {
  const [entries, setEntries] = useState<NoteDraft[]>([]);
  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const [dueDate, setDueDate] = useState("");

  const kind = draft ? getNoteKind(draft.kindId) : null;
  const allEntries = entries.concat(draft && draft.value.trim() ? [draft] : []);
  // One date for everything saved in one go, as it has always been. A kind
  // that means "now" fills it in when it is picked rather than overriding it
  // here, which would quietly move a note already queued for next month.
  const canSave = allEntries.length > 0 && Boolean(dueDate);

  function chooseKind(nextKind: NoteKind) {
    setDraft(createNoteDraft(nextKind));

    if (nextKind.dueToday) {
      setDueDate(todayDateInputValue());
    }
  }

  function queueDraft() {
    if (!draft?.value.trim()) {
      return;
    }

    setEntries((current) => current.concat(draft));
    setDraft(null);
  }

  function removeEntry(id: string) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }

  function editEntry(id: string) {
    const entry = entries.find((item) => item.id === id);

    if (!entry) {
      return;
    }

    setDraft(entry);
    removeEntry(id);
  }

  return (
    <form action={action} style={{ display: "grid", gap: 16 }}>
      {notifySuccess ? <input type="hidden" name="notifySuccess" value="1" /> : null}
      <input type="hidden" name="dueDate" value={dueDate} />

      {entries.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          {entries.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 16,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                onClick={() => editEntry(entry.id)}
                style={{
                  flex: "1 1 auto",
                  border: 0,
                  background: "transparent",
                  padding: 0,
                  textAlign: "left",
                  display: "grid",
                  gap: 3,
                  color: "#0f172a",
                  cursor: "pointer",
                }}
              >
                <strong style={{ fontSize: 13 }}>
                  {getNoteKind(entry.kindId).emoji} {entry.value}
                </strong>
                <span style={{ color: "#64748b", fontSize: 12 }}>
                  {describeNoteDraft(entry, members, canChooseAudience)}
                </span>
              </button>
              <IconButton
                type="button"
                onClick={() => removeEntry(entry.id)}
                aria-label="Elimina nota"
              >
                ×
              </IconButton>
            </div>
          ))}
        </div>
      ) : null}

      {!draft || !kind ? (
        <NoteKindPicker
          heading={entries.length > 0 ? "Aggiungine un'altra" : "Che nota è?"}
          onPick={chooseKind}
        />
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <NoteKindBadge kind={kind} onBack={() => setDraft(null)} />

          <NoteKindFields
            draft={draft}
            members={members}
            canChooseAudience={canChooseAudience}
            dueDate={dueDate}
            onDueDateChange={setDueDate}
            onChange={setDraft}
          />

          <span style={{ color: "#64748b", fontSize: 12.5, fontWeight: 650 }}>
            {describeNoteDraft(draft, members, canChooseAudience)}
            {kind.dueToday ? " · oggi" : ""}
          </span>
        </div>
      )}

      {allEntries.map((entry) => (
        <NoteDraftFields key={entry.id} draft={entry} />
      ))}

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={queueDraft}
          disabled={!draft?.value.trim()}
          style={{
            padding: "10px 14px",
            borderRadius: 14,
            border: "1px dashed #cbd5e1",
            background: "transparent",
            color: draft?.value.trim() ? "#4c1d95" : "#94a3b8",
            fontSize: 13,
            fontWeight: 800,
            cursor: draft?.value.trim() ? "pointer" : "default",
          }}
        >
          + Aggiungi un&apos;altra
        </button>

        <PrimaryButton type="submit" disabled={!canSave}>
          {kind?.saveLabel ?? "Salva note"}
        </PrimaryButton>
      </div>
    </form>
  );
}
