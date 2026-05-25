"use client";

import { ActivityType, RequestStatus, RequestType, Role } from "@prisma/client";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  completeTaskAction,
  createAvailabilityAction,
  createBoardNoteAction,
  createCourseAction,
  createTaskAction,
  createTimeOffRequestAction,
  reviewRequestAction,
} from "../actions";
import { PrimaryButton, Select, StatusPill, TextArea, TextInput } from "../ui";
import { CalendarWeekStrip } from "./calendar-week-strip";
import { QuickCalendarEntryModal } from "./quick-calendar-entry-modal";

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
  approvedBy: string | null;
};

type PendingRequestItem = {
  id: string;
  type: string;
  firstName: string;
  lastName: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  certificateCode: string | null;
};

type CourseItem = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string | null;
  audienceLabel: string;
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
  pendingRequests: PendingRequestItem[];
  courses: CourseItem[];
  tasks: TaskItem[];
  notes: NoteItem[];
};

type FeedbackState =
  | {
      tone: "success" | "danger";
      message: string;
    }
  | null;

function chunkByWeek<T>(items: T[]) {
  return Array.from({ length: Math.ceil(items.length / 7) }, (_, index) =>
    items.slice(index * 7, index * 7 + 7)
  );
}

function formatDayLabel(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(value));
}

function formatTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatRange(start: string, end: string, locale: string) {
  return `${formatTime(start, locale)} - ${formatTime(end, locale)}`;
}

function formatRoleLabel(role: string) {
  if (role === Role.MANAGER) {
    return "Manager";
  }

  if (role === Role.OWNER) {
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

function toDateTimeLocal(dateIso: string, hour: number, minute: number) {
  const date = new Date(dateIso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Operazione non riuscita.";
}

function renderShiftCard(shift: ShiftItem, locale: string, mobile = false) {
  return (
    <div
      key={shift.id}
      style={{
        padding: mobile ? 14 : "10px 12px",
        borderRadius: mobile ? 18 : 16,
        background: "#eff6ff",
        border: "1px solid #dbeafe",
        display: "grid",
        gap: mobile ? 8 : 4,
      }}
    >
      <strong style={{ color: "#0f172a", fontSize: mobile ? 16 : 14 }}>
        {shift.title || "Turno"}
      </strong>
      <div style={{ color: "#334155", fontWeight: 600, fontSize: mobile ? 15 : 13 }}>
        {formatRange(shift.startTime, shift.endTime, locale)}
      </div>
      <div style={{ display: "grid", gap: mobile ? 6 : 4 }}>
        {shift.assignments.map((assignment) => (
          <span
            key={`${shift.id}-${assignment.id}`}
            style={{ color: "#475569", lineHeight: 1.5, fontSize: mobile ? 14 : 12 }}
          >
            {assignment.firstName} {assignment.lastName}
            {mobile ? ` - ${formatRoleLabel(assignment.role)}` : ""}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {shift.confirmedAt ? (
          <StatusPill label="Confermato" tone="success" />
        ) : (
          <StatusPill label="Da confermare" tone="warning" />
        )}
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

function renderCourseCard(course: CourseItem, locale: string, mobile = false) {
  return (
    <div
      key={course.id}
      style={{
        padding: mobile ? 14 : "10px 12px",
        borderRadius: mobile ? 18 : 16,
        background: "#eef2ff",
        border: "1px solid #c7d2fe",
        display: "grid",
        gap: mobile ? 6 : 4,
      }}
    >
      <strong style={{ color: "#0f172a", fontSize: mobile ? 16 : 14 }}>{course.title}</strong>
      <span style={{ color: "#475569", fontSize: mobile ? 14 : 13 }}>
        {formatRange(course.startTime, course.endTime, locale)}
      </span>
      <span style={{ color: "#64748b", fontSize: mobile ? 13 : 12, lineHeight: 1.5 }}>
        {course.audienceLabel}
        {course.location ? ` - ${course.location}` : ""}
      </span>
    </div>
  );
}

function renderPendingRequestCard(request: PendingRequestItem, mobile = false) {
  return (
    <div
      key={request.id}
      style={{
        padding: mobile ? "12px 14px" : "10px 12px",
        borderRadius: mobile ? 18 : 16,
        background: "#fff7ed",
        border: "1px solid #fed7aa",
        color: "#9a3412",
        lineHeight: 1.6,
        fontSize: mobile ? 14 : 13,
      }}
    >
      Da approvare: {request.firstName} {request.lastName}
    </div>
  );
}

function renderTaskCard(task: TaskItem, mobile = false) {
  return (
    <div
      key={task.id}
      style={{
        padding: mobile ? 14 : "10px 12px",
        borderRadius: mobile ? 18 : 16,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        display: "grid",
        gap: mobile ? 8 : 4,
      }}
    >
      <strong style={{ color: "#0f172a", fontSize: mobile ? 16 : 14 }}>{task.title}</strong>
      <span style={{ color: "#475569", fontSize: mobile ? 14 : 13 }}>{task.assignedLabel}</span>
      {task.completedByLabel ? (
        <span style={{ color: "#64748b", fontSize: mobile ? 13 : 12 }}>
          Completata da {task.completedByLabel}
        </span>
      ) : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <StatusPill
          label={task.status}
          tone={task.status === "DONE" ? "success" : task.isUrgent ? "danger" : "warning"}
        />
      </div>
    </div>
  );
}

function renderNoteCard(note: NoteItem, locale: string, mobile = false) {
  return (
    <div
      key={note.id}
      style={{
        padding: mobile ? 14 : "10px 12px",
        borderRadius: mobile ? 18 : 16,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        display: "grid",
        gap: mobile ? 8 : 4,
      }}
    >
      <div style={{ color: "#334155", lineHeight: 1.6, fontSize: mobile ? 14 : 13 }}>
        {note.content}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {note.isPinned ? <StatusPill label="Fissato" tone="warning" /> : null}
        <span style={{ color: "#64748b", fontSize: mobile ? 13 : 12 }}>
          {note.authorName} - {formatTime(note.createdAt, locale)}
        </span>
      </div>
    </div>
  );
}

export function DayActionCalendarClient({
  locale,
  weekdayLabels,
  days,
  filteredDay,
  role,
  activityType,
  members,
}: {
  locale: string;
  weekdayLabels: string[];
  days: DayItem[];
  filteredDay?: string | null;
  role: string;
  activityType: ActivityType;
  members: MemberOption[];
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [quickComposer, setQuickComposer] = useState<"task" | "board" | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
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

  const selectedDay = useMemo(
    () => days.find((day) => day.date === selectedDate) ?? null,
    [days, selectedDate]
  );
  const weeks = useMemo(() => chunkByWeek(days), [days]);
  const visibleWeeks = useMemo(
    () =>
      filteredDay
        ? weeks.filter((week) => week.some((day) => day.date.slice(0, 10) === filteredDay))
        : weeks,
    [filteredDay, weeks]
  );

  const isCompany = activityType === ActivityType.COMPANY;
  const canCreateRequest = role !== Role.OWNER;
  const canCreateAvailability = !isCompany;
  const canCreateCourse = isCompany && role === Role.OWNER;
  const canReviewRequests = isCompany && role === Role.OWNER;
  const canOpenTaskComposer = role === Role.OWNER || role === Role.MANAGER;

  function openDay(day: DayItem) {
    setSelectedDate(day.date);
    setQuickComposer(null);
    setFeedback(null);
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
  }

  function closeModal() {
    if (isPending) {
      return;
    }

    setSelectedDate(null);
    setQuickComposer(null);
    setFeedback(null);
  }

  function runAction(task: () => Promise<void>, successMessage: string) {
    startTransition(async () => {
      try {
        await task();
        setFeedback({ tone: "success", message: successMessage });
        router.refresh();
      } catch (error) {
        setFeedback({ tone: "danger", message: getErrorMessage(error) });
      }
    });
  }

  function submitRequest() {
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

  function submitAvailability() {
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

  function submitCourse() {
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
    }, "Corso inserito.");
  }

  function submitReview(requestId: string, decision: RequestStatus) {
    const formData = new FormData();
    formData.set("requestId", requestId);
    formData.set("decision", decision);

    runAction(
      async () => {
        await reviewRequestAction(formData);
      },
      decision === RequestStatus.APPROVED ? "Richiesta approvata." : "Richiesta rifiutata."
    );
  }

  function submitTaskCompletion(taskId: string) {
    const formData = new FormData();
    formData.set("taskId", taskId);

    runAction(async () => {
      await completeTaskAction(formData);
    }, "Mansione completata.");
  }

  function submitQuickTask(formData: FormData) {
    runAction(async () => {
      await createTaskAction(formData);
      setQuickComposer(null);
    }, "Mansione aggiunta.");
  }

  function submitQuickBoard(formData: FormData) {
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
                day.pendingRequests.length === 0 &&
                day.courses.length === 0 &&
                day.tasks.length === 0 &&
                day.notes.length === 0 ? (
                  <div style={{ color: "#94a3b8", fontSize: 14 }}>Nessun evento</div>
                ) : null}

                {day.shifts.map((shift) => renderShiftCard(shift, locale))}
                {day.courses.map((course) => renderCourseCard(course, locale))}
                {day.pendingRequests.map((request) => renderPendingRequestCard(request))}
                {day.availabilities.map((availability) => renderAvailabilityCard(availability))}
                {day.requests.map((request) => renderApprovedRequestCard(request))}
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
                    day.pendingRequests.length === 0 &&
                    day.courses.length === 0 &&
                    day.tasks.length === 0 &&
                    day.notes.length === 0 ? (
                      <div style={{ color: "#94a3b8", fontSize: 15 }}>Nessun evento</div>
                    ) : null}

                    {day.shifts.map((shift) => renderShiftCard(shift, locale, true))}
                    {day.courses.map((course) => renderCourseCard(course, locale, true))}
                    {day.pendingRequests.map((request) => renderPendingRequestCard(request, true))}
                    {day.availabilities.map((availability) =>
                      renderAvailabilityCard(availability, true)
                    )}
                    {day.requests.map((request) => renderApprovedRequestCard(request, true))}
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
                aria-label="Chiudi popup calendario"
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
                <div
                  className="dashboard-modal-header"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
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
                      {isCompany
                        ? "Gestisci richieste e corsi direttamente da questa giornata."
                        : "Gestisci richieste o indisponibilita direttamente da questa giornata."}
                    </span>
                  </div>

                  <PrimaryButton
                    type="button"
                    tone="sand"
                    onClick={closeModal}
                    disabled={isPending}
                  >
                    Chiudi
                  </PrimaryButton>
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

                <div className="dashboard-modal-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {canOpenTaskComposer ? (
                    <PrimaryButton
                      type="button"
                      tone="sand"
                      onClick={() => setQuickComposer("task")}
                      disabled={isPending}
                    >
                      Aggiungi mansioni
                    </PrimaryButton>
                  ) : null}
                  <PrimaryButton
                    type="button"
                    tone="sand"
                    onClick={() => setQuickComposer("board")}
                    disabled={isPending}
                  >
                    Aggiungi in bacheca
                  </PrimaryButton>
                </div>

                {canReviewRequests ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    <strong style={{ fontSize: 18, color: "#0f172a" }}>
                      Richieste da approvare
                    </strong>

                    {selectedDay.pendingRequests.length === 0 ? (
                      <div style={{ color: "#64748b" }}>
                        Nessuna richiesta in attesa per questa giornata.
                      </div>
                    ) : (
                      <div className="dashboard-scroll-list" style={{ display: "grid", gap: 10 }}>
                        {selectedDay.pendingRequests.map((request) => (
                          <div
                            key={request.id}
                            className="dashboard-list-card"
                            style={{
                              padding: 14,
                              borderRadius: 18,
                              background: "#fff7ed",
                              border: "1px solid #fed7aa",
                              display: "grid",
                              gap: 10,
                            }}
                          >
                            <div style={{ display: "grid", gap: 6 }}>
                              <strong style={{ color: "#0f172a" }}>
                                {formatRequestTypeLabel(request.type)}
                              </strong>
                              <span style={{ color: "#334155" }}>
                                {request.firstName} {request.lastName}
                              </span>
                              <span style={{ color: "#64748b", lineHeight: 1.5 }}>
                                {formatRange(request.startsAt, request.endsAt, locale)}
                              </span>
                              {request.reason ? (
                                <span style={{ color: "#475569", lineHeight: 1.5 }}>
                                  {request.reason}
                                </span>
                              ) : null}
                              {request.certificateCode ? (
                                <span style={{ color: "#64748b", lineHeight: 1.5 }}>
                                  Certificato: {request.certificateCode}
                                </span>
                              ) : null}
                            </div>

                            <div
                              className="dashboard-action-row"
                              style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
                            >
                              <PrimaryButton
                                type="button"
                                tone="green"
                                onClick={() =>
                                  submitReview(request.id, RequestStatus.APPROVED)
                                }
                                disabled={isPending}
                              >
                                Approva
                              </PrimaryButton>
                              <PrimaryButton
                                type="button"
                                tone="red"
                                onClick={() =>
                                  submitReview(request.id, RequestStatus.REJECTED)
                                }
                                disabled={isPending}
                              >
                                Rifiuta
                              </PrimaryButton>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

                {canCreateRequest ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    <strong style={{ fontSize: 18, color: "#0f172a" }}>
                      Nuova richiesta
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
                        <span style={{ fontWeight: 600, color: "#1e293b" }}>Tipo</span>
                        <Select
                          value={requestType}
                          onChange={(event) => setRequestType(event.target.value)}
                        >
                          <option value={RequestType.VACATION}>Ferie</option>
                          <option value={RequestType.PERMISSION}>Permesso</option>
                          <option value={RequestType.SICKNESS}>Malattia</option>
                        </Select>
                      </label>

                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontWeight: 600, color: "#1e293b" }}>Da</span>
                        <TextInput
                          type="datetime-local"
                          value={requestStart}
                          onChange={(event) => setRequestStart(event.target.value)}
                        />
                      </label>

                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontWeight: 600, color: "#1e293b" }}>A</span>
                        <TextInput
                          type="datetime-local"
                          value={requestEnd}
                          onChange={(event) => setRequestEnd(event.target.value)}
                        />
                      </label>
                    </div>

                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>Motivo</span>
                      <TextArea
                        value={requestReason}
                        onChange={(event) => setRequestReason(event.target.value)}
                        placeholder="Aggiungi un dettaglio utile per il titolare"
                      />
                    </label>

                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>
                        Codice certificato
                      </span>
                      <TextInput
                        value={certificateCode}
                        onChange={(event) => setCertificateCode(event.target.value)}
                        placeholder="Obbligatorio solo per malattia"
                      />
                    </label>

                    <div
                      className="dashboard-modal-actions"
                      style={{ display: "flex", justifyContent: "flex-end" }}
                    >
                      <PrimaryButton
                        type="button"
                        onClick={submitRequest}
                        disabled={isPending || !requestStart || !requestEnd}
                      >
                        {isPending ? "Invio..." : "Invia richiesta"}
                      </PrimaryButton>
                    </div>
                  </div>
                ) : null}

                {canCreateAvailability ? (
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
                        <TextInput
                          type="datetime-local"
                          value={availabilityStart}
                          onChange={(event) => setAvailabilityStart(event.target.value)}
                        />
                      </label>

                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontWeight: 600, color: "#1e293b" }}>A</span>
                        <TextInput
                          type="datetime-local"
                          value={availabilityEnd}
                          onChange={(event) => setAvailabilityEnd(event.target.value)}
                        />
                      </label>
                    </div>

                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>Motivo</span>
                      <TextArea
                        value={availabilityReason}
                        onChange={(event) => setAvailabilityReason(event.target.value)}
                        placeholder="Facoltativo"
                      />
                    </label>

                    <div
                      className="dashboard-modal-actions"
                      style={{ display: "flex", justifyContent: "flex-end" }}
                    >
                      <PrimaryButton
                        type="button"
                        onClick={submitAvailability}
                        disabled={isPending || !availabilityStart || !availabilityEnd}
                      >
                        {isPending ? "Salvataggio..." : "Salva indisponibilita"}
                      </PrimaryButton>
                    </div>
                  </div>
                ) : null}

                {canCreateCourse ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    <strong style={{ fontSize: 18, color: "#0f172a" }}>Nuovo corso</strong>

                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>Titolo</span>
                      <TextInput
                        value={courseTitle}
                        onChange={(event) => setCourseTitle(event.target.value)}
                        placeholder="Formazione sicurezza"
                      />
                    </label>

                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>Dettagli</span>
                      <TextArea
                        value={courseDescription}
                        onChange={(event) => setCourseDescription(event.target.value)}
                        placeholder="Argomenti, materiali, note operative"
                      />
                    </label>

                    <div
                      className="dashboard-modal-body-grid"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 12,
                      }}
                    >
                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontWeight: 600, color: "#1e293b" }}>Inizio</span>
                        <TextInput
                          type="datetime-local"
                          value={courseStart}
                          onChange={(event) => setCourseStart(event.target.value)}
                        />
                      </label>

                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontWeight: 600, color: "#1e293b" }}>Fine</span>
                        <TextInput
                          type="datetime-local"
                          value={courseEnd}
                          onChange={(event) => setCourseEnd(event.target.value)}
                        />
                      </label>

                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontWeight: 600, color: "#1e293b" }}>Luogo</span>
                        <TextInput
                          value={courseLocation}
                          onChange={(event) => setCourseLocation(event.target.value)}
                          placeholder="Sala riunioni o link"
                        />
                      </label>
                    </div>

                    <div style={{ display: "grid", gap: 10 }}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          color: "#1e293b",
                          fontWeight: 600,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={courseAssignedToAll}
                          onChange={(event) => setCourseAssignedToAll(event.target.checked)}
                        />
                        Assegna a tutto il team
                      </label>

                      {!courseAssignedToAll ? (
                        <label style={{ display: "grid", gap: 8 }}>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>
                            Persona coinvolta
                          </span>
                          <Select
                            value={courseAssignedToId}
                            onChange={(event) => setCourseAssignedToId(event.target.value)}
                          >
                            <option value="">Seleziona una persona</option>
                            {members.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.firstName} {member.lastName} -{" "}
                                {formatRoleLabel(member.role)}
                              </option>
                            ))}
                          </Select>
                        </label>
                      ) : null}
                    </div>

                    <div
                      className="dashboard-modal-actions"
                      style={{ display: "flex", justifyContent: "flex-end" }}
                    >
                      <PrimaryButton
                        type="button"
                        onClick={submitCourse}
                        disabled={
                          isPending ||
                          !courseTitle.trim() ||
                          !courseStart ||
                          !courseEnd ||
                          (!courseAssignedToAll && !courseAssignedToId)
                        }
                      >
                        {isPending ? "Salvataggio..." : "Salva corso"}
                      </PrimaryButton>
                    </div>
                  </div>
                ) : null}

                <div style={{ display: "grid", gap: 12 }}>
                  <strong style={{ fontSize: 18, color: "#0f172a" }}>
                    Eventi della giornata
                  </strong>

                  {selectedDay.shifts.length === 0 &&
                  selectedDay.availabilities.length === 0 &&
                  selectedDay.requests.length === 0 &&
                  selectedDay.courses.length === 0 &&
                  selectedDay.pendingRequests.length === 0 &&
                  selectedDay.tasks.length === 0 &&
                  selectedDay.notes.length === 0 ? (
                    <div style={{ color: "#64748b" }}>
                      Nessun evento registrato in questa giornata.
                    </div>
                  ) : (
                    <div className="dashboard-scroll-list" style={{ display: "grid", gap: 10 }}>
                      {selectedDay.shifts.map((shift) => renderShiftCard(shift, locale, true))}
                      {selectedDay.courses.map((course) =>
                        renderCourseCard(course, locale, true)
                      )}
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
                            <strong style={{ color: "#0f172a", fontSize: 16 }}>
                              {task.title}
                            </strong>
                            <span style={{ color: "#475569", fontSize: 14 }}>
                              {task.assignedLabel}
                            </span>
                            {task.completedByLabel ? (
                              <span style={{ color: "#64748b", fontSize: 13 }}>
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
                                onClick={() => submitTaskCompletion(task.id)}
                                disabled={isPending}
                              >
                                {isPending ? "Salvataggio..." : "Conferma mansione"}
                              </PrimaryButton>
                            </div>
                          ) : null}
                        </div>
                      ))}
                      {selectedDay.notes.map((note) => renderNoteCard(note, locale, true))}
                      {selectedDay.pendingRequests.map((request) =>
                        renderPendingRequestCard(request, true)
                      )}
                      {selectedDay.availabilities.map((availability) =>
                        renderAvailabilityCard(availability, true)
                      )}
                      {selectedDay.requests.map((request) =>
                        renderApprovedRequestCard(request, true)
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>,
            document.body
          )
          : null}
      <QuickCalendarEntryModal
        open={Boolean(selectedDay && quickComposer)}
        mode={quickComposer}
        dateIso={selectedDay?.date ?? null}
        members={members}
        canPinBoard={role === Role.OWNER || role === Role.MANAGER}
        isPending={isPending}
        onClose={() => setQuickComposer(null)}
        onSubmitTask={submitQuickTask}
        onSubmitBoard={submitQuickBoard}
      />
    </>
  );
}
