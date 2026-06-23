"use client";

import { useState, useTransition } from "react";
import { FormField, PrimaryButton, Select, TextArea, TextInput } from "../ui";

type RecipientOption = {
  id: string;
  label: string;
};

type DocumentDraft = {
  id: string;
  title: string;
  description: string;
  audience: "ALL" | "USER";
  assignedToId: string;
  file: File | null;
};

function createDraft(): DocumentDraft {
  return {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    audience: "ALL",
    assignedToId: "",
    file: null,
  };
}

export function DocumentComposeForm({
  recipients,
  action,
}: {
  recipients: RecipientOption[];
  action: (formData: FormData) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<DocumentDraft>(createDraft());
  const [queued, setQueued] = useState<DocumentDraft[]>([]);
  const [isPending, startTransition] = useTransition();

  function addToList() {
    if (!draft.title.trim() || !draft.file) {
      return;
    }

    setQueued((current) => current.concat(draft));
    setDraft(createDraft());
  }

  function saveAll() {
    const currentDraftIsValid = draft.title.trim() && draft.file;
    const items = queued.concat(currentDraftIsValid ? [draft] : []);

    if (items.length === 0) {
      return;
    }

    startTransition(async () => {
      for (const item of items) {
        if (!item.file) {
          continue;
        }

        const formData = new FormData();
        formData.set("title", item.title);
        formData.set("description", item.description);
        formData.set("audience", item.audience);
        formData.set("assignedToId", item.assignedToId);
        formData.set("file", item.file);
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
                {item.title}
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
        <FormField label="Destinatari">
          <Select
            value={draft.audience}
            onChange={(event) => setDraft({ ...draft, audience: event.target.value as "ALL" | "USER" })}
          >
            <option value="ALL">Tutto il team</option>
            <option value="USER">Dipendente specifico</option>
          </Select>
        </FormField>
        <FormField label="Dipendente">
          <Select value={draft.assignedToId} onChange={(event) => setDraft({ ...draft, assignedToId: event.target.value })}>
            <option value="">Nessuno</option>
            {recipients.map((recipient) => (
              <option key={recipient.id} value={recipient.id}>
                {recipient.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField label="Descrizione">
        <TextArea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
      </FormField>

      <FormField label="File">
        <input
          key={draft.id}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
          onChange={(event) => setDraft({ ...draft, file: event.target.files?.[0] ?? null })}
          style={{
            borderRadius: 16,
            border: "1px solid #dbe3ee",
            padding: "12px 14px",
            fontSize: 15,
            background: "#ffffff",
            width: "100%",
          }}
        />
      </FormField>

      <div className="dashboard-form-actions" style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <PrimaryButton type="button" tone="sand" onClick={addToList} disabled={isPending || !draft.title.trim() || !draft.file}>
          + Aggiungi alla lista
        </PrimaryButton>
        <PrimaryButton type="button" onClick={saveAll} disabled={isPending}>
          {isPending ? "Caricamento..." : `Carica tutti${queued.length > 0 ? ` (${queued.length + (draft.title.trim() && draft.file ? 1 : 0)})` : ""}`}
        </PrimaryButton>
      </div>
    </div>
  );
}
