"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormField, IconButton, PrimaryButton, TextArea, TextInput } from "../ui";

type RecipientOption = {
  id: string;
  label: string;
};

type DocumentDraft = {
  id: string;
  title: string;
  description: string;
  assignedToAll: boolean;
  assignedToIds: string[];
  file: File | null;
};

function createDraft(): DocumentDraft {
  return {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    assignedToAll: true,
    assignedToIds: [],
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
  const router = useRouter();
  const [draft, setDraft] = useState<DocumentDraft>(createDraft());
  const [queued, setQueued] = useState<DocumentDraft[]>([]);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function addToList() {
    setError("");
    setMessage("");

    if (!draft.title.trim() || !draft.file || (!draft.assignedToAll && draft.assignedToIds.length === 0)) {
      setError("Completa titolo, file e destinatari.");
      return;
    }

    setQueued((current) => current.concat(draft));
    setDraft(createDraft());
  }

  function saveAll() {
    setError("");
    setMessage("");

    const currentDraftIsValid =
      draft.title.trim() &&
      draft.file &&
      (draft.assignedToAll || draft.assignedToIds.length > 0);
    const items = queued.concat(currentDraftIsValid ? [draft] : []);

    if (items.length === 0) {
      setError("Aggiungi almeno un documento da caricare.");
      return;
    }

    startTransition(async () => {
      try {
        for (const item of items) {
          if (!item.file) {
            continue;
          }

          const targetIds = item.assignedToAll ? [null] : item.assignedToIds;

          for (const targetId of targetIds) {
            const formData = new FormData();
            formData.set("title", item.title);
            formData.set("description", item.description);
            formData.set("audience", targetId ? "USER" : "ALL");
            formData.set("assignedToId", targetId ?? "");
            formData.set("file", item.file);
            await action(formData);
          }
        }

        setQueued([]);
        setDraft(createDraft());
        setMessage("Documenti caricati.");
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Impossibile caricare il documento.");
      }
    });
  }

  function toggleRecipient(recipientId: string) {
    setDraft((current) => {
      const selected = new Set(current.assignedToIds);

      if (selected.has(recipientId)) {
        selected.delete(recipientId);
      } else {
        selected.add(recipientId);
      }

      return {
        ...current,
        assignedToAll: false,
        assignedToIds: Array.from(selected),
      };
    });
  }

  function getAudienceLabel(item: DocumentDraft) {
    if (item.assignedToAll) {
      return "Tutto il team";
    }

    const labels = item.assignedToIds
      .map((id) => recipients.find((recipient) => recipient.id === id)?.label.split(" - ")[0])
      .filter(Boolean);

    if (labels.length === 0) {
      return "Nessun destinatario";
    }

    return labels.length === 1 ? labels[0] : `${labels.length} dipendenti`;
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {error ? (
        <div style={{ padding: "10px 12px", borderRadius: 16, background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", fontWeight: 800 }}>
          {error}
        </div>
      ) : null}
      {message ? (
        <div style={{ padding: "10px 12px", borderRadius: 16, background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#166534", fontWeight: 800 }}>
          ✓ {message}
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
                <span style={{ display: "block", color: "#64748b", fontSize: 12, marginTop: 2 }}>
                  {getAudienceLabel(item)}
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
      </div>

      <FormField label="Destinatari">
        <div className="dashboard-audience-selector" style={{ display: "grid", gap: 12 }}>
          <div
            className="dashboard-audience-options"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <button
              className="dashboard-select-pill"
              type="button"
              onClick={() => setDraft({ ...draft, assignedToAll: true, assignedToIds: [] })}
              aria-pressed={draft.assignedToAll}
              style={{
                minHeight: 42,
                borderRadius: 999,
                border: draft.assignedToAll ? "1.5px solid #7c3aed" : "1px solid #e2e8f0",
                background: draft.assignedToAll ? "#f3e8ff" : "#ffffff",
                color: draft.assignedToAll ? "#4c1d95" : "#334155",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "9px 13px",
                fontSize: 14,
                fontWeight: 760,
                boxShadow: "0 8px 20px rgba(15, 23, 42, 0.04)",
                transition: "background 160ms ease, border-color 160ms ease, color 160ms ease",
                cursor: "pointer",
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
                {draft.assignedToAll ? "✓" : "○"}
              </span>
              <span>Team</span>
            </button>
            <button
              className="dashboard-select-pill"
              type="button"
              onClick={() => setDraft({ ...draft, assignedToAll: false })}
              aria-pressed={!draft.assignedToAll}
              style={{
                minHeight: 42,
                borderRadius: 999,
                border: !draft.assignedToAll ? "1.5px solid #7c3aed" : "1px solid #e2e8f0",
                background: !draft.assignedToAll ? "#f3e8ff" : "#ffffff",
                color: !draft.assignedToAll ? "#4c1d95" : "#334155",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "9px 13px",
                fontSize: 14,
                fontWeight: 760,
                boxShadow: "0 8px 20px rgba(15, 23, 42, 0.04)",
                transition: "background 160ms ease, border-color 160ms ease, color 160ms ease",
                cursor: "pointer",
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
                {!draft.assignedToAll ? "✓" : "○"}
              </span>
              <span>Dipendenti</span>
            </button>
          </div>

          {!draft.assignedToAll ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                maxHeight: 148,
                overflowY: "auto",
                padding: 4,
              }}
            >
              {recipients.map((recipient) => {
                const selected = draft.assignedToIds.includes(recipient.id);

                return (
                  <button
                    key={recipient.id}
                    className="dashboard-select-pill"
                    type="button"
                    onClick={() => toggleRecipient(recipient.id)}
                    aria-pressed={selected}
                    style={{
                      borderRadius: 999,
                      border: selected ? "1.5px solid #7c3aed" : "1px solid #e2e8f0",
                      background: selected ? "#f3e8ff" : "#ffffff",
                      color: selected ? "#4c1d95" : "#334155",
                      padding: "8px 12px",
                      fontSize: 13,
                      fontWeight: 750,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: selected ? "0 8px 18px rgba(124, 58, 237, 0.10)" : "none",
                      cursor: "pointer",
                    }}
                  >
                    <span aria-hidden="true">{selected ? "✓" : "○"}</span>
                    <span>{recipient.label.split(" - ")[0]}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {draft.assignedToAll ? null : (
            <span style={{ color: "#64748b", fontSize: 13, fontWeight: 700 }}>
              {draft.assignedToIds.length} selezionati
            </span>
          )}
        </div>
      </FormField>

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
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <IconButton
            type="button"
            onClick={addToList}
            aria-label="Aggiungi documento alla lista"
            disabled={
              isPending ||
              !draft.title.trim() ||
              !draft.file ||
              (!draft.assignedToAll && draft.assignedToIds.length === 0)
            }
            style={{
              width: 38,
              height: 38,
              background:
                draft.title.trim() &&
                draft.file &&
                (draft.assignedToAll || draft.assignedToIds.length > 0)
                  ? "#dcfce7"
                  : "#f1f5f9",
              color:
                draft.title.trim() &&
                draft.file &&
                (draft.assignedToAll || draft.assignedToIds.length > 0)
                  ? "#166534"
                  : "#94a3b8",
              border: "1px solid #bbf7d0",
            }}
          >
            ✓
          </IconButton>
        </div>
      </FormField>

      <div className="dashboard-form-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <IconButton
          type="button"
          onClick={addToList}
          aria-label="Aggiungi documento alla lista"
          disabled={
            isPending ||
            !draft.title.trim() ||
            !draft.file ||
            (!draft.assignedToAll && draft.assignedToIds.length === 0)
          }
          style={{
            width: 44,
            height: 44,
            background:
              draft.title.trim() &&
              draft.file &&
              (draft.assignedToAll || draft.assignedToIds.length > 0)
                ? "#dcfce7"
                : "#f1f5f9",
            color:
              draft.title.trim() &&
              draft.file &&
              (draft.assignedToAll || draft.assignedToIds.length > 0)
                ? "#166534"
                : "#94a3b8",
            border: "1px solid #bbf7d0",
            display: "none",
          }}
        >
          ✓
        </IconButton>
        <PrimaryButton type="button" onClick={saveAll} disabled={isPending}>
          {isPending ? "Caricamento..." : `Carica tutti${queued.length > 0 ? ` (${queued.length + (draft.title.trim() && draft.file ? 1 : 0)})` : ""}`}
        </PrimaryButton>
      </div>
    </div>
  );
}
