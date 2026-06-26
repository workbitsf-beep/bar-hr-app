"use client";

import { useState, useTransition } from "react";
import { AudienceSelector } from "@/app/components/audience-selector";
import { TimeInput } from "@/app/components/time-input";
import { FormField, IconButton, PrimaryButton, TextArea, TextInput } from "../ui";

type MemberOption = {
  id: string;
  label: string;
};

type CourseMode = "single" | "multi";

type CourseDraft = {
  id: string;
  mode: CourseMode;
  title: string;
  description: string;
  date: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
  assignedToAll: boolean;
  assignedToId: string;
};

function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createDraft(): CourseDraft {
  return {
    id: crypto.randomUUID(),
    mode: "single",
    title: "",
    description: "",
    date: "",
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    location: "",
    assignedToAll: true,
    assignedToId: "",
  };
}

function normalizeTime(value: string) {
  const [rawHours = "", rawMinutes = ""] = value.split(":");
  const hours = rawHours.replace(/\D/g, "").slice(0, 2);
  const minutes = rawMinutes.replace(/\D/g, "").slice(0, 2);

  if (!hours) {
    return "";
  }

  return `${hours.padStart(2, "0")}:${minutes ? minutes.padStart(2, "0") : "00"}`;
}

function getDraftRange(draft: CourseDraft) {
  const startDate = draft.mode === "single" ? draft.date : draft.startDate;
  const endDate = draft.mode === "single" ? draft.date : draft.endDate;
  const startTime = normalizeTime(draft.startTime);
  const endTime = normalizeTime(draft.endTime);

  return {
    startDate,
    endDate,
    startTime,
    endTime,
    startsAt: startDate && startTime ? `${startDate}T${startTime}` : "",
    endsAt: endDate && endTime ? `${endDate}T${endTime}` : "",
  };
}

function isDraftValid(draft: CourseDraft) {
  const today = todayInputValue();
  const range = getDraftRange(draft);

  if (!draft.title.trim() || !range.startDate || !range.endDate || !range.startTime || !range.endTime) {
    return false;
  }

  if (range.startDate < today || range.endDate < range.startDate) {
    return false;
  }

  if (range.startDate === range.endDate && range.endTime <= range.startTime) {
    return false;
  }

  return true;
}

function rangeLabel(draft: CourseDraft) {
  const range = getDraftRange(draft);

  if (!range.startDate || !range.endDate || !range.startTime || !range.endTime) {
    return "";
  }

  if (range.startDate === range.endDate) {
    return `${range.startDate} ${range.startTime}-${range.endTime}`;
  }

  return `${range.startDate} - ${range.endDate} ${range.startTime}-${range.endTime}`;
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
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const today = todayInputValue();
  const draftValid = isDraftValid(draft);

  function setMode(mode: CourseMode) {
    setDraft((current) => ({
      ...current,
      mode,
      date: mode === "single" ? current.date || current.startDate : current.date,
      startDate: mode === "multi" ? current.startDate || current.date : current.startDate,
      endDate: mode === "multi" ? current.endDate || current.date : current.endDate,
    }));
    setError("");
  }

  function addToList() {
    if (!draftValid) {
      setError("Controlla titolo, date e orari del corso.");
      return;
    }

    setQueued((current) => current.concat(draft));
    setDraft(createDraft());
    setError("");
  }

  function saveAll() {
    const items = queued;

    if (items.length === 0) {
      setError("Aggiungi almeno un corso valido.");
      return;
    }

    startTransition(async () => {
      for (const item of items) {
        const range = getDraftRange(item);
        const formData = new FormData();
        formData.set("title", item.title);
        formData.set("description", item.description);
        formData.set("startsAt", range.startsAt);
        formData.set("endsAt", range.endsAt);
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
      setError("");
    });
  }

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
      {queued.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          {queued.map((item) => (
            <div
              key={item.id}
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
                onClick={() => {
                  setDraft(item);
                  setQueued((current) => current.filter((entry) => entry.id !== item.id));
                  setError("");
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
                <span style={{ display: "block", color: "#64748b", fontSize: 12, fontWeight: 600 }}>
                  {rangeLabel(item)}
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button
          type="button"
          onClick={() => setMode("single")}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 999,
            padding: "10px 12px",
            background: draft.mode === "single" ? "#111827" : "#fff",
            color: draft.mode === "single" ? "#fff" : "#475569",
            fontWeight: 800,
          }}
        >
          Un giorno
        </button>
        <button
          type="button"
          onClick={() => setMode("multi")}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 999,
            padding: "10px 12px",
            background: draft.mode === "multi" ? "#111827" : "#fff",
            color: draft.mode === "multi" ? "#fff" : "#475569",
            fontWeight: 800,
          }}
        >
          Piu giorni
        </button>
      </div>

      <FormField label="Titolo corso">
        <TextInput value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
      </FormField>

      {draft.mode === "single" ? (
        <FormField label="Data">
          <TextInput
            type="date"
            min={today}
            value={draft.date}
            onChange={(event) => setDraft({ ...draft, date: event.target.value })}
          />
        </FormField>
      ) : (
        <div className="dashboard-inline-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <FormField label="Data inizio">
            <TextInput
              type="date"
              min={today}
              value={draft.startDate}
              onChange={(event) => {
                const startDate = event.target.value;
                setDraft({
                  ...draft,
                  startDate,
                  endDate: draft.endDate && draft.endDate < startDate ? startDate : draft.endDate,
                });
              }}
            />
          </FormField>
          <FormField label="Data fine">
            <TextInput
              type="date"
              min={draft.startDate || today}
              value={draft.endDate}
              onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
            />
          </FormField>
        </div>
      )}

      <div className="dashboard-inline-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <FormField label="Ora inizio">
          <TimeInput value={draft.startTime} onChange={(value) => setDraft({ ...draft, startTime: value })} />
        </FormField>
        <FormField label="Ora fine">
          <TimeInput value={draft.endTime} onChange={(value) => setDraft({ ...draft, endTime: value })} />
        </FormField>
      </div>

      <FormField label="Informazioni">
        <TextArea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
      </FormField>

      <div className="dashboard-inline-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <FormField label="Luogo">
          <TextInput value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} />
        </FormField>
        <FormField label="Assegna a">
          <AudienceSelector
            members={members}
            assignedToAll={draft.assignedToAll}
            assignedToId={draft.assignedToId}
            onChange={(value) => setDraft({ ...draft, ...value })}
          />
        </FormField>
      </div>

      {error ? <p style={{ margin: 0, color: "#b91c1c", fontWeight: 700 }}>{error}</p> : null}

      <div className="dashboard-form-actions" style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <IconButton
          type="button"
          onClick={addToList}
          aria-label="Aggiungi corso alla lista"
          disabled={isPending || !draftValid}
          style={{
            width: 38,
            height: 38,
            background: draftValid ? "#dcfce7" : "#f1f5f9",
            color: draftValid ? "#166534" : "#94a3b8",
            border: "1px solid #bbf7d0",
          }}
        >
          ✓
        </IconButton>
        <PrimaryButton type="button" onClick={saveAll} disabled={isPending || queued.length === 0}>
          {isPending ? "Salvataggio..." : `Salva tutti${queued.length > 0 ? ` (${queued.length})` : ""}`}
        </PrimaryButton>
      </div>
    </div>
  );
}
