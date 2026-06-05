"use client";

import { ActivityType, RequestStatus, RequestType, Role } from "@prisma/client";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { combineDateAndTime } from "@/lib/shift-datetime";
import type { ShiftPreset } from "@/lib/shift-presets";
import { DateTimeInput } from "@/app/components/date-time-input";
import { TimeInput } from "@/app/components/time-input";
import {
  completeTaskAction,
  createAvailabilityAction,
  createBoardNoteAction,
  createCourseAction,
  createShiftAction,
  createTaskAction,
  createTimeOffRequestAction,
  confirmShiftAction,
  reviewRequestAction,
} from "../actions";
import { ShiftEditorModal } from "../shifts/shift-editor-modal";
import { IconButton, PrimaryButton, Select, StatusPill, SuccessCallout, TextArea, TextInput } from "../ui";
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
  isOnCall: boolean;
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

type ClosureItem = {
  id: string;
  title: string;
  type: string;
  startTime: string;
  endTime: string;
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
  pendingOnCallShifts: ShiftItem[];
  availabilities: AvailabilityItem[];
  requests: RequestItem[];
  pendingRequests: PendingRequestItem[];
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
  isOnCall: boolean;
};

function createShiftDraft(dateIso: string): ShiftDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    date: toDateTimeLocal(dateIso, 0, 0).slice(0, 10),
    startTime: "",
    endTime: "",
    presetKey: "CUSTOM",
    memberIds: [],
    isOnCall: false,
  };
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

function hasTimeOverlap(rangeStart: string, rangeEnd: string, shiftStart: string, shiftEnd: string) {
  return new Date(rangeStart) < new Date(shiftEnd) && new Date(rangeEnd) > new Date(shiftStart);
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

function formatAssignmentNames(assignments: ShiftAssignment[]) {
  return assignments.map((assignment) => `${assignment.firstName} ${assignment.lastName}`).join(", ");
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

function renderShiftCard(shift: ShiftItem, locale: string, mobile = false) {
  return (
    <div
      key={shift.id}
      style={{
        padding: mobile ? 14 : "10px 12px",
        borderRadius: mobile ? 18 : 16,
        background: "#eff6ff",
        border: "1px solid #dbeafe",
        display: "block",
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
          {formatRange(shift.startTime, shift.endTime, locale)}
        </strong>
        {shift.isOnCall ? (
          <span style={{ color: "#b45309", fontSize: mobile ? 13 : 12, fontWeight: 600 }}>
            {shift.confirmedAt ? "Reperibilita" : "Reperibilita in attesa"}
          </span>
        ) : null}
        <span style={{ color: "#475569", fontSize: mobile ? 14 : 12 }}>
          {formatAssignmentNames(shift.assignments)}
        </span>
        <span
          title={shift.confirmedAt ? "Confermato" : "In attesa"}
          aria-label={shift.confirmedAt ? "Confermato" : "In attesa"}
          style={{
            marginLeft: "auto",
            fontSize: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {renderShiftStateIcon(Boolean(shift.confirmedAt), mobile ? 18 : 16)}
          {shift.confirmedAt ? "✓" : "○"}
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
      Indisponibilita segnalata: {availability.firstName} {availability.lastName}
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

function renderPendingOnCallCard(shift: ShiftItem, locale: string, mobile = false) {
  return (
    <div
      key={shift.id}
      style={{
        padding: mobile ? "12px 14px" : "10px 12px",
        borderRadius: mobile ? 18 : 16,
        background: "#fff7ed",
        border: "1px solid #fed7aa",
        color: "#9a3412",
        lineHeight: 1.6,
        fontSize: mobile ? 14 : 13,
        display: "grid",
        gap: 6,
      }}
    >
      <strong style={{ color: "#0f172a", fontSize: mobile ? 14 : 13 }}>
        Reperibilita da approvare
      </strong>
      <span style={{ color: "#334155" }}>{formatRange(shift.startTime, shift.endTime, locale)}</span>
      <span style={{ color: "#475569" }}>{formatAssignmentNames(shift.assignments)}</span>
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
  companyShiftsEnabled,
  members,
  presets,
  currentUserId,
}: {
  locale: string;
  weekdayLabels: string[];
  days: DayItem[];
  filteredDay?: string | null;
  role: string;
  activityType: ActivityType;
  companyShiftsEnabled: boolean;
  members: MemberOption[];
  presets: ShiftPreset[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [showShiftComposer, setShowShiftComposer] = useState(false);
  const [showRequestComposer, setShowRequestComposer] = useState(false);
  const [showAvailabilityComposer, setShowAvailabilityComposer] = useState(false);
  const [quickComposer, setQuickComposer] = useState<"task" | "board" | null>(null);
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
  const [showCourseComposer, setShowCourseComposer] = useState(false);

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

  const isCompany = activityType === ActivityType.COMPANY;
  const canManageOptionalShifts =
    isCompany && companyShiftsEnabled && (role === Role.OWNER || role === Role.MANAGER);
  const canCreateRequest = role !== Role.OWNER;
  const canCreateAvailability = !isCompany && role !== Role.OWNER;
  const canCreateCourse = role === Role.OWNER || role === Role.MANAGER;
  const canCreateClosure = role === Role.OWNER || role === Role.MANAGER;
  const canReviewRequests = isCompany && role === Role.OWNER;
  const canOpenTaskComposer = role === Role.OWNER || role === Role.MANAGER;

  function openRequestComposer() {
    setShowShiftComposer(false);
    setShowAvailabilityComposer(false);
    setShowCourseComposer(false);
    setQuickComposer(null);
    setShowRequestComposer(true);
  }

  function openAvailabilityComposer() {
    setShowShiftComposer(false);
    setShowRequestComposer(false);
    setShowCourseComposer(false);
    setQuickComposer(null);
    setShowAvailabilityComposer(true);
  }

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

  function openDay(day: DayItem) {
    setSelectedDate(day.date);
    setEditingShiftId(null);
    setShowShiftComposer(false);
    setShowRequestComposer(false);
    setShowAvailabilityComposer(false);
    setShowCourseComposer(false);
    setQuickComposer(null);
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
  }

  function closeModal() {
    if (isPending) {
      return;
    }

    setEditingShiftId(null);
    setShowShiftComposer(false);
    setShowRequestComposer(false);
    setShowAvailabilityComposer(false);
    setShowCourseComposer(false);
    setSelectedDate(null);
    setQuickComposer(null);
    setFeedback(null);
  }

  function addShiftDraft() {
    if (!selectedDay) {
      return;
    }

    setShowShiftComposer(true);
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

  function runAction(
    task: () => Promise<void>,
    successMessage: string,
    closeOnSuccess = false
  ) {
    startTransition(async () => {
      try {
        await task();
        setFeedback({ tone: "success", message: successMessage });
        if (closeOnSuccess) {
          setEditingShiftId(null);
          setSelectedDate(null);
        }
        window.setTimeout(() => {
          router.refresh();
        }, 0);
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
      setShowRequestComposer(false);
    }, "Richiesta salvata.");
  }

  function submitShifts() {
    if (!selectedDay) {
      return;
    }

    const validDrafts = shiftDrafts.filter(
      (draft) => draft.date && draft.startTime && draft.endTime && draft.memberIds.length > 0
    );

    if (validDrafts.length === 0) {
      return;
    }

    runAction(
      async () => {
        for (const draft of validDrafts) {
        const formData = new FormData();
        formData.set("title", "");
        formData.set("startTime", combineDateAndTime(draft.date, draft.startTime));
        formData.set("endTime", combineDateAndTime(draft.date, draft.endTime));
        if (draft.isOnCall) {
          formData.set("isOnCall", "on");
        }

        for (const memberId of draft.memberIds) {
          formData.append("employeeIds", memberId);
        }

          await createShiftAction(formData);
        }

        setShiftDrafts([createShiftDraft(selectedDay.date)]);
        setShowShiftComposer(false);
      },
      validDrafts.length === 1 ? "Turno aggiunto." : "Turni aggiunti.",
      true
    );
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
      setShowAvailabilityComposer(false);
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
      setShowCourseComposer(false);
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

  function submitOnCallApproval(shiftId: string) {
    const formData = new FormData();
    formData.set("shiftId", shiftId);

    runAction(async () => {
      await confirmShiftAction(formData);
    }, "Reperibilita approvata.");
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
                    day.closures.length === 0 &&
                    day.tasks.length === 0 &&
                    day.notes.length === 0 ? (
                      <div style={{ color: "#94a3b8", fontSize: 15 }}>Nessun evento</div>
                    ) : null}

                    {day.shifts.map((shift) => renderShiftCard(shift, locale, true))}
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
                <IconButton
                  type="button"
                  onClick={closeModal}
                  aria-label="Chiudi popup calendario"
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
                  </div>
                </div>

                {feedback ? (
                  feedback.tone === "success" ? (
                    <SuccessCallout>{feedback.message}</SuccessCallout>
                  ) : (
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: 16,
                        border: "1px solid #fecaca",
                        background: "#fef2f2",
                        color: "#b91c1c",
                        lineHeight: 1.5,
                      }}
                    >
                      {feedback.message}
                    </div>
                  )
                ) : null}

                {canManageOptionalShifts ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <strong style={{ fontSize: 18, color: "#0f172a" }}>Turni del giorno</strong>
                      {canManageOptionalShifts ? (
                        <IconButton
                          type="button"
                          onClick={() => {
                            setShowShiftComposer(true);
                            if (shiftDrafts.length === 0) {
                              addShiftDraft();
                            }
                          }}
                          aria-label="Aggiungi turno"
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
                      ) : null}
                    </div>

                    {showShiftComposer && canManageOptionalShifts ? (
                      <div
                        style={{
                          position: "fixed",
                          left: "50%",
                          top: "50%",
                          transform: "translate(-50%, -50%)",
                          zIndex: 2147483647,
                          display: "grid",
                          gap: 12,
                          width: "min(720px, calc(100vw - 32px))",
                          maxHeight: "calc(100dvh - 32px)",
                          overflowY: "auto",
                          padding: 18,
                          borderRadius: 28,
                          background: "#f8fafc",
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
                          <strong style={{ color: "#0f172a", fontSize: 18 }}>Nuovi turni</strong>
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
                                borderRadius: 20,
                                background: "#ffffff",
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
                                  <TextInput
                                    type="date"
                                    value={draft.date}
                                    onChange={(event) =>
                                      updateShiftDraft(draft.id, { date: event.target.value })
                                    }
                                  />
                                </label>

                                <label style={{ display: "grid", gap: 8 }}>
                                  <span style={{ fontWeight: 600, color: "#1e293b" }}>Inizio</span>
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
                                  <span style={{ fontWeight: 600, color: "#1e293b" }}>Fine</span>
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

                              <label
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                  color: "#334155",
                                  fontWeight: 600,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={draft.isOnCall}
                                  onChange={(event) =>
                                    updateShiftDraft(draft.id, { isOnCall: event.target.checked })
                                  }
                                />
                                Reperibilita
                              </label>

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
                                          {member.firstName} {member.lastName} -{" "}
                                          {activityType === ActivityType.COMPANY && member.role === Role.MANAGER
                                            ? "Ufficio personale"
                                            : formatRoleLabel(member.role)}
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

                        <div className="dashboard-modal-actions" style={{ display: "flex", justifyContent: "flex-end" }}>
                          <PrimaryButton
                            type="button"
                            onClick={submitShifts}
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
                    ) : null}

                    {selectedDay.shifts.length === 0 ? (
                      <div style={{ color: "#64748b" }}>Nessun turno presente in questa giornata.</div>
                    ) : (
                      <div className="dashboard-scroll-list" style={{ display: "grid", gap: 10 }}>
                        {selectedDay.shifts.map((shift) => (
                          <button
                            key={shift.id}
                            type="button"
                            className="dashboard-list-card"
                            onClick={() => setEditingShiftId(shift.id)}
                            disabled={isPending}
                            style={{
                              width: "100%",
                              padding: 14,
                              borderRadius: 18,
                              border: "1px solid #e2e8f0",
                              background: "#f8fafc",
                              textAlign: "left",
                              display: "grid",
                              gap: 6,
                              cursor: isPending ? "default" : "pointer",
                            }}
                          >
                            <strong style={{ color: "#0f172a", fontSize: 16 }}>
                              {formatRange(shift.startTime, shift.endTime, locale)}
                            </strong>
                            <span style={{ color: "#475569" }}>
                              {formatAssignmentNames(shift.assignments)}
                            </span>
                            <span
                              title={shift.confirmedAt ? "Confermato" : "In attesa"}
                              aria-label={shift.confirmedAt ? "Confermato" : "In attesa"}
                              style={{
                                justifySelf: "start",
                                display: "inline-flex",
                                alignItems: "center",
                              }}
                            >
                              {renderShiftStateIcon(Boolean(shift.confirmedAt), 18)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

                {(selectedDay?.pendingOnCallShifts ?? []).filter(
                  (shift) => shift.assignments.some((assignment) => assignment.id === currentUserId)
                ).length > 0 ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <strong style={{ fontSize: 18, color: "#0f172a" }}>
                        Reperibilita da approvare
                      </strong>
                      <CountBadge
                        count={
                          (selectedDay?.pendingOnCallShifts ?? []).filter(
                            (shift) =>
                              shift.assignments.some(
                                (assignment) => assignment.id === currentUserId
                              )
                          ).length
                        }
                      />
                    </div>

                    <div className="dashboard-scroll-list" style={{ display: "grid", gap: 10 }}>
                      {(selectedDay?.pendingOnCallShifts ?? [])
                        .filter(
                          (shift) =>
                            shift.assignments.some((assignment) => assignment.id === currentUserId)
                        )
                        .map((shift) => (
                          <div
                            key={shift.id}
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
                            {renderPendingOnCallCard(shift, locale, true)}

                            <div className="dashboard-action-row">
                              <PrimaryButton
                                type="button"
                                tone="green"
                                onClick={() => submitOnCallApproval(shift.id)}
                                disabled={isPending}
                              >
                                Approva
                              </PrimaryButton>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null}

                {canCreateRequest ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    <strong style={{ fontSize: 18, color: "#0f172a" }}>
                      Richieste da approvare
                    </strong>

                    {(selectedDay?.pendingRequests?.length ?? 0) === 0 ? (
                      <div style={{ color: "#64748b" }}>
                        Nessuna richiesta in attesa per questa giornata.
                      </div>
                    ) : (
                      <div className="dashboard-scroll-list" style={{ display: "grid", gap: 10 }}>
                        {(selectedDay?.pendingRequests ?? []).map((request) => (
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
                {(selectedDay?.availabilities.length ?? 0) + (selectedDay?.requests.length ?? 0) > 0 ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <strong style={{ fontSize: 18, color: "#0f172a" }}>
                        Mancanze del giorno
                      </strong>
                      <CountBadge
                        count={
                          (selectedDay?.availabilities.length ?? 0) +
                          (selectedDay?.requests.length ?? 0)
                        }
                      />
                    </div>

                    <div className="dashboard-scroll-list" style={{ display: "grid", gap: 10 }}>
                      {(selectedDay?.availabilities ?? []).map((availability) =>
                        renderAvailabilityCard(availability, true)
                      )}
                      {(selectedDay?.requests ?? []).map((request) =>
                        renderApprovedRequestCard(request, true)
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: "#64748b" }}>
                    Nessuna mancanza registrata in questa giornata.
                  </div>
                )}

                {canCreateRequest ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <strong style={{ fontSize: 18, color: "#0f172a" }}>
                        Nuova richiesta
                      </strong>
                      <IconButton
                        type="button"
                        onClick={openRequestComposer}
                        aria-label="Apri nuova richiesta"
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
                  </div>
                ) : null}

                {canCreateAvailability ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <strong style={{ fontSize: 18, color: "#0f172a" }}>
                        Nuova indisponibilita
                      </strong>
                      <IconButton
                        type="button"
                        onClick={openAvailabilityComposer}
                        aria-label="Apri indisponibilita"
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
                  </div>
                ) : null}

                {showRequestComposer ? (
                      <div
                        style={{
                          position: "fixed",
                          left: "50%",
                          top: "50%",
                          transform: "translate(-50%, -50%)",
                          zIndex: 2147483647,
                          display: "grid",
                          gap: 12,
                          width: "min(640px, calc(100vw - 32px))",
                          maxHeight: "calc(100dvh - 32px)",
                          overflowY: "auto",
                          padding: 18,
                          borderRadius: 28,
                          background: "#ffffff",
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
                          <strong style={{ fontSize: 18, color: "#0f172a" }}>Nuova richiesta</strong>
                          <IconButton
                            type="button"
                            onClick={() => setShowRequestComposer(false)}
                            aria-label="Chiudi richiesta"
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
                              <option value={RequestType.OVERTIME}>Straordinario</option>
                            </Select>
                          </label>

                          <label style={{ display: "grid", gap: 8 }}>
                            <span style={{ fontWeight: 600, color: "#1e293b" }}>Da</span>
                            <DateTimeInput value={requestStart} onChange={setRequestStart} />
                          </label>

                          <label style={{ display: "grid", gap: 8 }}>
                            <span style={{ fontWeight: 600, color: "#1e293b" }}>A</span>
                            <DateTimeInput value={requestEnd} onChange={setRequestEnd} />
                          </label>
                        </div>

                        <label style={{ display: "grid", gap: 8 }}>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>Motivo</span>
                          <TextArea
                            value={requestReason}
                            onChange={(event) => setRequestReason(event.target.value)}
                          />
                        </label>

                        <label style={{ display: "grid", gap: 8 }}>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>
                            Codice certificato
                          </span>
                          <TextInput
                            value={certificateCode}
                            onChange={(event) => setCertificateCode(event.target.value)}
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

                {showAvailabilityComposer && canCreateAvailability ? (
                      <div
                        style={{
                          position: "fixed",
                          left: "50%",
                          top: "50%",
                          transform: "translate(-50%, -50%)",
                          zIndex: 2147483647,
                          display: "grid",
                          gap: 12,
                          width: "min(640px, calc(100vw - 32px))",
                          maxHeight: "calc(100dvh - 32px)",
                          overflowY: "auto",
                          padding: 18,
                          borderRadius: 28,
                          background: "#ffffff",
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
                          <strong style={{ fontSize: 18, color: "#0f172a" }}>
                            Nuova indisponibilita
                          </strong>
                          <IconButton
                            type="button"
                            onClick={() => setShowAvailabilityComposer(false)}
                            aria-label="Chiudi indisponibilita"
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
                            <DateTimeInput value={availabilityStart} onChange={setAvailabilityStart} />
                          </label>

                          <label style={{ display: "grid", gap: 8 }}>
                            <span style={{ fontWeight: 600, color: "#1e293b" }}>A</span>
                            <DateTimeInput value={availabilityEnd} onChange={setAvailabilityEnd} />
                          </label>
                        </div>

                        <label style={{ display: "grid", gap: 8 }}>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>Motivo</span>
                          <TextArea
                            value={availabilityReason}
                            onChange={(event) => setAvailabilityReason(event.target.value)}
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

                <div style={{ display: "grid", gap: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <strong style={{ fontSize: 18, color: "#0f172a" }}>
                      Mansioni del giorno
                    </strong>
                    <CountBadge count={selectedDay.tasks.length} />
                    {canOpenTaskComposer ? (
                      <IconButton
                        type="button"
                        onClick={() => setQuickComposer("task")}
                        aria-label="Aggiungi mansioni"
                        disabled={isPending}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M12 5v14M5 12h14"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      </IconButton>
                    ) : null}
                  </div>
                  {selectedDay.tasks.length === 0 ? (
                    <div style={{ color: "#64748b" }}>Nessuna mansione collegata a questa giornata.</div>
                  ) : (
                    <div className="dashboard-scroll-list" style={{ display: "grid", gap: 10 }}>
                      {selectedDay.tasks.map((task) => renderTaskCard(task, true))}
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
                    <strong style={{ fontSize: 18, color: "#0f172a" }}>
                      Bacheca del giorno
                    </strong>
                    <CountBadge count={selectedDay.notes.length} />
                    <IconButton
                      type="button"
                      onClick={() => setQuickComposer("board")}
                      aria-label="Aggiungi in bacheca"
                      disabled={isPending}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
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
                      {selectedDay.notes.map((note) => renderNoteCard(note, locale, true))}
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
      <ShiftEditorModal
        open={Boolean(editingShift)}
        locale={locale}
        canManage={canManageOptionalShifts}
        currentUserId={currentUserId}
        shift={editingShift}
        members={members}
        presets={presets}
        onClose={() => setEditingShiftId(null)}
      />
    </>
  );
}
