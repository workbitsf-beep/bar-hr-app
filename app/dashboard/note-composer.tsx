"use client";

import { AudienceSelector } from "@/app/components/audience-selector";
import { NOTE_KINDS, getNoteKind, type NoteKind, type NoteKindId } from "./note-kinds";
import { TaskRepeatField, describeTaskRepeatDraft, type TaskRepeatDraft } from "./task-repeat-field";
import { FormField, TextArea, TextInput } from "./ui";

/**
 * The one way a note gets written.
 *
 * It is used from the Note page and from the calendar's day popup, and they
 * have to behave the same: two copies of this drifted apart within a day of
 * being written, and a note added from the calendar quietly meant something
 * different from the same note added from the list.
 */

export type NoteMember = {
  id: string;
  firstName: string;
  lastName: string;
};

export type NoteDraft = {
  id: string;
  kindId: NoteKindId;
  value: string;
  assignedToAll: boolean;
  assignedToId: string;
  isUrgent: boolean;
  requiresConfirmation: boolean;
  repeat: TaskRepeatDraft;
};

export function createNoteDraft(kind: NoteKind): NoteDraft {
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

export function describeNoteAudience(draft: NoteDraft, members: NoteMember[]) {
  if (draft.assignedToAll) {
    return "Tutto il team";
  }

  const labels = getSelectedIds(draft.assignedToId)
    .map((id) => members.find((member) => member.id === id))
    .filter(Boolean)
    .map((member) => `${member?.firstName} ${member?.lastName}`);

  if (labels.length === 0) {
    return "Persona non selezionata";
  }

  return labels.length === 1 ? labels[0] : `${labels.length} dipendenti`;
}

export function describeNoteDraft(
  draft: NoteDraft,
  members: NoteMember[],
  canChooseAudience: boolean
) {
  return [
    canChooseAudience ? describeNoteAudience(draft, members) : "Nota personale",
    draft.isUrgent ? "urgente" : null,
    draft.requiresConfirmation ? null : "solo da leggere",
    describeTaskRepeatDraft(draft.repeat),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The first question: which of the four kinds of note this is. */
export function NoteKindPicker({
  heading,
  onPick,
}: {
  heading: string;
  onPick: (kind: NoteKind) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <strong style={{ color: "#0f172a", fontSize: 15 }}>{heading}</strong>

      <div style={{ display: "grid", gap: 8 }}>
        {NOTE_KINDS.map((kind) => (
          <button
            key={kind.id}
            type="button"
            onClick={() => onPick(kind)}
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
              {kind.emoji}
            </span>
            <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
              <strong style={{ color: "#0f172a", fontSize: 15 }}>{kind.label}</strong>
              <span style={{ color: "#64748b", fontSize: 12.5, fontWeight: 650 }}>{kind.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** The chosen kind, and the way back to the four. */
export function NoteKindBadge({ kind, onBack }: { kind: NoteKind; onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
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
  );
}

/**
 * Everything the chosen kind still needs answering.
 *
 * `showDate` is off where the date is already settled - the calendar's day
 * popup knows which day was tapped, so asking again would be asking the same
 * question twice.
 */
export function NoteKindFields({
  draft,
  members,
  canChooseAudience,
  dueDate,
  onDueDateChange,
  showDate = true,
  onChange,
}: {
  draft: NoteDraft;
  members: NoteMember[];
  canChooseAudience: boolean;
  dueDate: string;
  onDueDateChange: (value: string) => void;
  showDate?: boolean;
  onChange: (draft: NoteDraft) => void;
}) {
  const kind = getNoteKind(draft.kindId);

  return (
    <>
      <TextArea
        value={draft.value}
        onChange={(event) => onChange({ ...draft, value: event.target.value })}
        placeholder="Scrivi la nota"
        style={{ minHeight: 92 }}
      />

      {kind.asks.includes("repeat") ? (
        <FormField label={kind.id === "check" ? "Ogni quanto" : "Si ripete"}>
          <TaskRepeatField
            repeat={draft.repeat}
            onChange={(repeat) => onChange({ ...draft, repeat })}
            allowNever={kind.id !== "check"}
          />
        </FormField>
      ) : null}

      {showDate && kind.asks.includes("date") ? (
        <FormField label={kind.id === "check" ? "A partire da" : "Data"}>
          <TextInput
            type="date"
            value={dueDate}
            onChange={(event) => onDueDateChange(event.target.value)}
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
            onChange={(value) => onChange({ ...draft, ...value })}
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
              onClick={() => onChange({ ...draft, requiresConfirmation: option.value })}
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
            onChange={(event) => onChange({ ...draft, isUrgent: event.target.checked })}
          />
          Urgente
        </label>
      ) : null}
    </>
  );
}

/** The fields the action reads, for a form that posts a draft as-is. */
export function NoteDraftFields({ draft }: { draft: NoteDraft }) {
  return (
    <div style={{ display: "none" }}>
      <input type="hidden" name="taskEntryId" value={draft.id} />
      <input type="hidden" name={`title_${draft.id}`} value={draft.value} />
      {draft.assignedToAll ? (
        <input type="hidden" name={`assignedToAll_${draft.id}`} value="on" />
      ) : null}
      {!draft.assignedToAll && draft.assignedToId ? (
        <input type="hidden" name={`assignedToId_${draft.id}`} value={draft.assignedToId} />
      ) : null}
      {draft.isUrgent ? <input type="hidden" name={`isUrgent_${draft.id}`} value="on" /> : null}
      <input
        type="hidden"
        name={`requiresConfirmation_${draft.id}`}
        value={draft.requiresConfirmation ? "on" : "off"}
      />
      {draft.repeat ? (
        <>
          <input type="hidden" name={`repeatEvery_${draft.id}`} value={draft.repeat.every} />
          <input type="hidden" name={`repeatUnit_${draft.id}`} value={draft.repeat.unit} />
        </>
      ) : null}
    </div>
  );
}

/** The same fields, written into a FormData the caller posts itself. */
export function appendNoteDraft(formData: FormData, draft: NoteDraft) {
  formData.append("taskEntryId", draft.id);
  formData.set(`title_${draft.id}`, draft.value);

  if (draft.assignedToAll) {
    formData.set(`assignedToAll_${draft.id}`, "on");
  } else if (draft.assignedToId) {
    formData.set(`assignedToId_${draft.id}`, draft.assignedToId);
  }

  if (draft.isUrgent) {
    formData.set(`isUrgent_${draft.id}`, "on");
  }

  formData.set(`requiresConfirmation_${draft.id}`, draft.requiresConfirmation ? "on" : "off");

  if (draft.repeat) {
    formData.set(`repeatEvery_${draft.id}`, String(draft.repeat.every));
    formData.set(`repeatUnit_${draft.id}`, draft.repeat.unit);
  }
}
