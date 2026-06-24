"use client";

import { useState, useTransition } from "react";
import { DateTimeInput } from "@/app/components/date-time-input";
import { FormField, IconButton, PrimaryButton, Select, TextArea, TextInput } from "../ui";

type MemberOption = {
  id: string;
  label: string;
};

type CourseDraft = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  assignedToAll: boolean;
  assignedToId: string;
};

function createDraft(): CourseDraft {
  return {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    startsAt: "",
    endsAt: "",
    location: "",
    assignedToAll: true,
    assignedToId: "",
  };
}

export function CourseComposeForm({
  members,
  action,
}: {
  members: MemberOption[];
  action: (formData: FormData) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<CourseDraft>(createDraft());
  const [queued, setQueued] = useState<CourseDraft[]>([]);
  const [isPending, startTransition] = useTransition();

  function addToList() {
    if (!draft.title.trim() || !draft.startsAt || !draft.endsAt) {
      return;
    }

    setQueued((current) => current.concat(draft));
    setDraft(createDraft());
  }

  function saveAll() {
    const currentDraftIsValid = draft.title.trim() && draft.startsAt && draft.endsAt;
    const items = queued.concat(currentDraftIsValid ? [draft] : []);

    if (items.length === 0) {
      return;
    }

    startTransition(async () => {
      for (const item of items) {
        const formData = new FormData();
        formData.set("title", item.title);
        formData.set("description", item.description);
        formData.set("startsAt", item.startsAt);
        formData.set("endsAt", item.endsAt);
        formData.set("location", item.location);
        formData.set("notifySuccess", "1");

        if (item.assignedToAll) {
          formData.set("assignedToAll", "on");
        } else if (item.assignedToId) {
          formData.set("assignedToId", item.assignedToId);
        }

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

      <FormField label="Titolo corso">
        <TextInput value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
      </FormField>
      <FormField label="Informazioni">
        <TextArea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
      </FormField>
      <div className="dashboard-inline-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <FormField label="Inizio">
          <DateTimeInput value={draft.startsAt} onChange={(value) => setDraft({ ...draft, startsAt: value })} />
        </FormField>
        <FormField label="Fine">
          <DateTimeInput value={draft.endsAt} onChange={(value) => setDraft({ ...draft, endsAt: value })} />
        </FormField>
        <FormField label="Luogo">
          <TextInput value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} />
        </FormField>
        <FormField label="Assegna a">
          <Select
            value={draft.assignedToAll ? "ALL" : draft.assignedToId}
            onChange={(event) =>
              setDraft({
                ...draft,
                assignedToAll: event.target.value === "ALL",
                assignedToId: event.target.value === "ALL" ? "" : event.target.value,
              })
            }
          >
            <option value="ALL">Tutto il team</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="dashboard-form-actions" style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <IconButton
          type="button"
          onClick={addToList}
          aria-label="Aggiungi corso alla lista"
          disabled={isPending || !draft.title.trim() || !draft.startsAt || !draft.endsAt}
          style={{
            width: 44,
            height: 44,
            background: draft.title.trim() && draft.startsAt && draft.endsAt ? "#dcfce7" : "#f1f5f9",
            color: draft.title.trim() && draft.startsAt && draft.endsAt ? "#166534" : "#94a3b8",
            border: "1px solid #bbf7d0",
          }}
        >
          ✓
        </IconButton>
        <PrimaryButton type="button" onClick={saveAll} disabled={isPending}>
          {isPending ? "Salvataggio..." : `Salva tutti${queued.length > 0 ? ` (${queued.length + (draft.title.trim() && draft.startsAt && draft.endsAt ? 1 : 0)})` : ""}`}
        </PrimaryButton>
      </div>
    </div>
  );
}
