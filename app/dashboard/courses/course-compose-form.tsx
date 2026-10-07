"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CourseKind } from "@prisma/client";
import { AudienceSelector } from "@/app/components/audience-selector";
import {
  COURSE_KINDS,
  describeCourseValidity,
  expiryFromStart,
  getCourseKind,
  type CourseKindDefinition,
} from "@/lib/course-kinds";
import { FormField, IconButton, PrimaryButton, TextArea, TextInput } from "../ui";

type MemberOption = {
  id: string;
  label: string;
};

type CourseDraft = {
  id: string;
  kind: CourseKind;
  title: string;
  description: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  expiresAt: string;
  location: string;
  assignedToAll: boolean;
  assignedToId: string;
};

/** The shapes a training day actually takes, instead of four number boxes. */
const TIME_PRESETS = [
  { label: "Mattina", startTime: "09:00", endTime: "13:00" },
  { label: "Pomeriggio", startTime: "14:00", endTime: "18:00" },
  { label: "Tutto il giorno", startTime: "09:00", endTime: "18:00" },
];

function toDateInputValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function createDraft(kind: CourseKindDefinition): CourseDraft {
  return {
    id: crypto.randomUUID(),
    kind: kind.id,
    title: kind.id === CourseKind.OTHER ? "" : kind.label,
    description: "",
    date: "",
    endDate: "",
    startTime: "14:00",
    endTime: "18:00",
    expiresAt: "",
    location: "",
    assignedToAll: true,
    assignedToId: "",
  };
}

function isDraftValid(draft: CourseDraft) {
  if (!draft.title.trim() || !draft.date || !draft.startTime || !draft.endTime) {
    return false;
  }

  if (!draft.assignedToAll && !draft.assignedToId) {
    return false;
  }

  const endDate = draft.endDate || draft.date;

  if (endDate < draft.date) {
    return false;
  }

  return endDate !== draft.date || draft.endTime > draft.startTime;
}

function describeDay(value: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function CourseComposeForm({
  members,
  action,
}: {
  members: MemberOption[];
  action: (formData: FormData) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<CourseDraft | null>(null);
  const [queued, setQueued] = useState<CourseDraft[]>([]);
  const [showExtras, setShowExtras] = useState(false);
  const [multiDay, setMultiDay] = useState(false);
  const [exactHours, setExactHours] = useState(false);
  const [error, setError] = useState("");
  // The popup stays open after saving: there may be more to add, and the
  // person closes it when they are done. It used to ask the server to reload
  // the page, which closed it after the first course and dropped the rest.
  const [saved, setSaved] = useState("");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const kind = draft ? getCourseKind(draft.kind) : null;
  const draftValid = draft ? isDraftValid(draft) : false;
  const readyCount = queued.length + (draftValid ? 1 : 0);

  function chooseKind(nextKind: CourseKindDefinition) {
    setDraft(createDraft(nextKind));
    setShowExtras(false);
    setMultiDay(false);
    setExactHours(false);
    setError("");
  }

  /** The expiry follows the date until someone types their own. */
  function setDate(value: string) {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const definition = getCourseKind(current.kind);
      const suggested = value ? expiryFromStart(new Date(`${value}T12:00:00`), definition) : null;

      return {
        ...current,
        date: value,
        expiresAt: suggested ? toDateInputValue(suggested) : current.expiresAt,
      };
    });
  }

  function addToList() {
    if (!draft || !draftValid) {
      setError("Controlla titolo, data e orario del corso.");
      return;
    }

    setQueued((current) => current.concat(draft));
    setDraft(null);
    setShowExtras(false);
    setMultiDay(false);
    setError("");
  }

  function saveAll() {
    const items = queued.concat(draft && draftValid ? [draft] : []);

    if (items.length === 0) {
      setError("Aggiungi almeno un corso.");
      return;
    }

    startTransition(async () => {
      for (const item of items) {
        const endDate = item.endDate || item.date;
        const formData = new FormData();
        formData.set("kind", item.kind);
        formData.set("title", item.title);
        formData.set("description", item.description);
        formData.set("startsAt", `${item.date}T${item.startTime}`);
        formData.set("endsAt", `${endDate}T${item.endTime}`);
        formData.set("expiresAt", item.expiresAt);
        formData.set("location", item.location);

        if (item.assignedToAll) {
          formData.set("assignedToAll", "on");
        } else if (item.assignedToId) {
          formData.set("assignedToId", item.assignedToId);
        }

        await action(formData);
      }

      setQueued([]);
      setDraft(null);
      setError("");
      setSaved(items.length === 1 ? "Corso salvato. Puoi aggiungerne un altro." : `${items.length} corsi salvati. Puoi aggiungerne altri.`);
      router.refresh();
    });
  }

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
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
      {error ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 16,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#9a3412",
            fontWeight: 800,
          }}
        >
          {error}
        </div>
      ) : null}

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
                }}
                style={{
                  flex: "1 1 auto",
                  border: 0,
                  background: "transparent",
                  padding: 0,
                  textAlign: "left",
                  display: "grid",
                  gap: 2,
                  minWidth: 0,
                  cursor: "pointer",
                }}
              >
                <strong style={{ fontSize: 13, color: "#0f172a" }}>
                  {getCourseKind(item.kind).emoji} {item.title}
                </strong>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                  {describeDay(item.date)} · {item.startTime}–{item.endTime}
                </span>
              </button>
              <IconButton
                type="button"
                onClick={() => setQueued((current) => current.filter((entry) => entry.id !== item.id))}
                aria-label="Togli il corso"
              >
                ×
              </IconButton>
            </div>
          ))}
        </div>
      ) : null}

      {/* The kind first: it is what a venue thinks in, and it knows how long
          the certificate lasts so nobody has to. */}
      {!draft || !kind ? (
        <div style={{ display: "grid", gap: 10 }}>
          <strong style={{ color: "#0f172a", fontSize: 15 }}>
            {queued.length > 0 ? "Aggiungine un altro" : "Che corso è?"}
          </strong>

          <div style={{ display: "grid", gap: 8 }}>
            {COURSE_KINDS.map((option) => (
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
                    {describeCourseValidity(option)}
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

          {kind.id === CourseKind.OTHER ? (
            <FormField label="Titolo">
              <TextInput
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
            </FormField>
          ) : null}

          <FormField label="Quando">
            <TextInput type="date" value={draft.date} onChange={(event) => setDate(event.target.value)} />
          </FormField>

          {multiDay ? (
            <FormField label="Fino al">
              <TextInput
                type="date"
                value={draft.endDate}
                onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
              />
            </FormField>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMultiDay(true);
                setDraft({ ...draft, endDate: draft.date });
              }}
              style={{
                justifySelf: "start",
                padding: 0,
                border: 0,
                background: "transparent",
                color: "#64748b",
                fontSize: 13,
                fontWeight: 780,
                cursor: "pointer",
              }}
            >
              ＋ Dura più di un giorno
            </button>
          )}

          <div style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 820, color: "#334155" }}>Orario</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {TIME_PRESETS.map((preset) => {
                const active =
                  draft.startTime === preset.startTime && draft.endTime === preset.endTime;

                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      setDraft({ ...draft, startTime: preset.startTime, endTime: preset.endTime })
                    }
                    style={{
                      minHeight: 38,
                      padding: "0 13px",
                      borderRadius: 999,
                      border: active ? "1px solid rgba(124, 58, 237, 0.46)" : "1px solid #e2e8f0",
                      background: active ? "#f3e8ff" : "#ffffff",
                      color: active ? "#4c1d95" : "#475569",
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <span style={{ color: "#64748b", fontSize: 13, fontWeight: 700 }}>
              {draft.startTime} – {draft.endTime}
            </span>

            {/* Folded away, like everywhere else: the presets answer it nearly
                always, and two time boxes under them only made the form
                longer. */}
            {exactHours ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                <TextInput
                  type="time"
                  aria-label="Ora inizio"
                  value={draft.startTime}
                  onChange={(event) => setDraft({ ...draft, startTime: event.target.value })}
                />
                <TextInput
                  type="time"
                  aria-label="Ora fine"
                  value={draft.endTime}
                  onChange={(event) => setDraft({ ...draft, endTime: event.target.value })}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setExactHours(true)}
                style={{
                  justifySelf: "start",
                  padding: "10px 13px",
                  borderRadius: 14,
                  border: "1px dashed #cbd5e1",
                  background: "transparent",
                  color: "#64748b",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                ＋ Ora esatta
              </button>
            )}
          </div>

          <FormField label="A chi">
            <AudienceSelector
              members={members.map((member) => ({
                id: member.id,
                label: member.label.split(" - ")[0],
              }))}
              assignedToAll={draft.assignedToAll}
              assignedToId={draft.assignedToId}
              onChange={(value) => setDraft({ ...draft, ...value })}
            />
          </FormField>

          {kind.validForMonths ? (
            <FormField label="Scade il">
              <TextInput
                type="date"
                value={draft.expiresAt}
                onChange={(event) => setDraft({ ...draft, expiresAt: event.target.value })}
              />
            </FormField>
          ) : null}

          {showExtras ? (
            <>
              <FormField label="Luogo">
                <TextInput
                  value={draft.location}
                  onChange={(event) => setDraft({ ...draft, location: event.target.value })}
                />
              </FormField>
              <FormField label="Informazioni">
                <TextArea
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  style={{ minHeight: 80 }}
                />
              </FormField>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowExtras(true)}
              style={{
                justifySelf: "start",
                padding: "10px 13px",
                borderRadius: 14,
                border: "1px dashed #cbd5e1",
                background: "transparent",
                color: "#64748b",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              ＋ Luogo e informazioni
            </button>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={addToList}
          disabled={!draftValid || isPending}
          style={{
            padding: "10px 14px",
            borderRadius: 14,
            border: "1px dashed #cbd5e1",
            background: "transparent",
            color: draftValid ? "#4c1d95" : "#94a3b8",
            fontSize: 13,
            fontWeight: 820,
            cursor: draftValid ? "pointer" : "default",
          }}
        >
          + Aggiungi un altro
        </button>

        <PrimaryButton type="button" onClick={saveAll} disabled={isPending || readyCount === 0}>
          {isPending
            ? "Salvataggio..."
            : readyCount > 1
              ? `Salva corsi (${readyCount})`
              : "Salva corso"}
        </PrimaryButton>
      </div>
    </div>
  );
}
