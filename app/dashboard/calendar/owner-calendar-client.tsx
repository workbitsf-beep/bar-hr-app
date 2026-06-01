"use client";

import { RequestType } from "@prisma/client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { combineDateAndTime, toDateInputValue } from "@/lib/shift-datetime";
import type { ShiftPreset } from "@/lib/shift-presets";
import { TimeInput } from "@/app/components/time-input";
import {
  completeTaskAction,
  createAvailabilityAction,
  createBoardNoteAction,
  createCalendarClosureAction,
  createCourseAction,
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
  userId: string;
  firstName: string;
  lastName: string;
  startsAt: string;
  endsAt: string;
};

type RequestItem = {
  id: string;
  type: string;
  userId: string;
  firstName: string;
  lastName: string;
  startsAt: string;
  endsAt: string;
  approvedBy: string | null;
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

type CourseItem = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string | null;
  audienceLabel: string;
};

type ClosureItem = {
  id: string;
  title: string;
  type: string;
  startTime: string;
  endTime: string;
};

type DayItem = {
  date: string;
  isToday: boolean;
  inCurrentMonth: boolean;
  shifts: ShiftItem[];
  availabilities: AvailabilityItem[];
  requests: RequestItem[];
  courses: CourseItem[];
  closures: ClosureItem[];
  tasks: TaskItem[];
  notes: NoteItem[];
};

type FeedbackState =
  | {
      tone: "success" | "danger";
      message: string;
    }
  | null;

type ShiftDraft = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  presetKey: string;
  memberIds: string[];
};

function createShiftDraft(dateIso: string): ShiftDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    date: toDateInputValue(dateIso),
    startTime: "09:00",
    endTime: "17:00",
    presetKey: "CUSTOM",
    memberIds: [],
  };
}

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
  if (type === RequestType.OVERTIME) {
    return "Straordinario";
  }

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

function hasTimeOverlap(rangeStart: string, rangeEnd: string, shiftStart: string, shiftEnd: string) {
  return new Date(rangeStart) < new Date(shiftEnd) && new Date(rangeEnd) > new Date(shiftStart);
}

function renderShiftStateIcon(confirmed: boolean, size = 16) {
  return confirmed ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 12.5l4 4 8-9"
        stroke="#16a34a"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="#f59e0b" strokeWidth="2" />
      <path d="M12 8v4l2.5 2.5" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
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
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {renderShiftStateIcon(Boolean(shift.confirmedAt), mobile ? 18 : 16)}
        </span>
      </div>
    </div>
  );
}

function renderAvailabilityCard(availability: AvailabilityItem, mobile = false) {
  return (
    <div
      key={availability.id}
      style={{
        padding: mobile ? "12px 14px" : "10px 12px",
        borderRadius: mobile ? 18 : 16,
        background: "#fef2f2",
        border: "1px solid #fecaca",
        color: "#991b1b",
        lineHeight: 1.6,
        fontSize: mobile ? 14 : 13,
      }}
    >
      Indisponibilita: {availability.firstName} {availability.lastName}
    </div>
  );
}

function renderApprovedRequestCard(request: RequestItem, mobile = false) {
  return (
    <div
      key={request.id}
      style={{
        padding: mobile ? "12px 14px" : "10px 12px",
        borderRadius: mobile ? 18 : 16,
        background: "#fef2f2",
        border: "1px solid #fecaca",
        color: "#991b1b",
        lineHeight: 1.6,
        fontSize: mobile ? 14 : 13,
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <strong style={{ color: "#991b1b", fontSize: mobile ? 14 : 13 }}>
          {formatRequestTypeLabel(request.type)}: {request.firstName} {request.lastName}
        </strong>
        {request.approvedBy ? (
          <span style={{ color: "#b91c1c" }}>Approvata da: {request.approvedBy}</span>
        ) : null}
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

function CountBadge({ count }: { count: number }) {
  return (
    <span
      style={{
        minWidth: 28,
        height: 28,
        padding: "0 9px",
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: count > 0 ? "#0f172a" : "#e2e8f0",
        color: count > 0 ? "#ffffff" : "#64748b",
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      {count}
    </span>
  );
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
  const [showShiftComposer, setShowShiftComposer] = useState(false);
  const [quickComposer, setQuickComposer] = useState<"task" | "board" | null>(null);
  const [showCourseComposer, setShowCourseComposer] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [shiftDrafts, setShiftDrafts] = useState<ShiftDraft[]>([]);
  const [requestType, setRequestType] = useState<string>(RequestType.VACATION);
  const [requestStart, setRequestStart] = useState("");
  const [requestEnd, setRequestEnd] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [certificateCode, setCertificateCode] = useState("");
  const [availabilityStart, setAvailabilityStart] = useState("");
  const [availabilityEnd, setAvailabilityEnd] = useState("");
  const [availabilityReason, setAvailabilityReason] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [courseLocation, setCourseLocation] = useState("");
  const [courseStart, setCourseStart] = useState("");
  const [courseEnd, setCourseEnd] = useState("");
  const [courseAssignedToAll, setCourseAssignedToAll] = useState(true);
  const [courseAssignedToId, setCourseAssignedToId] = useState("");
  const [showClosureComposer, setShowClosureComposer] = useState(false);
  const [closureTitle, setClosureTitle] = useState("");
  const [closureType, setClosureType] = useState("CLOSURE");
  const [closureStart, setClosureStart] = useState("");
  const [closureEnd, setClosureEnd] = useState("");

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
  function getBlockedMemberReasons(draft: ShiftDraft) {
    if (!selectedDay || !draft.date || !draft.startTime || !draft.endTime) {
      return new Map<string, string>();
    }

    const selectedDayKey = selectedDay.date.slice(0, 10);

    if (selectedDayKey !== draft.date) {
      return new Map<string, string>();
    }

    const nextShiftStart = combineDateAndTime(draft.date, draft.startTime);
    const nextShiftEnd = combineDateAndTime(draft.date, draft.endTime);
    const blocked = new Map<string, string>();

    for (const availability of selectedDay.availabilities) {
      if (hasTimeOverlap(availability.startsAt, availability.endsAt, nextShiftStart, nextShiftEnd)) {
        blocked.set(availability.userId, "Indisponibile");
      }
    }

    for (const request of selectedDay.requests) {
      if (hasTimeOverlap(request.startsAt, request.endsAt, nextShiftStart, nextShiftEnd)) {
        blocked.set(request.userId, formatRequestTypeLabel(request.type));
      }
    }

    return blocked;
  }
  const canCreatePersonalEntries = role === "MANAGER";

  function openDay(day: DayItem) {
    setSelectedDate(day.date);
    setEditingShiftId(null);
    setShowShiftComposer(false);
    setQuickComposer(null);
    setShowCourseComposer(false);
    setShowClosureComposer(false);
    setFeedback(null);
    setShiftDrafts([createShiftDraft(day.date)]);
    setRequestType(RequestType.VACATION);
    setRequestStart(toDateTimeLocal(day.date, 9, 0));
    setRequestEnd(toDateTimeLocal(day.date, 18, 0));
    setRequestReason("");
    setCertificateCode("");
    setAvailabilityStart(toDateTimeLocal(day.date, 9, 0));
    setAvailabilityEnd(toDateTimeLocal(day.date, 18, 0));
    setAvailabilityReason("");
    setCourseTitle("");
    setCourseDescription("");
    setCourseLocation("");
    setCourseStart(toDateTimeLocal(day.date, 9, 0));
    setCourseEnd(toDateTimeLocal(day.date, 13, 0));
    setCourseAssignedToAll(true);
    setCourseAssignedToId("");
    setClosureTitle("");
    setClosureType("CLOSURE");
    setClosureStart(toDateTimeLocal(day.date, 0, 0));
    setClosureEnd(toDateTimeLocal(day.date, 23, 59));
  }

  function closeModal() {
    if (isPending) {
      return;
    }

    setEditingShiftId(null);
    setShowShiftComposer(false);
    setQuickComposer(null);
    setShowCourseComposer(false);
    setShowClosureComposer(false);
    setSelectedDate(null);
    setFeedback(null);
  }

  function addShiftDraft() {
    if (!selectedDay) {
      return;
    }

    setShiftDrafts((current) => current.concat(createShiftDraft(selectedDay.date)));
  }

  function removeShiftDraft(draftId: string) {
    setShiftDrafts((current) =>
      current.length <= 1 ? current : current.filter((draft) => draft.id !== draftId)
    );
  }

  function updateShiftDraft(draftId: string, patch: Partial<ShiftDraft>) {
    setShiftDrafts((current) =>
      current.map((draft) => {
        if (draft.id !== draftId) {
          return draft;
        }

        const next = { ...draft, ...patch };
        const blocked = getBlockedMemberReasons(next);

        return {
          ...next,
          memberIds: next.memberIds.filter((memberId) => !blocked.has(memberId)),
        };
      })
    );
  }

  function toggleDraftMember(draftId: string, memberId: string) {
    setShiftDrafts((current) =>
      current.map((draft) =>
        draft.id === draftId
          ? {
              ...draft,
              memberIds: draft.memberIds.includes(memberId)
                ? draft.memberIds.filter((id) => id !== memberId)
                : draft.memberIds.concat(memberId),
            }
          : draft
      )
    );
  }

  function applyPresetByKey(draftId: string, nextKey: string) {
    if (nextKey === "CUSTOM") {
      updateShiftDraft(draftId, { presetKey: nextKey });
      return;
    }

    const preset = presets.find((entry) => entry.key === nextKey);

    if (!preset) {
      return;
    }

    updateShiftDraft(draftId, {
      presetKey: nextKey,
      startTime: preset.startTime,
      endTime: preset.endTime,
    });
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

  function handleCreateShifts() {
    if (!selectedDay) {
      return;
    }

    const validDrafts = shiftDrafts.filter(
      (draft) => draft.date && draft.startTime && draft.endTime && draft.memberIds.length > 0
    );

    if (validDrafts.length === 0) {
      return;
    }

    runAction(async () => {
      for (const draft of validDrafts) {
        const formData = new FormData();
        formData.set("title", "");
        formData.set("startTime", combineDateAndTime(draft.date, draft.startTime));
        formData.set("endTime", combineDateAndTime(draft.date, draft.endTime));

        for (const memberId of draft.memberIds) {
          formData.append("employeeIds", memberId);
        }

        await createShiftAction(formData);
      }

      setShiftDrafts([createShiftDraft(selectedDay.date)]);
      setShowShiftComposer(false);
    }, validDrafts.length === 1 ? "Turno aggiunto." : "Turni aggiunti.");
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

  function handleCreateCourse() {
    if (!selectedDay || !courseTitle.trim() || !courseStart || !courseEnd) {
      return;
    }

    const formData = new FormData();
    formData.set("title", courseTitle);
    formData.set("description", courseDescription);
    formData.set("location", courseLocation);
    formData.set("startsAt", courseStart);
    formData.set("endsAt", courseEnd);

    if (courseAssignedToAll) {
      formData.set("assignedToAll", "on");
    } else if (courseAssignedToId) {
      formData.set("assignedToId", courseAssignedToId);
    }

    runAction(async () => {
      await createCourseAction(formData);
      setCourseTitle("");
      setCourseDescription("");
      setCourseLocation("");
      setCourseAssignedToAll(true);
      setCourseAssignedToId("");
      setShowCourseComposer(false);
    }, "Corso aggiunto.");
  }

  function handleCreateClosure() {
    if (!selectedDay || !closureStart || !closureEnd) {
      return;
    }

    const formData = new FormData();
    formData.set("title", closureTitle);
    formData.set("type", closureType);
    formData.set("startsAt", closureStart);
    formData.set("endsAt", closureEnd);

    runAction(async () => {
      await createCalendarClosureAction(formData);
      setClosureTitle("");
      setShowClosureComposer(false);
    }, "Giorno speciale aggiunto.");
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

  if (!days.length) {
    return null;
  }

  const day = selectedDay ?? days[0];

  return (
    <>
      <CalendarWeekStrip
        className="dashboard-week-strip"
        style={{
          display: "flex",
          gap: 14,
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
                flex: "0 0 min(100%, 420px)",
                width: "min(100%, 420px)",
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
                    day.courses.length === 0 &&
                    day.closures.length === 0 &&
                    day.tasks.length === 0 &&
                    day.notes.length === 0 ? (
                      <div style={{ color: "#94a3b8", fontSize: 15 }}>Nessun evento</div>
                    ) : null}

                    {day.shifts.map((shift) => renderCompactShiftCard(shift, locale, true))}

                    {day.closures.map((closure) => (
                      <div
                        key={closure.id}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 18,
                          background: "#fff7ed",
                          border: "1px solid #fed7aa",
                          color: "#9a3412",
                          lineHeight: 1.6,
                        }}
                      >
                        {closure.title}
                      </div>
                    ))}

                    {day.courses.length > 0 ? (
                      <div
                        style={{
                          padding: "12px 14px",
                          borderRadius: 18,
                          background: "#eef2ff",
                          border: "1px solid #c7d2fe",
                          color: "#3730a3",
                          lineHeight: 1.6,
                        }}
                      >
                        Corsi: {day.courses.length}
                      </div>
                    ) : null}

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
                      }).format(new Date(day.date))}
                    </strong>
                    <span style={{ color: "#64748b" }}>
                      {false
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

                <div
                  style={{
                    position: "fixed",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    zIndex: 2147483647,
                    display: showShiftComposer ? "grid" : "none",
                    gap: 12,
                    width: "min(720px, calc(100vw - 32px))",
                    maxHeight: "calc(100dvh - 32px)",
                    overflowY: "auto",
                    padding: 18,
                    borderRadius: 28,
                    background: "rgba(255,255,255,0.98)",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.24)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <strong style={{ fontSize: 18, color: "#0f172a" }}>Nuovi turni</strong>
                    <div style={{ display: "flex", gap: 8 }}>
                      <IconButton
                        type="button"
                        onClick={addShiftDraft}
                        aria-label="Aggiungi un altro turno"
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
                      <IconButton
                        type="button"
                        onClick={() => setShowShiftComposer(false)}
                        aria-label="Chiudi inserimento turni"
                        disabled={isPending}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M6 6l12 12M18 6 6 18"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      </IconButton>
                    </div>
                  </div>

                  {shiftDrafts.map((draft, index) => {
                    const blockedMemberReasons = getBlockedMemberReasons(draft);

                    return (
                      <div
                        key={draft.id}
                        style={{
                          display: "grid",
                          gap: 12,
                          padding: 16,
                          borderRadius: 22,
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                          }}
                        >
                          <strong style={{ color: "#0f172a" }}>Turno {index + 1}</strong>
                          {shiftDrafts.length > 1 ? (
                            <IconButton
                              type="button"
                              onClick={() => removeShiftDraft(draft.id)}
                              aria-label="Rimuovi turno"
                              disabled={isPending}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path
                                  d="M6 6l12 12M18 6 6 18"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </IconButton>
                          ) : null}
                        </div>

                        {presets.length > 0 ? (
                          <label style={{ display: "grid", gap: 8 }}>
                            <span style={{ fontWeight: 600, color: "#1e293b" }}>Orario standard</span>
                            <Select
                              value={draft.presetKey}
                              onChange={(event) => applyPresetByKey(draft.id, event.target.value)}
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
                              value={draft.date}
                              onChange={(event) =>
                                updateShiftDraft(draft.id, { date: event.target.value })
                              }
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
                            <TimeInput
                              value={draft.startTime}
                              onChange={(value) =>
                                updateShiftDraft(draft.id, {
                                  presetKey: "CUSTOM",
                                  startTime: value,
                                })
                              }
                            />
                          </label>

                          <label style={{ display: "grid", gap: 8 }}>
                            <span style={{ fontWeight: 600, color: "#1e293b" }}>Orario di fine</span>
                            <TimeInput
                              value={draft.endTime}
                              onChange={(value) =>
                                updateShiftDraft(draft.id, {
                                  presetKey: "CUSTOM",
                                  endTime: value,
                                })
                              }
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
                                  background: draft.memberIds.includes(member.id) ? "#e2e8f0" : "#ffffff",
                                  color: blockedMemberReasons.has(member.id) ? "#94a3b8" : "#0f172a",
                                  opacity: blockedMemberReasons.has(member.id) ? 0.6 : 1,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={draft.memberIds.includes(member.id)}
                                  disabled={blockedMemberReasons.has(member.id)}
                                  onChange={() => toggleDraftMember(draft.id, member.id)}
                                />
                                <span style={{ display: "grid", gap: 2 }}>
                                  <span>
                                    {member.firstName} {member.lastName} - {formatRoleLabel(member.role)}
                                  </span>
                                  {blockedMemberReasons.has(member.id) ? (
                                    <span style={{ fontSize: 12, color: "#b45309" }}>
                                      {blockedMemberReasons.get(member.id)}
                                    </span>
                                  ) : null}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div
                    className="dashboard-modal-actions"
                    style={{ display: "flex", justifyContent: "flex-end" }}
                  >
                    <PrimaryButton
                      type="button"
                      onClick={handleCreateShifts}
                      disabled={
                        isPending ||
                        !shiftDrafts.some(
                          (draft) =>
                            draft.memberIds.length > 0 &&
                            draft.date &&
                            draft.startTime &&
                            draft.endTime
                        )
                      }
                    >
                      {isPending ? "Salvataggio..." : "Salva turni"}
                    </PrimaryButton>
                  </div>
                </div>

                {canCreatePersonalEntries ? (
                  <>
                    <div style={{ display: "grid", gap: 12 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <strong style={{ fontSize: 18, color: "#0f172a" }}>Nuova richiesta</strong>
                        <IconButton
                          type="button"
                          onClick={() => setRequestType(RequestType.OVERTIME)}
                          aria-label="Aggiungi straordinario"
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
                            <option value={RequestType.OVERTIME}>Straordinario</option>
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

                {false ? (
                  <div style={{ display: "grid", gap: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <strong style={{ fontSize: 18, color: "#0f172a" }}>Turni del giorno</strong>
                    <IconButton
                      type="button"
                      onClick={() => setShowShiftComposer(true)}
                      aria-label="Aggiungi turni"
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
                  {day.shifts.length === 0 ? (
                    <div style={{ color: "#64748b" }}>Nessun turno presente in questa giornata.</div>
                  ) : (
                    <div className="dashboard-scroll-list" style={{ display: "grid", gap: 10 }}>
                      {day.shifts.map((shift) => (
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
                            <strong style={{ color: "#0f172a" }}>
                              {formatDayTime(shift.startTime, locale)} - {formatDayTime(shift.endTime, locale)}
                            </strong>
                            <span style={{ color: "#64748b", fontSize: 14 }}>
                              {formatAssignmentNames(shift.assignments)}
                            </span>
                          </div>

                          <span
                            aria-hidden="true"
                            style={{
                              marginLeft: "auto",
                              color: "#475569",
                              fontSize: 0,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {renderShiftStateIcon(Boolean(shift.confirmedAt), 18)}
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path
                                d="m9 6 6 6-6 6"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            ›
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  </div>
                ) : null}

                <div style={{ display: "none" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <strong style={{ fontSize: 18, color: "#0f172a" }}>Mancanze del giorno</strong>
                    <CountBadge count={day.availabilities.length + day.requests.length} />
                  </div>

                  {day.availabilities.length === 0 && day.requests.length === 0 ? (
                    <div style={{ color: "#64748b" }}>
                      Nessuna mancanza registrata in questa giornata.
                    </div>
                  ) : (
                    <div className="dashboard-scroll-list" style={{ display: "grid", gap: 10 }}>
                      {day.availabilities.map((availability) =>
                        renderAvailabilityCard(availability, true)
                      )}
                      {day.requests.map((request) =>
                        renderApprovedRequestCard(request, true)
                      )}
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
                    <CountBadge count={day.tasks.length} />
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
                  {day.tasks.length === 0 ? (
                    <div style={{ color: "#64748b" }}>Nessuna mansione collegata a questa giornata.</div>
                  ) : (
                    <div className="dashboard-scroll-list" style={{ display: "grid", gap: 10 }}>
                      {day.tasks.map((task) => (
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
                    <CountBadge count={day.notes.length} />
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
                  {day.notes.length === 0 ? (
                    <div style={{ color: "#64748b" }}>Nessun messaggio pubblicato in questa giornata.</div>
                  ) : (
                    <div className="dashboard-scroll-list" style={{ display: "grid", gap: 10 }}>
                      {day.notes.map((note) => (
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
        dateIso={day.date ?? null}
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
