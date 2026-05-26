"use client";

import { RequestType } from "@prisma/client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { combineDateAndTime, toDateInputValue } from "@/lib/shift-datetime";
import type { ShiftPreset } from "@/lib/shift-presets";
import {
  completeTaskAction,
  createAvailabilityAction,
  createBoardNoteAction,
  createShiftAction,
  createTaskAction,
  createTimeOffRequestAction,
} from "../actions";
import { ShiftEditorModal } from "../shifts/shift-editor-modal";
import { IconButton, PrimaryButton, Select, StatusPill } from "../ui";
import { CalendarWeekStrip } from "./calendar-week-strip";
import { QuickCalendarEntryModal } from "./quick-calendar-entry-modal";
import { scrollToTodayCard } from "./scroll-to-today-button";

type MemberOption = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

type ShiftAssignment = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

type ShiftItem = {
  id: string;
  title: string | null;
  startTime: string;
  endTime: string;
  confirmedAt: string | null;
  assignments: ShiftAssignment[];
};

type AvailabilityItem = {
  id: string;
  firstName: string;
  lastName: string;
};

type RequestItem = {
  id: string;
  type: string;
  firstName: string;
  lastName: string;
};

type TaskItem = {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  isUrgent: boolean;
  assignedLabel: string;
  completedByLabel: string | null;
};

type NoteItem = {
  id: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  authorName: string;
};

type DayItem = {
  date: string;
  isToday: boolean;
  inCurrentMonth: boolean;
  shifts: ShiftItem[];
  availabilities: AvailabilityItem[];
  requests: RequestItem[];
  tasks: TaskItem[];
  notes: NoteItem[];
};

type FeedbackState =
  | {
      tone: "success" | "danger";
      message: string;
    }
  | null;

function formatDayTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDayLabel(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(value));
}

function formatRoleLabel(role: string) {
  if (role === "MANAGER") {
    return "Manager";
  }

  if (role === "OWNER") {
    return "Titolare";
  }

  return "Dipendente";
}

function formatRequestTypeLabel(type: string) {
  if (type === RequestType.PERMISSION) {
    return "Permesso";
  }

  if (type === RequestType.SICKNESS) {
    return "Malattia";
  }

  return "Ferie";
}

function formatAssignmentNames(assignments: ShiftAssignment[]) {
  return assignments.map((assignment) => `${assignment.firstName} ${assignment.lastName}`).join(", ");
}

function renderCompactShiftCard(shift: ShiftItem, locale: string, mobile = false) {
  return (
    <div
      key={shift.id}
      style={{
        padding: mobile ? "12px 14px" : "10px 12px",
        borderRadius: mobile ? 18 : 16,
        background: "#eff6ff",
        border: "1px solid #dbeafe",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: "#0f172a", fontSize: mobile ? 15 : 13 }}>
          {formatDayTime(shift.startTime, locale)} - {formatDayTime(shift.endTime, locale)}
        </strong>
        <span style={{ color: "#475569", fontSize: mobile ? 14 : 12 }}>
          {formatAssignmentNames(shift.assignments)}
        </span>
        <span
          title={shift.confirmedAt ? "Confermato" : "In attesa"}
          aria-label={shift.confirmedAt ? "Confermato" : "In attesa"}
          style={{
            marginLeft: "auto",
            color: shift.confirmedAt ? "#16a34a" : "#f59e0b",
            fontWeight: 700,
            fontSize: mobile ? 16 : 14,
          }}
        >
          {shift.confirmedAt ? "✓" : "○"}
        </span>
      </div>
    </div>
  );
}

function toDateTimeLocal(dateIso: string, hour: number, minute: number) {
  const date = new Date(dateIso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function chunkByWeek<T>(items: T[]) {
  return Array.from({ length: Math.ceil(items.length / 7) }, (_, index) =>
    items.slice(index * 7, index * 7 + 7)
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Operazione non riuscita.";
}

function formatNoteTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function OwnerCalendarClient({
  locale,
  weekdayLabels,
  days,
  members,
  presets,
  filteredDay,
  role,
}: {
  locale: string;
  weekdayLabels: string[];
  days: DayItem[];
  members: MemberOption[];
  presets: ShiftPreset[];
  filteredDay?: string | null;
  role: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [quickComposer, setQuickComposer] = useState<"task" | "board" | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [title, setTitle] = useState("");
  const [shiftDate, setShiftDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedPresetKey, setSelectedPresetKey] = useState("CUSTOM");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [requestType, setRequestType] = useState<string>(RequestType.VACATION);
  const [requestStart, setRequestStart] = useState("");
  const [requestEnd, setRequestEnd] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [certificateCode, setCertificateCode] = useState("");
  const [availabilityStart, setAvailabilityStart] = useState("");
  const [availabilityEnd, setAvailabilityEnd] = useState("");
  const [availabilityReason, setAvailabilityReason] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!selectedDate) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedDate]);

  useEffect(() => {
    if (filteredDay || selectedDate) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      scrollToTodayCard("instant");
    });

    return () => cancelAnimationFrame(frame);
  }, [filteredDay, selectedDate]);

  const selectedDay = useMemo(
    () => days.find((day) => day.date === selectedDate) ?? null,
    [days, selectedDate]
  );
  const editingShift = useMemo(
    () => selectedDay?.shifts.find((shift) => shift.id === editingShiftId) ?? null,
    [editingShiftId, selectedDay]
  );
  const weeks = useMemo(() => chunkByWeek(days), [days]);
  const visibleWeeks = useMemo(
    () =>
      filteredDay
        ? weeks.filter((week) => week.some((day) => day.date.slice(0, 10) === filteredDay))
        : weeks,
    [filteredDay, weeks]
  );
  const canCreatePersonalEntries = role === "MANAGER";

  function openDay(day: DayItem) {
    setSelectedDate(day.date);
    setEditingShiftId(null);
    setQuickComposer(null);
    setFeedback(null);
    setTitle("");
    setShiftDate(toDateInputValue(day.date));
    setStartTime("09:00");
    setEndTime("17:00");
    setSelectedPresetKey("CUSTOM");
    setSelectedMembers(day.shifts[0]?.assignments.map((assignment) => assignment.id) ?? []);
    setRequestType(RequestType.VACATION);
    setRequestStart(toDateTimeLocal(day.date, 9, 0));
    setRequestEnd(toDateTimeLocal(day.date, 18, 0));
    setRequestReason("");
    setCertificateCode("");
    setAvailabilityStart(toDateTimeLocal(day.date, 9, 0));
    setAvailabilityEnd(toDateTimeLocal(day.date, 18, 0));
    setAvailabilityReason("");
  }

  function closeModal() {
    if (isPending) {
      return;
    }

    setEditingShiftId(null);
    setQuickComposer(null);
    setSelectedDate(null);
    setFeedback(null);
  }

  function toggleMember(memberId: string) {
    setSelectedMembers((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : current.concat(memberId)
    );
  }

  function applyPresetByKey(nextKey: string) {
    setSelectedPresetKey(nextKey);

    if (!selectedDay || nextKey === "CUSTOM") {
      return;
    }

    const preset = presets.find((entry) => entry.key === nextKey);

    if (!preset) {
      return;
    }

    setStartTime(preset.startTime);
    setEndTime(preset.endTime);
  }

  function runAction(task: () => Promise<void>, successMessage: string, closeOnSuccess = false) {
    startTransition(async () => {
      try {
        await task();
        setFeedback({ tone: "success", message: successMessage });
        if (closeOnSuccess) {
          setEditingShiftId(null);
          setSelectedDate(null);
        }
        router.refresh();
      } catch (error) {
        setFeedback({ tone: "danger", message: getErrorMessage(error) });
      }
    });
  }

  function handleCreateShift() {
    if (!selectedDay || !shiftDate || !startTime || !endTime || selectedMembers.length === 0) {
      return;
    }

    const formData = new FormData();
    formData.set("title", title);
    formData.set("startTime", combineDateAndTime(shiftDate, startTime));
    formData.set("endTime", combineDateAndTime(shiftDate, endTime));

    for (const memberId of selectedMembers) {
      formData.append("employeeIds", memberId);
    }

    runAction(async () => {
      await createShiftAction(formData);
    }, "Turno aggiunto.", true);
  }

  function handleCreateRequest() {
    if (!selectedDay || !requestStart || !requestEnd) {
      return;
    }

    const formData = new FormData();
    formData.set("type", requestType);
    formData.set("startsAt", requestStart);
    formData.set("endsAt", requestEnd);
    formData.set("reason", requestReason);
    formData.set("certificateCode", certificateCode);

    runAction(async () => {
      await createTimeOffRequestAction(formData);
      setRequestReason("");
      setCertificateCode("");
    }, "Richiesta salvata.");
  }

  function handleCreateAvailability() {
    if (!selectedDay || !availabilityStart || !availabilityEnd) {
      return;
    }

    const formData = new FormData();
    formData.set("startsAt", availabilityStart);
    formData.set("endsAt", availabilityEnd);
    formData.set("reason", availabilityReason);

    runAction(async () => {
      await createAvailabilityAction(formData);
      setAvailabilityReason("");
    }, "Indisponibilita salvata.");
  }

  function handleCompleteTask(taskId: string) {
    const formData = new FormData();
    formData.set("taskId", taskId);

    runAction(async () => {
      await completeTaskAction(formData);
    }, "Mansione completata.");
  }

  function handleQuickTaskCreate(formData: FormData) {
    runAction(async () => {
      await createTaskAction(formData);
      setQuickComposer(null);
    }, "Mansione aggiunta.");
  }

  function handleQuickBoardCreate(formData: FormData) {
    runAction(async () => {
      await createBoardNoteAction(formData);
      setQuickComposer(null);
    }, "Messaggio pubblicato.");
  }

  return (
    <>
      <div className="dashboard-desktop-only">
        <div className="dashboard-calendar-scroll">
          <div
            className="dashboard-calendar-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {weekdayLabels.map((label) => (
              <div
                key={label}
                className="dashboard-calendar-weekday"
                style={{
                  padding: "10px 12px",
                  borderRadius: 16,
                  background: "#e2e8f0",
                  color: "#334155",
                  fontWeight: 700,
                  textTransform: "capitalize",
                  textAlign: "center",
                }}
              >
                {label}
              </div>
            ))}

            {days.map((day) => (
              <button
                key={day.date}
                type="button"
                onClick={() => openDay(day)}
                className="dashboard-calendar-day"
                data-calendar-today={day.isToday ? "true" : undefined}
                style={{
                  minHeight: 220,
                  padding: 14,
                  borderRadius: 20,
                  background: day.inCurrentMonth ? "#ffffff" : "#f8fafc",
                  border: day.isToday ? "2px solid #0f172a" : "1px solid #e2e8f0",
                  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.05)",
                  display: "grid",
                  alignContent: "start",
                  gap: 10,
                  opacity: day.inCurrentMonth ? 1 : 0.72,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <strong style={{ color: "#0f172a", fontSize: 16 }}>
                    {new Date(day.date).getDate()}
                  </strong>
                  {day.isToday ? <StatusPill label="Oggi" tone="neutral" /> : null}
                </div>

                {day.shifts.length === 0 &&
                day.availabilities.length === 0 &&
                day.requests.length === 0 &&
                day.tasks.length === 0 &&
                day.notes.length === 0 ? (
                  <div style={{ color: "#94a3b8", fontSize: 14 }}>Nessun evento</div>
                ) : null}

                {day.shifts.map((shift) => renderCompactShiftCard(shift, locale))}

                {day.availabilities.map((availability) => (
                  <div
                    key={availability.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 16,
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#991b1b",
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    Indisponibilita: {availability.firstName} {availability.lastName}
                  </div>
                ))}

                {day.requests.map((request) => (
                  <div
                    key={request.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 16,
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#991b1b",
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    {formatRequestTypeLabel(request.type)}: {request.firstName} {request.lastName}
                  </div>
                ))}

                {day.tasks.length > 0 ? (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 16,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      color: "#334155",
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    Mansioni: {day.tasks.length}
                  </div>
                ) : null}

                {day.notes.length > 0 ? (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 16,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      color: "#334155",
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    Bacheca: {day.notes.length}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      <CalendarWeekStrip
        className="dashboard-mobile-only dashboard-week-strip"
        style={{
          display: "flex",
          gap: 12,
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
      >
        {visibleWeeks.map((week, weekIndex) => {
          const weekIsCurrent = week.some((day) => day.isToday);

          return (
            <section
              key={`${week[0]?.date ?? `${weekIndex}-${filteredDay ?? "all"}`}`}
              className="dashboard-week-card"
              data-current-week={weekIsCurrent ? "true" : undefined}
              style={{
                display: "grid",
                gap: 12,
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
                padding: 14,
                borderRadius: 22,
                background: weekIsCurrent ? "#eef2ff" : "#f8fafc",
                border: weekIsCurrent ? "1px solid #c7d2fe" : "1px solid #e2e8f0",
                boxShadow: weekIsCurrent
                  ? "0 10px 24px rgba(99, 102, 241, 0.08)"
                  : undefined,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                {week[0] && week[week.length - 1] ? (
                  <span style={{ color: "#64748b", lineHeight: 1.6 }}>
                    {new Intl.DateTimeFormat(locale, {
                      day: "numeric",
                      month: "long",
                    }).format(new Date(week[0].date))}
                    {" - "}
                    {new Intl.DateTimeFormat(locale, {
                      day: "numeric",
                      month: "long",
                    }).format(new Date(week[week.length - 1].date))}
                  </span>
                ) : null}
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {week.map((day) => (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => openDay(day)}
                    data-calendar-today={day.isToday ? "true" : undefined}
                    style={{
                      display: "grid",
                      gap: 10,
                      width: "100%",
                      maxWidth: "100%",
                      boxSizing: "border-box",
                      padding: 14,
                      borderRadius: 20,
                      background: "#ffffff",
                      border: day.isToday ? "2px solid #0f172a" : "1px solid #e2e8f0",
                      boxShadow: "0 8px 20px rgba(15, 23, 42, 0.05)",
                      opacity: day.inCurrentMonth ? 1 : 0.7,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <strong style={{ color: "#0f172a", fontSize: 18 }}>
                        {formatDayLabel(day.date, locale)}
                      </strong>
                      {day.isToday ? <StatusPill label="Oggi" tone="neutral" /> : null}
                    </div>

                    {day.shifts.length === 0 &&
                    day.availabilities.length === 0 &&
                    day.requests.length === 0 &&
                    day.tasks.length === 0 &&
                    day.notes.length === 0 ? (
                      <div style={{ color: "#94a3b8", fontSize: 15 }}>Nessun evento</div>
                    ) : null}

                    {day.shifts.map((shift) => renderCompactShiftCard(shift, locale, true))}

                    {day.availabilities.map((availability) => (
                      <div
                        key={availability.id}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 18,
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          color: "#991b1b",
                          lineHeight: 1.6,
                        }}
                      >
                        Indisponibilita: {availability.firstName} {availability.lastName}
                      </div>
                    ))}

                    {day.requests.map((request) => (
                      <div
                        key={request.id}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 18,
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          color: "#991b1b",
                          lineHeight: 1.6,
                        }}
                      >
                        {formatRequestTypeLabel(request.type)}: {request.firstName} {request.lastName}
                      </div>
                    ))}

                    {day.tasks.length > 0 ? (
                      <div
                        style={{
                          padding: "12px 14px",
                          borderRadius: 18,
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          color: "#334155",
                          lineHeight: 1.6,
                        }}
                      >
                        Mansioni: {day.tasks.length}
                      </div>
                    ) : null}

                    {day.notes.length > 0 ? (
                      <div
                        style={{
                          padding: "12px 14px",
                          borderRadius: 18,
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          color: "#334155",
                          lineHeight: 1.6,
                        }}
                      >
                        Bacheca: {day.notes.length}
                      </div>
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </CalendarWeekStrip>

      {mounted && selectedDay
        ? createPortal(
            <div
              className="dashboard-modal-wrap"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2147483646,
                display: "grid",
                placeItems: "center",
                padding: 16,
              }}
            >
              <button
                type="button"
                aria-label="Chiudi popup"
                onClick={closeModal}
                style={{
                  position: "absolute",
                  inset: 0,
                  border: 0,
                  background: "rgba(15, 23, 42, 0.28)",
                  backdropFilter: "blur(6px)",
                }}
              />

              <section
                className="dashboard-modal-panel"
                style={{
                  position: "relative",
                  width: "min(720px, calc(100vw - 32px))",
                  maxHeight: "calc(100vh - 32px)",
                  overflowY: "auto",
                  background: "rgba(255,255,255,0.98)",
                  border: "1px solid #e2e8f0",
                  borderRadius: 28,
                  boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18)",
                  padding: 24,
                  display: "grid",
                  gap: 18,
                  zIndex: 1,
                }}
              >
                <IconButton
                  type="button"
                  onClick={closeModal}
                  aria-label="Chiudi popup"
                  disabled={isPending}
                  style={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    width: 40,
                    height: 40,
                    color: "#475569",
                    background: "#ffffff",
                    zIndex: 2,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M6 6l12 12M18 6 6 18"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </IconButton>

                <div
                  className="dashboard-modal-header"
                  style={{
                    display: "flex",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    paddingRight: 56,
                  }}
                >
                  <div style={{ display: "grid", gap: 6 }}>
                    <strong style={{ fontSize: 22, color: "#0f172a" }}>
                      {new Intl.DateTimeFormat(locale, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }).format(new Date(selectedDay.date))}
                    </strong>
                    <span style={{ color: "#64748b" }}>
                      {canCreatePersonalEntries
                        ? "Gestisci turni, richieste e indisponibilita da questa giornata."
                        : "Aggiungi un nuovo turno oppure apri quelli esistenti per modificarli o eliminarli."}
                    </span>
                  </div>
                </div>

                {feedback ? (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 16,
                      border:
                        feedback.tone === "success"
                          ? "1px solid #bbf7d0"
                          : "1px solid #fecaca",
                      background:
                        feedback.tone === "success" ? "#f0fdf4" : "#fef2f2",
                      color: feedback.tone === "success" ? "#166534" : "#b91c1c",
                      lineHeight: 1.5,
                    }}
                  >
                    {feedback.message}
                  </div>
                ) : null}

                <div style={{ display: "grid", gap: 12 }}>
                  <label style={{ display: "grid", gap: 8 }}>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>Titolo turno</span>
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Servizio pranzo"
                      style={{
                        borderRadius: 16,
                        border: "1px solid #dbe3ee",
                        padding: "12px 14px",
                        fontSize: 15,
                        background: "#ffffff",
                      }}
                    />
                  </label>

                  {presets.length > 0 ? (
                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>Orario standard</span>
                      <Select
                        value={selectedPresetKey}
                        onChange={(event) => applyPresetByKey(event.target.value)}
                      >
                        <option value="CUSTOM">Personalizzato</option>
                        {presets.map((preset) => (
                          <option key={preset.key} value={preset.key}>
                            {preset.label} - {preset.startTime} / {preset.endTime}
                          </option>
                        ))}
                      </Select>
                    </label>
                  ) : null}

                  <div
                    className="dashboard-modal-body-grid"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>Giorno</span>
                      <input
                        type="date"
                        value={shiftDate}
                        onChange={(event) => setShiftDate(event.target.value)}
                        style={{
                          borderRadius: 16,
                          border: "1px solid #dbe3ee",
                          padding: "12px 14px",
                          fontSize: 15,
                          background: "#ffffff",
                        }}
                      />
                    </label>

                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>Orario di inizio</span>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(event) => {
                          setSelectedPresetKey("CUSTOM");
                          setStartTime(event.target.value);
                        }}
                        style={{
                          borderRadius: 16,
                          border: "1px solid #dbe3ee",
                          padding: "12px 14px",
                          fontSize: 15,
                          background: "#ffffff",
                        }}
                      />
                    </label>

                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>Orario di fine</span>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(event) => {
                          setSelectedPresetKey("CUSTOM");
                          setEndTime(event.target.value);
                        }}
                        style={{
                          borderRadius: 16,
                          border: "1px solid #dbe3ee",
                          padding: "12px 14px",
                          fontSize: 15,
                          background: "#ffffff",
                        }}
                      />
                    </label>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>Persone nel turno</span>
                    <div
                      className="dashboard-modal-members-grid"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 10,
                      }}
                    >
                      {members.map((member) => (
                        <label
                          key={member.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "12px 14px",
                            borderRadius: 16,
                            border: "1px solid #e2e8f0",
                            background: selectedMembers.includes(member.id) ? "#e2e8f0" : "#f8fafc",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedMembers.includes(member.id)}
                            onChange={() => toggleMember(member.id)}
                          />
                          {member.firstName} {member.lastName} - {formatRoleLabel(member.role)}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div
                    className="dashboard-modal-actions"
                    style={{ display: "flex", justifyContent: "flex-end" }}
                  >
                    <PrimaryButton
                      type="button"
                      onClick={handleCreateShift}
                      disabled={
                        isPending ||
                        selectedMembers.length === 0 ||
                        !shiftDate ||
                        !startTime ||
                        !endTime
                      }
                    >
                      {isPending ? "Salvataggio..." : "Aggiungi turno"}
                    </PrimaryButton>
                  </div>
                </div>

                {canCreatePersonalEntries ? (
                  <>
                    <div style={{ display: "grid", gap: 12 }}>
                      <strong style={{ fontSize: 18, color: "#0f172a" }}>Nuova richiesta</strong>

                      <div
                        className="dashboard-modal-body-grid"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: 12,
                        }}
                      >
                        <label style={{ display: "grid", gap: 8 }}>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>Tipo</span>
                          <select
                            value={requestType}
                            onChange={(event) => setRequestType(event.target.value)}
                            style={{
                              borderRadius: 16,
                              border: "1px solid #dbe3ee",
                              padding: "12px 14px",
                              fontSize: 15,
                              background: "#ffffff",
                            }}
                          >
                            <option value={RequestType.VACATION}>Ferie</option>
                            <option value={RequestType.PERMISSION}>Permesso</option>
                            <option value={RequestType.SICKNESS}>Malattia</option>
                          </select>
                        </label>

                        <label style={{ display: "grid", gap: 8 }}>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>Da</span>
                          <input
                            type="datetime-local"
                            value={requestStart}
                            onChange={(event) => setRequestStart(event.target.value)}
                            style={{
                              borderRadius: 16,
                              border: "1px solid #dbe3ee",
                              padding: "12px 14px",
                              fontSize: 15,
                              background: "#ffffff",
                            }}
                          />
                        </label>

                        <label style={{ display: "grid", gap: 8 }}>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>A</span>
                          <input
                            type="datetime-local"
                            value={requestEnd}
                            onChange={(event) => setRequestEnd(event.target.value)}
                            style={{
                              borderRadius: 16,
                              border: "1px solid #dbe3ee",
                              padding: "12px 14px",
                              fontSize: 15,
                              background: "#ffffff",
                            }}
                          />
                        </label>
                      </div>

                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontWeight: 600, color: "#1e293b" }}>Motivo</span>
                        <textarea
                          value={requestReason}
                          onChange={(event) => setRequestReason(event.target.value)}
                          placeholder="Aggiungi un dettaglio utile per il titolare"
                          style={{
                            minHeight: 120,
                            resize: "vertical",
                            borderRadius: 16,
                            border: "1px solid #dbe3ee",
                            padding: "12px 14px",
                            fontSize: 15,
                            background: "#ffffff",
                          }}
                        />
                      </label>

                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontWeight: 600, color: "#1e293b" }}>Codice certificato</span>
                        <input
                          value={certificateCode}
                          onChange={(event) => setCertificateCode(event.target.value)}
                          placeholder="Obbligatorio solo per malattia"
                          style={{
                            borderRadius: 16,
                            border: "1px solid #dbe3ee",
                            padding: "12px 14px",
                            fontSize: 15,
                            background: "#ffffff",
                          }}
                        />
                      </label>

                      <div
                        className="dashboard-modal-actions"
                        style={{ display: "flex", justifyContent: "flex-end" }}
                      >
                        <PrimaryButton
                          type="button"
                          onClick={handleCreateRequest}
                          disabled={isPending || !requestStart || !requestEnd}
                        >
                          {isPending ? "Invio..." : "Invia richiesta"}
                        </PrimaryButton>
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 12 }}>
                      <strong style={{ fontSize: 18, color: "#0f172a" }}>
                        Nuova indisponibilita
                      </strong>

                      <div
                        className="dashboard-modal-body-grid"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: 12,
                        }}
                      >
                        <label style={{ display: "grid", gap: 8 }}>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>Da</span>
                          <input
                            type="datetime-local"
                            value={availabilityStart}
                            onChange={(event) => setAvailabilityStart(event.target.value)}
                            style={{
                              borderRadius: 16,
                              border: "1px solid #dbe3ee",
                              padding: "12px 14px",
                              fontSize: 15,
                              background: "#ffffff",
                            }}
                          />
                        </label>

                        <label style={{ display: "grid", gap: 8 }}>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>A</span>
                          <input
                            type="datetime-local"
                            value={availabilityEnd}
                            onChange={(event) => setAvailabilityEnd(event.target.value)}
                            style={{
                              borderRadius: 16,
                              border: "1px solid #dbe3ee",
                              padding: "12px 14px",
                              fontSize: 15,
                              background: "#ffffff",
                            }}
                          />
                        </label>
                      </div>

                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontWeight: 600, color: "#1e293b" }}>Motivo</span>
                        <textarea
                          value={availabilityReason}
                          onChange={(event) => setAvailabilityReason(event.target.value)}
                          placeholder="Facoltativo"
                          style={{
                            minHeight: 100,
                            resize: "vertical",
                            borderRadius: 16,
                            border: "1px solid #dbe3ee",
                            padding: "12px 14px",
                            fontSize: 15,
                            background: "#ffffff",
                          }}
                        />
                      </label>

                      <div
                        className="dashboard-modal-actions"
                        style={{ display: "flex", justifyContent: "flex-end" }}
                      >
                        <PrimaryButton
                          type="button"
                          onClick={handleCreateAvailability}
                          disabled={isPending || !availabilityStart || !availabilityEnd}
                        >
                          {isPending ? "Salvataggio..." : "Salva indisponibilita"}
                        </PrimaryButton>
                      </div>
                    </div>
                  </>
                ) : null}

                <div style={{ display: "grid", gap: 10 }}>
                  <strong style={{ fontSize: 18, color: "#0f172a" }}>Turni del giorno</strong>
                  {selectedDay.shifts.length === 0 ? (
                    <div style={{ color: "#64748b" }}>Nessun turno presente in questa giornata.</div>
                  ) : (
                    <div className="dashboard-scroll-list" style={{ display: "grid", gap: 10 }}>
                      {selectedDay.shifts.map((shift) => (
                        <button
                          type="button"
                          className="dashboard-list-card"
                          key={shift.id}
                          onClick={() => setEditingShiftId(shift.id)}
                          disabled={isPending}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "center",
                            flexWrap: "wrap",
                            padding: 14,
                            borderRadius: 18,
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            textAlign: "left",
                            cursor: isPending ? "default" : "pointer",
                          }}
                        >
                          <div style={{ display: "grid", gap: 6 }}>
                            <strong style={{ color: "#0f172a" }}>{shift.title || "Turno"}</strong>
                            <span style={{ color: "#475569" }}>
                              {formatDayTime(shift.startTime, locale)} - {formatDayTime(shift.endTime, locale)}
                            </span>
                            <span style={{ color: "#64748b", fontSize: 14 }}>
                              {shift.assignments
                                .map((assignment) => `${assignment.firstName} ${assignment.lastName}`)
                                .join(", ")}
                            </span>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {shift.confirmedAt ? (
                                <StatusPill label="Confermato" tone="success" />
                              ) : (
                                <StatusPill label="Da confermare" tone="warning" />
                              )}
                            </div>
                          </div>

                          <span
                            aria-hidden="true"
                            style={{
                              marginLeft: "auto",
                              color: "#475569",
                              fontSize: 18,
                              fontWeight: 700,
                            }}
                          >
                            ›
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <strong style={{ fontSize: 18, color: "#0f172a" }}>Mansioni del giorno</strong>
                    <IconButton
                      type="button"
                      onClick={() => setQuickComposer("task")}
                      aria-label="Aggiungi mansioni"
                      disabled={isPending}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M12 5v14M5 12h14"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </IconButton>
                  </div>
                  {selectedDay.tasks.length === 0 ? (
                    <div style={{ color: "#64748b" }}>Nessuna mansione collegata a questa giornata.</div>
                  ) : (
                    <div className="dashboard-scroll-list" style={{ display: "grid", gap: 10 }}>
                      {selectedDay.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="dashboard-list-card"
                          style={{
                            padding: 14,
                            borderRadius: 18,
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            display: "grid",
                            gap: 8,
                          }}
                        >
                          <div style={{ display: "grid", gap: 6 }}>
                            <strong style={{ color: "#0f172a" }}>{task.title}</strong>
                            <span style={{ color: "#475569" }}>{task.assignedLabel}</span>
                            {task.completedByLabel ? (
                              <span style={{ color: "#64748b", fontSize: 14 }}>
                                Completata da {task.completedByLabel}
                              </span>
                            ) : null}
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <StatusPill
                              label={task.status}
                              tone={
                                task.status === "DONE"
                                  ? "success"
                                  : task.isUrgent
                                    ? "danger"
                                    : "warning"
                              }
                            />
                          </div>
                          {task.status !== "DONE" ? (
                            <div className="dashboard-action-row">
                              <PrimaryButton
                                type="button"
                                tone="green"
                                onClick={() => handleCompleteTask(task.id)}
                                disabled={isPending}
                              >
                                {isPending ? "Salvataggio..." : "Conferma mansione"}
                              </PrimaryButton>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <strong style={{ fontSize: 18, color: "#0f172a" }}>Bacheca del giorno</strong>
                    <IconButton
                      type="button"
                      onClick={() => setQuickComposer("board")}
                      aria-label="Aggiungi in bacheca"
                      disabled={isPending}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M12 5v14M5 12h14"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </IconButton>
                  </div>
                  {selectedDay.notes.length === 0 ? (
                    <div style={{ color: "#64748b" }}>Nessun messaggio pubblicato in questa giornata.</div>
                  ) : (
                    <div className="dashboard-scroll-list" style={{ display: "grid", gap: 10 }}>
                      {selectedDay.notes.map((note) => (
                        <div
                          key={note.id}
                          className="dashboard-list-card"
                          style={{
                            padding: 14,
                            borderRadius: 18,
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            display: "grid",
                            gap: 8,
                          }}
                        >
                          <div style={{ color: "#334155", lineHeight: 1.6 }}>{note.content}</div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            {note.isPinned ? <StatusPill label="Fissato" tone="warning" /> : null}
                            <span style={{ color: "#64748b", fontSize: 14 }}>
                              {note.authorName} - {formatNoteTime(note.createdAt, locale)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>,
            document.body
          )
        : null}

      <ShiftEditorModal
        open={Boolean(editingShift)}
        locale={locale}
        canManage
        shift={editingShift}
        members={members}
        presets={presets}
        onClose={() => setEditingShiftId(null)}
      />
      <QuickCalendarEntryModal
        open={Boolean(selectedDay && quickComposer)}
        mode={quickComposer}
        dateIso={selectedDay?.date ?? null}
        members={members}
        canPinBoard
        isPending={isPending}
        onClose={() => setQuickComposer(null)}
        onSubmitTask={handleQuickTaskCreate}
        onSubmitBoard={handleQuickBoardCreate}
      />
    </>
  );
}
