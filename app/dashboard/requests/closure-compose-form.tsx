"use client";

import { CalendarClosureType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormField, PrimaryButton, Select, TextArea, TextInput } from "../ui";

type ClosureDraft = {
  id: string;
  title: string;
  type: CalendarClosureType;
  startsAt: string;
  endsAt: string;
  notes: string;
};

function createDraft(): ClosureDraft {
  return {
    id: crypto.randomUUID(),
    title: "",
    type: CalendarClosureType.CLOSURE,
    startsAt: "",
    endsAt: "",
    notes: "",
  };
}

function formatDateLabel(value: string) {
  if (!value) {
    return "-";
  }

  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export function ClosureComposeForm({
  action,
}: {
  action: (formData: FormData) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<ClosureDraft>(createDraft());
  const [queued, setQueued] = useState<ClosureDraft[]>([]);
  // Stays open after saving, like every list with "aggiungi un altro".
  const [saved, setSaved] = useState("");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const draftValid = Boolean(draft.startsAt && !(draft.endsAt && draft.endsAt < draft.startsAt));

  function addToList() {
    if (!draft.startsAt) {
      return;
    }

    if (draft.endsAt && draft.endsAt < draft.startsAt) {
      return;
    }

    setQueued((current) => current.concat(draft));
    setDraft(createDraft());
  }

  function saveAll() {
    const items = queued.concat(draftValid ? [draft] : []);

    if (items.length === 0) {
      return;
    }

    startTransition(async () => {
      for (const item of items) {
        const formData = new FormData();
        formData.set("title", item.title);
        formData.set("type", item.type);
        formData.set("startsAt", item.startsAt);
        formData.set("endsAt", item.endsAt || item.startsAt);
        formData.set("notes", item.notes);
        await action(formData);
      }

      setQueued([]);
      setDraft(createDraft());
      setSaved(items.length === 1 ? "Chiusura salvata." : `${items.length} chiusure salvate.`);
      router.refresh();
    });
  }

  const canQueue =
    Boolean(draft.startsAt) && !(draft.endsAt && draft.endsAt < draft.startsAt);
  const readyCount = queued.length + (draftValid ? 1 : 0);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {saved ? (
        <div
          role="status"
          style={{
            padding: "10px 12px",
            borderRadius: 16,
            background: "#ecfdf5",
            border: "1px solid #bbf7d0",
            color: "#166534",
            fontWeight: 800,
          }}
        >
          ✓ {saved}
        </div>
      ) : null}
      {queued.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          {queued.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 16,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setDraft(item);
                  setQueued((current) => current.filter((entry) => entry.id !== item.id));
                }}
                style={{
                  border: 0,
                  background: "transparent",
                  color: "#0f172a",
                  fontWeight: 700,
                  textAlign: "left",
                  padding: 0,
                  display: "grid",
                  gap: 3,
                }}
              >
                <span>{item.title || "Chiusura"}</span>
                <span style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>
                  {formatDateLabel(item.startsAt)}
                  {item.endsAt && item.endsAt !== item.startsAt ? ` - ${formatDateLabel(item.endsAt)}` : ""}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setQueued((current) => current.filter((entry) => entry.id !== item.id))}
                style={{ border: 0, background: "transparent", color: "#94a3b8", fontWeight: 800 }}
              >
                x
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="dashboard-inline-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <FormField label="Titolo">
          <TextInput value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </FormField>
        <FormField label="Tipo">
          <Select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as CalendarClosureType })}>
            <option value={CalendarClosureType.CLOSURE}>Chiusura</option>
            <option value={CalendarClosureType.HOLIDAY}>Festivita</option>
            <option value={CalendarClosureType.VACATION}>Ferie collettive</option>
          </Select>
        </FormField>
        <FormField label="Inizio">
          <TextInput type="date" value={draft.startsAt} onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })} />
        </FormField>
        <FormField label="Fine">
          <TextInput
            type="date"
            min={draft.startsAt || undefined}
            value={draft.endsAt}
            onChange={(event) => {
              const nextEndsAt = event.target.value;
              setDraft({
                ...draft,
                endsAt: draft.startsAt && nextEndsAt < draft.startsAt ? draft.startsAt : nextEndsAt,
              });
            }}
          />
        </FormField>
      </div>
      <FormField label="Note">
        <TextArea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
      </FormField>
      {/* A round + floating over the save button said nothing about what it
          added. It says it now, and "Salva tutte" only appears when there is
          genuinely more than one. */}
      <div
        className="dashboard-form-actions"
        style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}
      >
        <button
          type="button"
          onClick={addToList}
          disabled={isPending || !canQueue}
          style={{
            padding: "10px 14px",
            borderRadius: 14,
            border: "1px dashed #cbd5e1",
            background: "transparent",
            color: canQueue ? "#4c1d95" : "#94a3b8",
            fontSize: 13,
            fontWeight: 820,
            cursor: canQueue ? "pointer" : "default",
          }}
        >
          + Aggiungi un&apos;altra
        </button>

        <PrimaryButton type="button" onClick={saveAll} disabled={isPending || readyCount === 0}>
          {isPending
            ? "Salvataggio..."
            : readyCount > 1
              ? `Salva tutte (${readyCount})`
              : "Salva"}
        </PrimaryButton>
      </div>
    </div>
  );
}
