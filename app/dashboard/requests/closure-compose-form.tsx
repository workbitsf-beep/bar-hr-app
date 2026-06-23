"use client";

import { CalendarClosureType } from "@prisma/client";
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

export function ClosureComposeForm({
  action,
}: {
  action: (formData: FormData) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<ClosureDraft>(createDraft());
  const [queued, setQueued] = useState<ClosureDraft[]>([]);
  const [isPending, startTransition] = useTransition();

  function addToList() {
    if (!draft.startsAt) {
      return;
    }

    setQueued((current) => current.concat(draft));
    setDraft(createDraft());
  }

  function saveAll() {
    const currentDraftIsValid = Boolean(draft.startsAt);
    const items = queued.concat(currentDraftIsValid ? [draft] : []);

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
        formData.set("notifySuccess", "1");
        await action(formData);
      }

      setQueued([]);
      setDraft(createDraft());
    });
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {queued.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          {queued.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
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
                }}
              >
                {item.title || "Chiusura"} - {item.startsAt}
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
          <TextInput type="date" value={draft.endsAt} onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })} />
        </FormField>
      </div>
      <FormField label="Note">
        <TextArea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
      </FormField>
      <div className="dashboard-form-actions" style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <PrimaryButton type="button" tone="sand" onClick={addToList} disabled={isPending || !draft.startsAt}>
          + Aggiungi alla lista
        </PrimaryButton>
        <PrimaryButton type="button" onClick={saveAll} disabled={isPending}>
          {isPending ? "Salvataggio..." : `Salva tutte${queued.length > 0 ? ` (${queued.length + (draft.startsAt ? 1 : 0)})` : ""}`}
        </PrimaryButton>
      </div>
    </div>
  );
}
