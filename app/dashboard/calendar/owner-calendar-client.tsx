"use client";

import { RequestType } from "@prisma/client";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { combineDateAndTime, toDateInputValue } from "@/lib/shift-datetime";
import { APP_TIME_ZONE, toDateInputValueInTimeZone } from "@/lib/time-zone";
import type { ShiftPreset } from "@/lib/shift-presets";
import type { FeatureFlags } from "@/lib/features";
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
  confirmBoardNoteReadAction,
  confirmShiftAction,
} from "../actions";
import { ShiftEditorModal } from "../shifts/shift-editor-modal";
import { IconButton, PrimaryButton, Select, StatusPill, SuccessCallout } from "../ui";
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
  requiresConfirmation: boolean;
  employeeId: string | null;
  createdAt: string;
  authorName: string;
  confirmations: Array<{
    userId: string;
    userName: string;
    readAt: string;
  }>;
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
  pendingOnCallShifts: ShiftItem[];
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

type CalendarModalMode = "day" | "shifts" | "notes";

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
    date: toDateInputValue(dateIso),
    startTime: "",
    endTime: "",
    presetKey: "CUSTOM",
    memberIds: [],
    isOnCall: false,
  };
}

function formatDayTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
}

function formatDayLabel(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
}

function formatRange(start: string, end: string, locale: string) {
  return `${formatDayTime(start, locale)} - ${formatDayTime(end, locale)}`;
}

function formatRoleLabel(role: string) {
  if (role === "MANAGER") {
    return "Responsabile";
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

function truncateCalendarText(value: string, maxLength = 25) {
  const clean = value.replace(/\s+/g, " ").trim();

  if (clean.length <= maxLength) {
    return clean;
  }

  return `${clean.slice(0, maxLength - 3).trimEnd()}...`;
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

function renderCompactShiftCard(
  shift: ShiftItem,
  locale: string,
  mobile = false,
  onOpen?: () => void
) {
  return (
    <div
      key={shift.id}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={(event) => {
        event.stopPropagation();
        onOpen?.();
      }}
      onKeyDown={(event) => {
        if (!onOpen || (event.key !== "Enter" && event.key !== " ")) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        onOpen();
      }}
      style={{
        padding: mobile ? "7px 9px" : "7px 9px",
        borderRadius: mobile ? 12 : 12,
        background: "#eff6ff",
        border: "1px solid #dbeafe",
        color: "#0f172a",
        cursor: onOpen ? "pointer" : "default",
        transition: "transform 120ms ease, box-shadow 120ms ease",
        touchAction: "manipulation",
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
        <strong style={{ color: "#0f172a", fontSize: mobile ? 12 : 12 }}>
          {formatDayTime(shift.startTime, locale)} - {formatDayTime(shift.endTime, locale)}
        </strong>
        {shift.isOnCall ? (
          <span style={{ color: "#b45309", fontSize: mobile ? 11 : 11, fontWeight: 600 }}>
            {shift.confirmedAt ? "Reperibilita" : "Reperibilita in attesa"}
          </span>
        ) : null}
        <span style={{ color: "#475569", fontSize: mobile ? 12 : 11 }}>
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
          {renderShiftStateIcon(Boolean(shift.confirmedAt), mobile ? 14 : 14)}
        </span>
      </div>
    </div>
  );
}

function renderTaskPreviewCard(task: TaskItem, mobile = false, onOpen?: () => void) {
  return (
    <div
      key={task.id}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={(event) => {
        event.stopPropagation();
        onOpen?.();
      }}
      onKeyDown={(event) => {
        if (!onOpen || (event.key !== "Enter" && event.key !== " ")) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        onOpen();
      }}
      style={{
        padding: mobile ? "7px 9px" : "7px 9px",
        borderRadius: mobile ? 12 : 12,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        color: "#334155",
        lineHeight: 1.55,
        cursor: onOpen ? "pointer" : "default",
        transition: "transform 120ms ease, box-shadow 120ms ease",
        touchAction: "manipulation",
      }}
    >
      <strong style={{ color: "#0f172a", fontSize: mobile ? 12 : 12 }}>
        📌 {truncateCalendarText(task.title)}
      </strong>
      <div style={{ color: "#64748b", fontSize: mobile ? 11 : 11 }}>
        {task.assignedLabel}
      </div>
    </div>
  );
}

function renderNotePreviewCard(note: NoteItem, mobile = false, onOpen?: () => void) {
  return (
    <div
      key={note.id}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={(event) => {
        event.stopPropagation();
        onOpen?.();
      }}
      onKeyDown={(event) => {
        if (!onOpen || (event.key !== "Enter" && event.key !== " ")) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        onOpen();
      }}
      style={{
        padding: mobile ? "7px 9px" : "7px 9px",
        borderRadius: mobile ? 12 : 12,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        color: "#334155",
        lineHeight: 1.55,
        cursor: onOpen ? "pointer" : "default",
        transition: "transform 120ms ease, box-shadow 120ms ease",
        touchAction: "manipulation",
      }}
    >
      <strong style={{ color: "#0f172a", fontSize: mobile ? 12 : 12 }}>
        📌 {truncateCalendarText(note.content)}
      </strong>
      <div style={{ color: "#64748b", fontSize: mobile ? 11 : 11 }}>
        {note.authorName}
      </div>
    </div>
  );
}

function renderNoteConfirmations(note: NoteItem, locale: string) {
  if (!note.requiresConfirmation) {
    return null;
  }

  if (note.confirmations.length === 0) {
    return <span style={{ color: "#94a3b8", fontSize: 13 }}>Nessuna conferma</span>;
  }

  return (
    <div style={{ display: "grid", gap: 4 }}>
      <span style={{ color: "#64748b", fontSize: 13, fontWeight: 700 }}>
        Conferme
      </span>
      {note.confirmations.map((confirmation) => (
        <span key={`${note.id}-${confirmation.userId}`} style={{ color: "#64748b", fontSize: 13 }}>
          ✓ {confirmation.userName} - {formatDayTime(confirmation.readAt, locale)}
        </span>
      ))}
    </div>
  );
}

function renderAvailabilityCard(availability: AvailabilityItem, mobile = false) {
  return (
    <div
      key={availability.id}
      onClick={(event) => event.stopPropagation()}
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
          Indisponibilita: {availability.firstName} {availability.lastName}
        </strong>
        <span style={{ color: "#b91c1c" }}>
          {formatRange(availability.startsAt, availability.endsAt, "it-IT")}
        </span>
      </div>
    </div>
  );
}

function renderApprovedRequestCard(request: RequestItem, mobile = false) {
  return (
    <div
      key={request.id}
      onClick={(event) => event.stopPropagation()}
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
        <span style={{ color: "#b91c1c" }}>
          {formatRange(request.startsAt, request.endsAt, "it-IT")}
        </span>
        {request.approvedBy ? (
          <span style={{ color: "#b91c1c" }}>Approvata da: {request.approvedBy}</span>
        ) : null}
      </div>
    </div>
  );
}

function renderPendingOnCallCard(shift: ShiftItem, locale: string, mobile = false) {
  return (
    <div
      key={shift.id}
      onClick={(event) => event.stopPropagation()}
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

function toDateTimeLocal(dateIso: string, hour: number, minute: number) {
  const day = String(dateIso ?? "").slice(0, 10);
  return `${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
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
  currentUserId,
  features,
}: {
  locale: string;
  weekdayLabels: string[];
  days: DayItem[];
  members: MemberOption[];
  presets: ShiftPreset[];
  filteredDay?: string | null;
  role: string;
  currentUserId: string;
  features: FeatureFlags;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeCalendarModal, setActiveCalendarModal] = useState<CalendarModalMode | null>(null);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [showShiftComposer, setShowShiftComposer] = useState(false);
  const [showRequestComposer, setShowRequestComposer] = useState(false);
  const [showAvailabilityComposer, setShowAvailabilityComposer] = useState(false);
  const [quickComposer, setQuickComposer] = useState<"task" | "board" | null>(null);
  const [showCourseComposer, setShowCourseComposer] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [shiftDrafts, setShiftDrafts] = useState<ShiftDraft[]>([]);
  const [currentShiftDraft, setCurrentShiftDraft] = useState<ShiftDraft | null>(null);
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

  useEffect(() => {
    if (!features.overtime && requestType === RequestType.OVERTIME) {
      setRequestType(RequestType.VACATION);
    }
  }, [features.overtime, requestType]);

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

    if (features.availability) {
      for (const availability of selectedDay.availabilities) {
        if (hasTimeOverlap(availability.startsAt, availability.endsAt, nextShiftStart, nextShiftEnd)) {
          blocked.set(availability.userId, "Indisponibile");
        }
      }
    }

    if (features.requests) {
      for (const request of selectedDay.requests) {
        if (hasTimeOverlap(request.startsAt, request.endsAt, nextShiftStart, nextShiftEnd)) {
          blocked.set(request.userId, formatRequestTypeLabel(request.type));
        }
      }
    }

    return blocked;
  }
  const canCreatePersonalEntries = role === "MANAGER";

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

  function openDay(day: DayItem, mode: CalendarModalMode = "day") {
    setSelectedDate(day.date);
    setActiveCalendarModal(mode);
    setEditingShiftId(null);
    setShowShiftComposer(false);
    setShowRequestComposer(false);
    setShowAvailabilityComposer(false);
    setQuickComposer(null);
    setShowCourseComposer(false);
    setFeedback(null);
    setShiftDrafts([]);
    setCurrentShiftDraft(createShiftDraft(day.date));
    setRequestType(RequestType.VACATION);
    setRequestStart(`${day.date.slice(0, 10)}T`);
    setRequestEnd(`${day.date.slice(0, 10)}T`);
    setRequestReason("");
    setCertificateCode("");
    setAvailabilityStart(`${day.date.slice(0, 10)}T`);
    setAvailabilityEnd(`${day.date.slice(0, 10)}T`);
    setAvailabilityReason("");
    setCourseTitle("");
    setCourseDescription("");
    setCourseLocation("");
    setCourseStart(`${day.date.slice(0, 10)}T`);
    setCourseEnd(`${day.date.slice(0, 10)}T`);
    setCourseAssignedToAll(true);
    setCourseAssignedToId("");
  }

  function closeModal() {
    if (isPending) {
      return;
    }

    setEditingShiftId(null);
    setActiveCalendarModal(null);
    setShowShiftComposer(false);
    setShowRequestComposer(false);
    setShowAvailabilityComposer(false);
    setQuickComposer(null);
    setShowCourseComposer(false);
    setSelectedDate(null);
    setFeedback(null);
    setCurrentShiftDraft(null);
  }

  function isShiftDraftValid(draft: ShiftDraft | null) {
    return Boolean(draft?.date && draft.startTime && draft.endTime && draft.memberIds.length > 0);
  }

  function addShiftDraft() {
    if (!selectedDay) {
      return;
    }

    setShowShiftComposer(true);
    if (!currentShiftDraft) {
      setCurrentShiftDraft(createShiftDraft(selectedDay.date));
      return;
    }

    if (!isShiftDraftValid(currentShiftDraft)) {
      setFeedback({ tone: "danger", message: "Completa il turno prima di aggiungerlo alla lista." });
      return;
    }

    setShiftDrafts((current) => current.concat(currentShiftDraft));
    setCurrentShiftDraft(createShiftDraft(selectedDay.date));
    setFeedback(null);
  }

  function removeShiftDraft(draftId: string) {
    setShiftDrafts((current) => current.filter((draft) => draft.id !== draftId));
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

  function updateCurrentShiftDraft(patch: Partial<ShiftDraft>) {
    setCurrentShiftDraft((current) => {
      if (!current) {
        return current;
      }

      const next = { ...current, ...patch };
      const blocked = getBlockedMemberReasons(next);

      return {
        ...next,
        memberIds: next.memberIds.filter((memberId) => !blocked.has(memberId)),
      };
    });
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

  function toggleCurrentDraftMember(memberId: string) {
    setCurrentShiftDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        memberIds: current.memberIds.includes(memberId)
          ? current.memberIds.filter((id) => id !== memberId)
          : current.memberIds.concat(memberId),
      };
    });
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

  function applyPresetToCurrent(nextKey: string) {
    if (nextKey === "CUSTOM") {
      updateCurrentShiftDraft({ presetKey: nextKey });
      return;
    }

    const preset = presets.find((entry) => entry.key === nextKey);

    if (!preset) {
      return;
    }

    updateCurrentShiftDraft({
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
        window.setTimeout(() => {
          router.refresh();
        }, 0);
      } catch (error) {
        setFeedback({ tone: "danger", message: getErrorMessage(error) });
      }
    });
  }

  function handleCreateShifts() {
    if (!selectedDay) {
      return;
    }

    const validDrafts = shiftDrafts
      .concat(isShiftDraftValid(currentShiftDraft) && currentShiftDraft ? [currentShiftDraft] : [])
      .filter((draft) => draft.date && draft.startTime && draft.endTime && draft.memberIds.length > 0);

    if (validDrafts.length === 0) {
      return;
    }

    runAction(async () => {
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

      setShiftDrafts([]);
      setCurrentShiftDraft(createShiftDraft(selectedDay.date));
      setShowShiftComposer(false);
    }, validDrafts.length === 1 ? "Turno aggiunto." : "Turni aggiunti.", true);
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
      setShowRequestComposer(false);
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
      setShowAvailabilityComposer(false);
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

  function handleCompleteTask(taskId: string) {
    const formData = new FormData();
    formData.set("taskId", taskId);

    runAction(async () => {
      await completeTaskAction(formData);
    }, "Nota completata.");
  }

  function handleConfirmOnCall(shiftId: string) {
    const formData = new FormData();
    formData.set("shiftId", shiftId);

    runAction(async () => {
      await confirmShiftAction(formData);
    }, "Reperibilita approvata.");
  }

  function handleQuickTaskCreate(formData: FormData) {
    runAction(async () => {
      await createTaskAction(formData);
      setQuickComposer(null);
    }, "Nota aggiunta.");
  }

  function handleQuickBoardCreate(formData: FormData) {
    runAction(async () => {
      await createBoardNoteAction(formData);
      setQuickComposer(null);
    }, "Nota pubblicata.");
  }

  if (!days.length) {
    return null;
  }

  const day = selectedDay ?? days[0];
  const todayKey = toDateInputValueInTimeZone(new Date());

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
                      timeZone: APP_TIME_ZONE,
                    }).format(new Date(week[0].date))}
                    {" - "}
                    {new Intl.DateTimeFormat(locale, {
                      day: "numeric",
                      month: "long",
                      timeZone: APP_TIME_ZONE,
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
                    disabled={day.date.slice(0, 10) < todayKey}
                    title={
                      day.date.slice(0, 10) < todayKey
                        ? "Giornata passata: nuovi inserimenti non disponibili"
                        : undefined
                    }
                    data-calendar-today={day.isToday ? "true" : undefined}
                    style={{
                      display: "grid",
                      gap: 6,
                      width: "100%",
                      maxWidth: "100%",
                      boxSizing: "border-box",
                      padding: 10,
                      borderRadius: 16,
                      background: "#ffffff",
                      border: day.isToday ? "2px solid #0f172a" : "1px solid #e2e8f0",
                      boxShadow: "0 8px 20px rgba(15, 23, 42, 0.05)",
                      opacity:
                        day.date.slice(0, 10) < todayKey
                          ? 0.58
                          : day.inCurrentMonth
                            ? 1
                            : 0.7,
                      textAlign: "left",
                      cursor: day.date.slice(0, 10) < todayKey ? "not-allowed" : "pointer",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <strong style={{ color: "#0f172a", fontSize: 14 }}>
                        {formatDayLabel(day.date, locale)}
                      </strong>
                      {day.isToday ? <StatusPill label="Oggi" tone="neutral" /> : null}
                    </div>

                    {day.shifts.length === 0 &&
                    (!features.availability || day.availabilities.length === 0) &&
                    (!features.requests || day.requests.length === 0) &&
                    day.courses.length === 0 &&
                    day.closures.length === 0 &&
                    day.tasks.length === 0 &&
                    day.notes.length === 0 ? (
                      <div style={{ color: "#94a3b8", fontSize: 12 }}>Nessun evento</div>
                    ) : null}

                    {(() => {
                      const cards: Array<{ key: string; node: ReactNode }> = [];
                      const maxVisible = 3;
                      const pushCard = (key: string, node: ReactNode) => {
                        if (cards.length < maxVisible) {
                          cards.push({ key, node });
                        }
                      };

                      if (features.shifts) {
                        for (const shift of day.shifts) {
                          pushCard(
                            `shift-${shift.id}`,
                            renderCompactShiftCard(shift, locale, true, () => {
                              setSelectedDate(day.date);
                              setActiveCalendarModal("shifts");
                              setEditingShiftId(null);
                            })
                          );
                        }
                      }

                      if (features.requests) {
                        for (const request of day.requests) {
                          pushCard(
                            `request-${request.id}`,
                            <div
                              key={request.id}
                              style={{
                                padding: "7px 9px",
                                borderRadius: 12,
                                background: "#fef2f2",
                                border: "1px solid #fecaca",
                                color: "#991b1b",
                                lineHeight: 1.35,
                                fontSize: 12,
                              }}
                            >
                              {formatRequestTypeLabel(request.type)}: {request.firstName} {request.lastName}
                            </div>
                          );
                        }
                      }

                      if (features.tasks) {
                        for (const task of day.tasks) {
                          pushCard(
                            `task-${task.id}`,
                            renderTaskPreviewCard(task, true, () => {
                              setSelectedDate(day.date);
                              setActiveCalendarModal("notes");
                            })
                          );
                        }
                      }

                      if (features.noticeBoard) {
                        for (const note of day.notes) {
                          pushCard(
                            `note-${note.id}`,
                            renderNotePreviewCard(note, true, () => {
                              setSelectedDate(day.date);
                              setActiveCalendarModal("notes");
                            })
                          );
                        }
                      }

                      if (features.courses) {
                        for (const course of day.courses) {
                          pushCard(
                            `course-${course.id}`,
                            <div
                              key={course.id}
                              style={{
                                padding: "7px 9px",
                                borderRadius: 12,
                                background: "#eef2ff",
                                border: "1px solid #c7d2fe",
                                color: "#3730a3",
                                lineHeight: 1.35,
                                fontSize: 12,
                              }}
                            >
                              🎓 {truncateCalendarText(course.title)}
                            </div>
                          );
                        }
                      }

                      for (const closure of day.closures) {
                        pushCard(
                          `closure-${closure.id}`,
                          <div
                            key={closure.id}
                            style={{
                              padding: "7px 9px",
                              borderRadius: 12,
                              background: "#fff7ed",
                              border: "1px solid #fed7aa",
                              color: "#9a3412",
                              lineHeight: 1.35,
                              fontSize: 12,
                            }}
                          >
                            {truncateCalendarText(closure.title)}
                          </div>
                        );
                      }

                      if (features.availability) {
                        for (const availability of day.availabilities) {
                          pushCard(
                            `availability-${availability.id}`,
                            <div
                              key={availability.id}
                              style={{
                                padding: "7px 9px",
                                borderRadius: 12,
                                background: "#fef2f2",
                                border: "1px solid #fecaca",
                                color: "#991b1b",
                                lineHeight: 1.35,
                                fontSize: 12,
                              }}
                            >
                              Indisponibile: {availability.firstName} {availability.lastName}
                            </div>
                          );
                        }
                      }

                      const totalCount =
                        (features.shifts ? day.shifts.length : 0) +
                        (features.requests ? day.requests.length : 0) +
                        (features.tasks ? day.tasks.length : 0) +
                        (features.noticeBoard ? day.notes.length : 0) +
                        (features.courses ? day.courses.length : 0) +
                        day.closures.length +
                        (features.availability ? day.availabilities.length : 0);
                      const hiddenCount = Math.max(0, totalCount - cards.length);

                      return (
                        <>
                          {cards.map((card) => card.node)}
                          {hiddenCount > 0 ? (
                            <div
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedDate(day.date);
                                setActiveCalendarModal("day");
                              }}
                              style={{
                                padding: "6px 9px",
                                borderRadius: 12,
                                background: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                color: "#475569",
                                lineHeight: 1.3,
                                fontSize: 12,
                                fontWeight: 800,
                                cursor: "pointer",
                              }}
                            >
                              +{hiddenCount}
                            </div>
                          ) : null}
                        </>
                      );
                    })()}

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
                      timeZone: APP_TIME_ZONE,
                    }).format(new Date(day.date))}
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

                <div
                  style={{
                    position: "fixed",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    zIndex: 2147483647,
                    display: features.shifts && showShiftComposer ? "grid" : "none",
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
                    const draftMemberNames =
                      draft.memberIds
                        .map((memberId) => members.find((member) => member.id === memberId))
                        .filter(Boolean)
                        .map((member) => `${member?.firstName} ${member?.lastName}`)
                        .join(", ") || "Nessuna persona";

                    return (
                      <div
                        key={draft.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          padding: "10px 12px",
                          borderRadius: 16,
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentShiftDraft(draft);
                            removeShiftDraft(draft.id);
                          }}
                          style={{
                            flex: "1 1 auto",
                            minWidth: 0,
                            border: 0,
                            background: "transparent",
                            padding: 0,
                            textAlign: "left",
                            display: "grid",
                            gap: 3,
                            color: "#0f172a",
                          }}
                        >
                          <strong style={{ fontSize: 13 }}>{draftMemberNames}</strong>
                          <span style={{ color: "#64748b", fontSize: 12 }}>
                            {draft.date} · {draft.startTime} - {draft.endTime}
                          </span>
                        </button>
                        <div style={{ display: "flex", gap: 6 }}>
                          <IconButton
                            type="button"
                            onClick={() => {
                              setCurrentShiftDraft(draft);
                              removeShiftDraft(draft.id);
                            }}
                            aria-label="Modifica turno"
                            disabled={isPending}
                          >
                            ✎
                          </IconButton>
                          <IconButton
                            type="button"
                            onClick={() => removeShiftDraft(draft.id)}
                            aria-label="Elimina turno"
                            disabled={isPending}
                          >
                            ×
                          </IconButton>
                        </div>
                      </div>
                    );

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
                              min={todayKey}
                              value={draft.date}
                              onChange={(event) =>
                                updateShiftDraft(draft.id, {
                                  date:
                                    event.target.value && event.target.value < todayKey
                                      ? todayKey
                                      : event.target.value,
                                })
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

                  {currentShiftDraft ? (
                    <div
                      key={currentShiftDraft.id}
                      style={{
                        display: "grid",
                        gap: 12,
                        padding: 16,
                        borderRadius: 22,
                        background: "#f8fafc",
                        border: "1px solid #dbe3ee",
                      }}
                    >
                      <strong style={{ color: "#0f172a" }}>Nuovo turno</strong>

                      {presets.length > 0 ? (
                        <label style={{ display: "grid", gap: 8 }}>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>Orario standard</span>
                          <Select
                            value={currentShiftDraft.presetKey}
                            onChange={(event) => applyPresetToCurrent(event.target.value)}
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
                            min={todayKey}
                            value={currentShiftDraft.date}
                            onChange={(event) =>
                              updateCurrentShiftDraft({
                                date:
                                  event.target.value && event.target.value < todayKey
                                    ? todayKey
                                    : event.target.value,
                              })
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
                            value={currentShiftDraft.startTime}
                            onChange={(value) =>
                              updateCurrentShiftDraft({
                                presetKey: "CUSTOM",
                                startTime: value,
                              })
                            }
                          />
                        </label>

                        <label style={{ display: "grid", gap: 8 }}>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>Orario di fine</span>
                          <TimeInput
                            value={currentShiftDraft.endTime}
                            onChange={(value) =>
                              updateCurrentShiftDraft({
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
                          checked={currentShiftDraft.isOnCall}
                          onChange={(event) =>
                            updateCurrentShiftDraft({ isOnCall: event.target.checked })
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
                          {members.map((member) => {
                            const blockedMemberReasons = getBlockedMemberReasons(currentShiftDraft);

                            return (
                              <label
                                key={member.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  padding: "12px 14px",
                                  borderRadius: 16,
                                  border: "1px solid #e2e8f0",
                                  background: currentShiftDraft.memberIds.includes(member.id)
                                    ? "#e2e8f0"
                                    : "#ffffff",
                                  color: blockedMemberReasons.has(member.id) ? "#94a3b8" : "#0f172a",
                                  opacity: blockedMemberReasons.has(member.id) ? 0.6 : 1,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={currentShiftDraft.memberIds.includes(member.id)}
                                  disabled={blockedMemberReasons.has(member.id)}
                                  onChange={() => toggleCurrentDraftMember(member.id)}
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
                            );
                          })}
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <IconButton
                          type="button"
                          onClick={addShiftDraft}
                          aria-label="Aggiungi turno alla lista"
                          disabled={isPending || !isShiftDraftValid(currentShiftDraft)}
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 999,
                            background: isShiftDraftValid(currentShiftDraft) ? "#dcfce7" : "#f1f5f9",
                            color: isShiftDraftValid(currentShiftDraft) ? "#166534" : "#94a3b8",
                            border: "1px solid #bbf7d0",
                          }}
                        >
                          ✓
                        </IconButton>
                      </div>
                    </div>
                  ) : null}

                  <div
                    style={{
                      display: "none",
                      justifyContent: "flex-end",
                      gap: 10,
                    }}
                  >
                    <IconButton
                      type="button"
                      onClick={addShiftDraft}
                      aria-label="Aggiungi turno alla lista"
                      disabled={isPending || !isShiftDraftValid(currentShiftDraft)}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 999,
                        background: isShiftDraftValid(currentShiftDraft) ? "#dcfce7" : "#f1f5f9",
                        color: isShiftDraftValid(currentShiftDraft) ? "#166534" : "#94a3b8",
                        border: "1px solid #bbf7d0",
                      }}
                    >
                      ✓
                    </IconButton>
                  </div>

                  <div
                    className="dashboard-modal-actions"
                    style={{ display: "flex", justifyContent: "flex-end" }}
                  >
                    <PrimaryButton
                      type="button"
                      onClick={handleCreateShifts}
                      disabled={
                        isPending ||
                        !shiftDrafts
                          .concat(
                            isShiftDraftValid(currentShiftDraft) && currentShiftDraft
                              ? [currentShiftDraft]
                              : []
                          )
                          .some(
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

                    {features.requests && showRequestComposer ? (
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
                              {features.overtime ? (
                                <option value={RequestType.OVERTIME}>Straordinario</option>
                              ) : null}
                            </select>
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
                          <textarea
                            value={requestReason}
                            onChange={(event) => setRequestReason(event.target.value)}
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
                    ) : null}

                    {features.availability && showAvailabilityComposer ? (
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
                        <textarea
                          value={availabilityReason}
                          onChange={(event) => setAvailabilityReason(event.target.value)}
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
                    ) : null}
                  </>
                ) : null}

                {selectedDay &&
                activeCalendarModal !== "notes" &&
                (features.shifts || features.requests || features.tasks || features.noticeBoard) ? (
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
                      onClick={() => {
                        setShowShiftComposer(true);
                        if (!currentShiftDraft) {
                          setCurrentShiftDraft(createShiftDraft(day.date));
                        }
                      }}
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
                        <div
                          className="dashboard-list-card"
                          key={shift.id}
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
                          <IconButton
                            type="button"
                            onClick={() => setEditingShiftId(shift.id)}
                            disabled={isPending}
                            aria-label="Modifica turno"
                          >
                            ✎
                          </IconButton>
                        </div>
                      ))}
                    </div>
                  )}
                  </div>
                ) : null}

                {activeCalendarModal === "day" && features.shifts && (selectedDay?.pendingOnCallShifts ?? []).filter(
                  (shift) => shift.assignments.some((assignment) => assignment.id === currentUserId)
                ).length > 0 ? (
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
                                onClick={() => handleConfirmOnCall(shift.id)}
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

                {activeCalendarModal === "day" && features.requests ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <strong style={{ fontSize: 18, color: "#0f172a" }}>Assenze del giorno</strong>
                    <CountBadge
                      count={
                        (features.availability ? day.availabilities.length : 0) +
                        (features.requests ? day.requests.length : 0)
                      }
                    />
                  </div>

                  {((features.availability ? day.availabilities.length : 0) +
                    (features.requests ? day.requests.length : 0)) === 0 ? (
                    <div style={{ color: "#64748b" }}>
                      Nessuna assenza registrata in questa giornata.
                    </div>
                  ) : (
                    <div className="dashboard-scroll-list" style={{ display: "grid", gap: 10 }}>
                      {features.availability
                        ? day.availabilities.map((availability) =>
                            renderAvailabilityCard(availability, true)
                          )
                        : null}
                      {features.requests
                        ? day.requests.map((request) =>
                            renderApprovedRequestCard(request, true)
                          )
                        : null}
                    </div>
                  )}
                </div>
                ) : null}

                {activeCalendarModal !== "shifts" && features.tasks ? (
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
                      📌 Note del{" "}
                      {new Intl.DateTimeFormat(locale, {
                        day: "numeric",
                        month: "long",
                        timeZone: APP_TIME_ZONE,
                      }).format(new Date(day.date))}
                    </strong>
                    <CountBadge count={day.tasks.length + day.notes.length} />
                    <IconButton
                      type="button"
                      onClick={() => setQuickComposer("task")}
                      aria-label="Aggiungi note"
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
                  {day.tasks.length === 0 && day.notes.length === 0 ? (
                    <div style={{ color: "#64748b" }}>Nessuna nota collegata a questa giornata.</div>
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
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: task.status !== "DONE" ? "minmax(0, 1fr) auto" : "1fr",
                              gap: 12,
                              alignItems: "center",
                            }}
                          >
                            <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
                            <strong style={{ color: "#0f172a" }}>{task.title}</strong>
                            <span style={{ color: "#475569" }}>{task.assignedLabel}</span>
                            {task.completedByLabel ? (
                              <span style={{ color: "#64748b", fontSize: 14 }}>
                                Completata da {task.completedByLabel}
                              </span>
                            ) : null}
                            </div>
                            {task.status !== "DONE" ? (
                              <IconButton
                                type="button"
                                aria-label="Conferma nota"
                                title="Conferma nota"
                                onClick={() => handleCompleteTask(task.id)}
                                disabled={isPending}
                                style={{
                                  width: 46,
                                  height: 46,
                                  background: "#dcfce7",
                                  color: "#166534",
                                  border: "1px solid #bbf7d0",
                                  flexShrink: 0,
                                }}
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                  <path
                                    d="m5 12 4 4 10-10"
                                    stroke="currentColor"
                                    strokeWidth="2.4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </IconButton>
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
                        </div>
                      ))}
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
                          <strong style={{ color: "#0f172a" }}>{note.content}</strong>
                          <span style={{ color: "#64748b", fontSize: 14 }}>
                            {note.authorName} - {formatDayTime(note.createdAt, locale)}
                          </span>
                          <div
                            style={{
                              display: "flex",
                              gap: 10,
                              alignItems: "flex-start",
                              justifyContent: "space-between",
                            }}
                          >
                            <div>{renderNoteConfirmations(note, locale)}</div>
                            {note.requiresConfirmation &&
                            !note.confirmations.some(
                              (confirmation) => confirmation.userId === currentUserId
                            ) &&
                            (!note.employeeId || note.employeeId === currentUserId) ? (
                              <form action={confirmBoardNoteReadAction}>
                                <input type="hidden" name="noteId" value={note.id} />
                                <IconButton
                                  type="submit"
                                  aria-label="Conferma lettura"
                                  title="Conferma lettura"
                                  style={{
                                    background: "#dcfce7",
                                    color: "#166534",
                                    border: "1px solid #bbf7d0",
                                  }}
                                >
                                  ✓
                                </IconButton>
                              </form>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                ) : null}

              </section>
            </div>,
            document.body
          )
        : null}

      <ShiftEditorModal
        open={Boolean(editingShift)}
        locale={locale}
        canManage
        currentUserId={currentUserId}
        shift={editingShift}
        members={members}
        presets={presets}
        onClose={closeModal}
      />
      <QuickCalendarEntryModal
        open={Boolean(
          selectedDay &&
            quickComposer &&
            ((quickComposer === "task" && features.tasks) ||
              (quickComposer === "board" && features.noticeBoard))
        )}
        mode={quickComposer}
        dateIso={day.date ?? null}
        members={members}
        canPinBoard
        isPending={isPending}
        onClose={closeModal}
        onSubmitTask={handleQuickTaskCreate}
        onSubmitBoard={handleQuickBoardCreate}
      />
    </>
  );
}
