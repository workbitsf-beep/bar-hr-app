"use client";

import { useState } from "react";
import { AudienceSelector } from "@/app/components/audience-selector";
import {
  NOTE_KINDS,
  getNoteKind,
  todayDateInputValue,
  type NoteKind,
  type NoteKindId,
} from "../note-kinds";
import {
  TaskRepeatField,
  describeTaskRepeatDraft,
  type TaskRepeatDraft,
} from "../task-repeat-field";
import { FormField, IconButton, PrimaryButton, TextArea, TextInput } from "../ui";

type MemberOption = {
  id: string;
  firstName: string;
  lastName: string;
};

type NoteEntry = {
  id: string;
  kindId: NoteKindId;
  value: string;
  assignedToAll: boolean;
  assignedToId: string;
  isUrgent: boolean;
  requiresConfirmation: boolean;
  repeat: TaskRepeatDraft;
};

function createEntry(kind: NoteKind): NoteEntry {
  return {
    id: crypto.randomUUID(),
    kindId: kind.id,
    value: "",
    assignedToAll: true,
    assignedToId: "",
    ...kind.defaults,
  };
}

function getSelectedIds(value: string) {
  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function TaskComposeForm({
  action,
  members,
  canChooseAudience = true,
  notifySuccess = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  members: MemberOption[];
  canChooseAudience?: boolean;
  notifySuccess?: boolean;
}) {
  const [entries, setEntries] = useState<NoteEntry[]>([]);
  const [draft, setDraft] = useState<NoteEntry | null>(null);
  const [dueDate, setDueDate] = useState("");

  const kind = draft ? getNoteKind(draft.kindId) : null;
  const allEntries = entries.concat(draft && draft.value.trim() ? [draft] : []);
  // One date for everything saved in one go, as it has always been. A kind
  // that means "today" fills it in when it is picked rather than overriding it
  // here, which would quietly move a note queued for next month.
  const canSave = allEntries.length > 0 && Boolean(dueDate);

  function chooseKind(nextKind: NoteKind) {
    setDraft(createEntry(nextKind));

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

  function getAudienceLabel(entry: NoteEntry) {
    if (entry.assignedToAll) {
      return "Tutto il team";
    }

    const labels = getSelectedIds(entry.assignedToId)
      .map((id) => members.find((member) => member.id === id))
      .filter(Boolean)
      .map((member) => `${member?.firstName} ${member?.lastName}`);

    if (labels.length === 0) {
      return "Persona non selezionata";
    }

    return labels.length === 1 ? labels[0] : `${labels.length} dipendenti`;
  }

  function describeEntry(entry: NoteEntry) {
    return [
      canChooseAudience ? getAudienceLabel(entry) : "Nota personale",
      entry.isUrgent ? "urgente" : null,
      describeTaskRepeatDraft(entry.repeat),
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function renderHiddenEntry(entry: NoteEntry) {
    return (
      <div key={entry.id} style={{ display: "none" }}>
        <input type="hidden" name="taskEntryId" value={entry.id} />
        <input type="hidden" name={`title_${entry.id}`} value={entry.value} />
        {entry.assignedToAll ? (
          <input type="hidden" name={`assignedToAll_${entry.id}`} value="on" />
        ) : null}
        {!entry.assignedToAll && entry.assignedToId ? (
          <input type="hidden" name={`assignedToId_${entry.id}`} value={entry.assignedToId} />
        ) : null}
        {entry.isUrgent ? <input type="hidden" name={`isUrgent_${entry.id}`} value="on" /> : null}
        <input
          type="hidden"
          name={`requiresConfirmation_${entry.id}`}
          value={entry.requiresConfirmation ? "on" : "off"}
        />
        {entry.repeat ? (
          <>
            <input type="hidden" name={`repeatEvery_${entry.id}`} value={entry.repeat.every} />
            <input type="hidden" name={`repeatUnit_${entry.id}`} value={entry.repeat.unit} />
          </>
        ) : null}
      </div>
    );
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
                <span style={{ color: "#64748b", fontSize: 12 }}>{describeEntry(entry)}</span>
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
        <div style={{ display: "grid", gap: 10 }}>
          <strong style={{ color: "#0f172a", fontSize: 15 }}>
            {entries.length > 0 ? "Aggiungine un'altra" : "Che nota è?"}
          </strong>

          <div style={{ display: "grid", gap: 8 }}>
            {NOTE_KINDS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => chooseKind(option)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "42px minmax(0, 1fr)",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 13px",
                  borderRadius: 18,
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 42,
                    height: 42,
                    display: "inline-grid",
                    placeItems: "center",
                    borderRadius: 14,
                    background: "#f8fafc",
                    fontSize: 18,
                  }}
                >
                  {option.emoji}
                </span>
                <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
                  <strong style={{ color: "#0f172a", fontSize: 15 }}>{option.label}</strong>
                  <span style={{ color: "#64748b", fontSize: 12.5, fontWeight: 650 }}>
                    {option.hint}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <button
            type="button"
            onClick={() => setDraft(null)}
            style={{
              justifySelf: "start",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px 8px 11px",
              borderRadius: 999,
              border: "1px solid rgba(124, 58, 237, 0.46)",
              background: "#f3e8ff",
              color: "#4c1d95",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            <span aria-hidden="true">‹</span>
            {kind.emoji} {kind.label}
          </button>

          <TextArea
            value={draft.value}
            onChange={(event) => setDraft({ ...draft, value: event.target.value })}
            placeholder="Scrivi la nota"
            style={{ minHeight: 92 }}
          />

          {kind.asks.includes("repeat") ? (
            <FormField label={kind.id === "check" ? "Ogni quanto" : "Si ripete"}>
              <TaskRepeatField
                repeat={draft.repeat}
                onChange={(repeat) => setDraft({ ...draft, repeat })}
                allowNever={kind.id !== "check"}
              />
            </FormField>
          ) : null}

          {kind.asks.includes("date") ? (
            <FormField label={kind.id === "check" ? "A partire da" : "Data"}>
              <TextInput
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </FormField>
          ) : null}

          {kind.asks.includes("audience") && canChooseAudience ? (
            <FormField label="A chi">
              <AudienceSelector
                members={members.map((member) => ({
                  id: member.id,
                  label: `${member.firstName} ${member.lastName}`,
                }))}
                assignedToAll={draft.assignedToAll}
                assignedToId={draft.assignedToId}
                onChange={(value) => setDraft({ ...draft, ...value })}
              />
            </FormField>
          ) : null}

          {kind.asks.includes("confirmation") && canChooseAudience ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 8,
              }}
            >
              {[
                { value: true, label: "Richiesta conferma" },
                { value: false, label: "Solo da leggere" },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setDraft({ ...draft, requiresConfirmation: option.value })}
                  style={{
                    minHeight: 42,
                    borderRadius: 14,
                    border:
                      draft.requiresConfirmation === option.value
                        ? "1px solid rgba(124, 58, 237, 0.46)"
                        : "1px solid #e2e8f0",
                    background: draft.requiresConfirmation === option.value ? "#f3e8ff" : "#ffffff",
                    color: draft.requiresConfirmation === option.value ? "#4c1d95" : "#334155",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}

          {kind.asks.includes("urgent") ? (
            <label
              style={{ display: "flex", gap: 9, alignItems: "center", fontWeight: 700, color: "#0f172a" }}
            >
              <input
                type="checkbox"
                checked={draft.isUrgent}
                onChange={(event) => setDraft({ ...draft, isUrgent: event.target.checked })}
              />
              Urgente
            </label>
          ) : null}

          <span style={{ color: "#64748b", fontSize: 12.5, fontWeight: 650 }}>
            {describeEntry(draft)}
            {kind.dueToday ? " · oggi" : ""}
          </span>
        </div>
      )}

      {allEntries.map(renderHiddenEntry)}

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
