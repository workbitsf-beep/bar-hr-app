"use client";

import { ActivityType, RequestType, Role } from "@prisma/client";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { combineDateAndTime } from "@/lib/shift-datetime";
import { APP_TIME_ZONE, toDateInputValueInTimeZone } from "@/lib/time-zone";
import type { ShiftPreset } from "@/lib/shift-presets";
import type { FeatureFlags } from "@/lib/features";
import { TimeInput } from "@/app/components/time-input";
import {
  completeTaskAction,
  createBoardNoteAction,
  createShiftAction,
  createTaskAction,
  confirmBoardNoteReadAction,
  confirmShiftAction,
} from "../actions";
import { ShiftEditorModal } from "../shifts/shift-editor-modal";
import { IconButton, PrimaryButton, Select, StatusPill, SuccessCallout, TextInput } from "../ui";
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
  requiresConfirmation: boolean;
  employeeId: string | null;
  activityDate: string;
  createdAt: string;
  authorName: string;
  confirmations: Array<{
    userId: string;
    userName: string;
    readAt: string;
  }>;
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

type CalendarModalMode = "day" | "shifts" | "notes";
type ShiftInsertMode = "DAY" | "EMPLOYEE";

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

const shiftRepeatWeekdays = [
  { value: "1", label: "Lun" },
  { value: "2", label: "Mar" },
  { value: "3", label: "Mer" },
  { value: "4", label: "Gio" },
  { value: "5", label: "Ven" },
  { value: "6", label: "Sab" },
  { value: "0", label: "Dom" },
];

function dateKeyToLocalDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function formatLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = dateKeyToLocalDate(dateKey);
  date.setDate(date.getDate() + days);
  return formatLocalDateKey(date);
}

function startOfWeekDateKey(dateKey: string) {
  const date = dateKeyToLocalDate(dateKey);
  const diff = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - diff);
  return formatLocalDateKey(date);
}

function createRepeatedShiftDrafts(
  draft: ShiftDraft,
  mode: ShiftInsertMode,
  weekdays: string[],
  todayKey: string
) {
  if (mode === "DAY") {
    return [{ ...draft, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` }];
  }

  const weekStart = startOfWeekDateKey(draft.date);
  const selectedWeekdays = weekdays.length > 0 ? weekdays : [String(dateKeyToLocalDate(draft.date).getDay())];
  const dateKeys = shiftRepeatWeekdays
    .filter((day) => selectedWeekdays.includes(day.value))
    .map((day) => addDaysToDateKey(weekStart, Number(day.value) === 0 ? 6 : Number(day.value) - 1));

  return dateKeys
    .filter((dateKey) => dateKey >= todayKey)
    .map((dateKey) => ({
      ...draft,
      id: `${Date.now()}-${dateKey}-${Math.random().toString(36).slice(2)}`,
      date: dateKey,
    }));
}

function sortShiftDraftsByDateTime(drafts: ShiftDraft[]) {
  return drafts.slice().sort((left, right) => {
    const leftKey = `${left.date}T${left.startTime || "00:00"}`;
    const rightKey = `${right.date}T${right.startTime || "00:00"}`;
    return leftKey.localeCompare(rightKey);
  });
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
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
}

function formatTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
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
    return "Responsabile";
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
  const day = toDateInputValueInTimeZone(dateIso);
  return `${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Operazione non riuscita.";
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

type WeekBadgeTone = "note" | "vacation" | "permission" | "course" | "availability" | "onCall" | "overtime" | "closure";

type WeekBadge = {
  key: string;
  label: string;
  count: number;
  tone: WeekBadgeTone;
};

const WEEK_BADGE_STYLES: Record<WeekBadgeTone, { background: string; border: string; color: string }> = {
  note: { background: "#f8fafc", border: "#e2e8f0", color: "#334155" },
  vacation: { background: "#ede9fe", border: "#ddd6fe", color: "#5b21b6" },
  permission: { background: "#fff7ed", border: "#fed7aa", color: "#9a3412" },
  course: { background: "#eef2ff", border: "#c7d2fe", color: "#3730a3" },
  availability: { background: "#fef2f2", border: "#fecaca", color: "#991b1b" },
  onCall: { background: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
  overtime: { background: "#fef3c7", border: "#fde68a", color: "#92400e" },
  closure: { background: "#f1f5f9", border: "#cbd5e1", color: "#475569" },
};

function getRequestBadge(type: string): { key: string; label: string; tone: WeekBadgeTone } {
  if (type === RequestType.OVERTIME) {
    return { key: "overtime", label: "⭐ Straordinari", tone: "overtime" };
  }

  if (type === RequestType.PERMISSION) {
    return { key: "permission", label: "🟠 Permessi", tone: "permission" };
  }

  if (type === RequestType.SICKNESS) {
    return { key: "sickness", label: "🏥 Malattia", tone: "availability" };
  }

  return { key: "vacation", label: "🏖️ Ferie", tone: "vacation" };
}

function buildWeekBadges(day: DayItem, features: FeatureFlags): WeekBadge[] {
  const badges = new Map<string, WeekBadge>();
  const addBadge = (key: string, label: string, count: number, tone: WeekBadgeTone) => {
    if (count <= 0) {
      return;
    }

    const current = badges.get(key);
    badges.set(key, {
      key,
      label,
      tone,
      count: (current?.count ?? 0) + count,
    });
  };

  if (features.tasks || features.noticeBoard) {
    addBadge("notes", "📌 Note", (features.tasks ? day.tasks.length : 0) + (features.noticeBoard ? day.notes.length : 0), "note");
  }

  if (features.requests) {
    for (const request of [...day.requests, ...day.pendingRequests]) {
      const badge = getRequestBadge(request.type);
      addBadge(badge.key, badge.label, 1, badge.tone);
    }
  }

  if (features.courses) {
    addBadge("courses", "🎓 Corsi", day.courses.length, "course");
  }

  if (features.availability) {
    addBadge("availability", "🚫 Indisponibilità", day.availabilities.length, "availability");
  }

  if (features.shifts) {
    addBadge("on-call", "📍 Reperibilità", day.shifts.filter((shift) => shift.isOnCall).length, "onCall");
  }

  addBadge("closures", "Chiusure", day.closures.length, "closure");

  return Array.from(badges.values());
}

function renderWeekBadge(badge: WeekBadge, onOpen: () => void) {
  const style = WEEK_BADGE_STYLES[badge.tone];

  return (
    <button
      key={badge.key}
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen();
      }}
      style={{
        border: `1px solid ${style.border}`,
        background: style.background,
        color: style.color,
        borderRadius: 999,
        padding: "4px 8px",
        fontSize: 11,
        fontWeight: 850,
        lineHeight: 1,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {badge.label} +{badge.count}
    </button>
  );
}

function renderWeekSection(title: string, children: ReactNode) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <strong style={{ color: "#0f172a", fontSize: 12 }}>{title}</strong>
      <div style={{ display: "grid", gap: 6 }}>{children}</div>
    </div>
  );
}

function renderCompactTextCard(key: string, title: string, meta: string, tone: WeekBadgeTone = "note") {
  const style = WEEK_BADGE_STYLES[tone];

  return (
    <div
      key={key}
      style={{
        padding: "7px 9px",
        borderRadius: 12,
        background: style.background,
        border: `1px solid ${style.border}`,
        color: style.color,
        lineHeight: 1.35,
        fontSize: 12,
      }}
    >
      <strong style={{ display: "block", color: "#0f172a", fontSize: 12 }}>
        {truncateCalendarText(title, 42)}
      </strong>
      <span style={{ color: style.color, fontSize: 11 }}>{meta}</span>
    </div>
  );
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

function renderShiftCard(
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
        display: "block",
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
          {formatRange(shift.startTime, shift.endTime, locale)}
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
            fontSize: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {renderShiftStateIcon(Boolean(shift.confirmedAt), mobile ? 14 : 14)}
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
      onClick={(event) => event.stopPropagation()}
      style={{
        padding: mobile ? "8px 10px" : "10px 12px",
        borderRadius: mobile ? 12 : 16,
        background: "#fef2f2",
        border: "1px solid #fecaca",
        color: "#991b1b",
        lineHeight: mobile ? 1.35 : 1.6,
        fontSize: mobile ? 12 : 13,
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <strong style={{ color: "#991b1b", fontSize: mobile ? 12 : 13 }}>
          Indisponibilita: {availability.firstName} {availability.lastName}
        </strong>
        <span style={{ color: "#b91c1c" }}>
          {formatRange(availability.startsAt, availability.endsAt, "it-IT")}
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

function renderApprovedRequestCard(request: RequestItem, mobile = false) {
  return (
    <div
      key={request.id}
      onClick={(event) => event.stopPropagation()}
      style={{
        padding: mobile ? "8px 10px" : "10px 12px",
        borderRadius: mobile ? 12 : 16,
        background: "#fef2f2",
        border: "1px solid #fecaca",
        color: "#991b1b",
        lineHeight: mobile ? 1.35 : 1.6,
        fontSize: mobile ? 12 : 13,
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <strong style={{ color: "#991b1b", fontSize: mobile ? 12 : 13 }}>
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

function renderCourseCard(course: CourseItem, locale: string, mobile = false) {
  return (
    <div
      key={course.id}
      onClick={(event) => event.stopPropagation()}
      style={{
        padding: mobile ? 8 : "10px 12px",
        borderRadius: mobile ? 12 : 16,
        background: "#eef2ff",
        border: "1px solid #c7d2fe",
        display: "grid",
        gap: mobile ? 3 : 4,
      }}
    >
      <strong style={{ color: "#0f172a", fontSize: mobile ? 13 : 14 }}>{course.title}</strong>
      <span style={{ color: "#475569", fontSize: mobile ? 12 : 13 }}>
        {formatRange(course.startTime, course.endTime, locale)}
      </span>
      <span style={{ color: "#64748b", fontSize: mobile ? 11 : 12, lineHeight: 1.35 }}>
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
      onClick={(event) => event.stopPropagation()}
      style={{
        padding: mobile ? "8px 10px" : "10px 12px",
        borderRadius: mobile ? 12 : 16,
        background: "#fff7ed",
        border: "1px solid #fed7aa",
        color: "#9a3412",
        lineHeight: mobile ? 1.35 : 1.6,
        fontSize: mobile ? 12 : 13,
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <strong style={{ color: "#9a3412", fontSize: mobile ? 12 : 13 }}>
          Da approvare: {request.firstName} {request.lastName}
        </strong>
        <span style={{ color: "#b45309" }}>
          {formatRange(request.startsAt, request.endsAt, "it-IT")}
        </span>
        {request.reason ? <span style={{ color: "#92400e" }}>{request.reason}</span> : null}
      </div>
    </div>
  );
}

function renderPendingOnCallCard(shift: ShiftItem, locale: string, mobile = false) {
  return (
    <div
      key={shift.id}
      style={{
        padding: mobile ? "8px 10px" : "10px 12px",
        borderRadius: mobile ? 12 : 16,
        background: "#fff7ed",
        border: "1px solid #fed7aa",
        color: "#9a3412",
        lineHeight: mobile ? 1.35 : 1.6,
        fontSize: mobile ? 12 : 13,
        display: "grid",
        gap: mobile ? 3 : 6,
      }}
    >
      <strong style={{ color: "#0f172a", fontSize: mobile ? 12 : 13 }}>
        Reperibilita da approvare
      </strong>
      <span style={{ color: "#334155" }}>{formatRange(shift.startTime, shift.endTime, locale)}</span>
      <span style={{ color: "#475569" }}>{formatAssignmentNames(shift.assignments)}</span>
    </div>
  );
}

function renderTaskCard(
  task: TaskItem,
  mobile = false,
  onComplete?: (taskId: string) => void,
  isPending = false
) {
  const canComplete = task.status !== "DONE" && Boolean(onComplete);

  return (
    <div
      key={task.id}
      style={{
        padding: mobile ? 10 : "10px 12px",
        borderRadius: mobile ? 14 : 16,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        display: "grid",
        gap: mobile ? 6 : 6,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
          <strong style={{ color: "#0f172a", fontSize: mobile ? 13 : 14 }}>{task.title}</strong>
          <span style={{ color: "#475569", fontSize: mobile ? 12 : 13 }}>{task.assignedLabel}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <StatusPill
          label={task.status === "DONE" ? "Completata" : task.isUrgent ? "Urgente" : "Da fare"}
          tone={task.status === "DONE" ? "success" : task.isUrgent ? "danger" : "warning"}
        />
        {task.completedByLabel ? (
          <span style={{ color: "#64748b", fontSize: mobile ? 12 : 12, fontWeight: 700 }}>
            Completata da: {task.completedByLabel}
          </span>
        ) : null}
        {canComplete ? (
          <IconButton
            type="button"
            aria-label="Conferma nota"
            title="Conferma nota"
            onClick={() => onComplete?.(task.id)}
            disabled={isPending}
            style={{
              width: mobile ? 34 : 38,
              height: mobile ? 34 : 38,
              background: "#dcfce7",
              color: "#166534",
              border: "1px solid #bbf7d0",
              flexShrink: 0,
              fontSize: 14,
              fontWeight: 900,
            }}
          >
            ✓
          </IconButton>
        ) : null}
      </div>
    </div>
  );
}

function renderNoteCard(note: NoteItem, locale: string, currentUserId: string, mobile = false) {
  const currentUserConfirmed = note.confirmations.some(
    (confirmation) => confirmation.userId === currentUserId
  );
  const canConfirm =
    note.requiresConfirmation && !currentUserConfirmed && (!note.employeeId || note.employeeId === currentUserId);

  return (
    <div
      key={note.id}
      style={{
        padding: mobile ? 10 : "10px 12px",
        borderRadius: mobile ? 14 : 16,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        display: "grid",
        gap: mobile ? 5 : 4,
      }}
    >
      <div style={{ color: "#334155", lineHeight: mobile ? 1.35 : 1.6, fontSize: mobile ? 12 : 13 }}>
        {note.content}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {note.isPinned ? <StatusPill label="Fissato" tone="warning" /> : null}
        <span style={{ color: "#64748b", fontSize: mobile ? 11 : 12 }}>
          {note.authorName} - {formatTime(note.createdAt, locale)}
        </span>
      </div>
      {note.requiresConfirmation ? (
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            {note.confirmations.length === 0 ? (
              <span style={{ color: "#94a3b8", fontSize: mobile ? 11 : 12 }}>
                Nessuna conferma
              </span>
            ) : (
              note.confirmations.map((confirmation) => (
                <span
                  key={`${note.id}-${confirmation.userId}`}
                  style={{ color: "#64748b", fontSize: mobile ? 11 : 12 }}
                >
                  ✓ {confirmation.userName} - {formatTime(confirmation.readAt, locale)}
                </span>
              ))
            )}
          </div>
          {canConfirm ? (
            <form action={confirmBoardNoteReadAction} onClick={(event) => event.stopPropagation()}>
              <input type="hidden" name="noteId" value={note.id} />
              <IconButton
                type="submit"
                aria-label="Conferma lettura"
                title="Conferma lettura"
                style={{
                  width: 38,
                  height: 38,
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
      ) : null}
    </div>
  );
}

export function DayActionCalendarClient({
  locale,
  days,
  filteredDay,
  initialFocusedDay,
  initialCalendarView,
  role,
  activityType,
  companyShiftsEnabled,
  members,
  presets,
  currentUserId,
  features,
  todayAction,
  publishAction,
}: {
  locale: string;
  weekdayLabels: string[];
  days: DayItem[];
  filteredDay?: string | null;
  initialFocusedDay?: string | null;
  initialCalendarView?: "week" | "day";
  role: string;
  activityType: ActivityType;
  companyShiftsEnabled: boolean;
  members: MemberOption[];
  presets: ShiftPreset[];
  currentUserId: string;
  features: FeatureFlags;
  todayAction?: ReactNode;
  publishAction?: ReactNode;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [calendarView, setCalendarView] = useState<"week" | "day">(initialCalendarView ?? "week");
  const [expandedWeekDays, setExpandedWeekDays] = useState<Set<string>>(() => new Set());
  const [focusedDayDate, setFocusedDayDate] = useState<string>(() => {
    const today = days.find((day) => day.isToday) ?? days[0];
    const initialDay = initialFocusedDay
      ? days.find((day) => day.date.slice(0, 10) === initialFocusedDay)
      : null;
    return filteredDay ?? initialDay?.date ?? today?.date ?? "";
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeCalendarModal, setActiveCalendarModal] = useState<CalendarModalMode | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [showShiftComposer, setShowShiftComposer] = useState(false);
  const [quickComposer, setQuickComposer] = useState<"task" | "board" | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [shiftDrafts, setShiftDrafts] = useState<ShiftDraft[]>([]);
  const [savedShiftDrafts, setSavedShiftDrafts] = useState<ShiftDraft[]>([]);
  const [currentShiftDraft, setCurrentShiftDraft] = useState<ShiftDraft | null>(null);
  const [shiftInsertMode, setShiftInsertMode] = useState<ShiftInsertMode>("DAY");
  const [selectedShiftWeekdays, setSelectedShiftWeekdays] = useState<string[]>([]);
  const [requestType, setRequestType] = useState<string>(RequestType.VACATION);
  const dayStripRef = useRef<HTMLDivElement | null>(null);
  const dayScrollTimerRef = useRef<number | null>(null);
  const skipDayScrollIntoViewRef = useRef(false);

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
    if (filteredDay || selectedDate || initialFocusedDay) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      scrollToTodayCard("instant");
    });

    return () => cancelAnimationFrame(frame);
  }, [filteredDay, initialFocusedDay, selectedDate]);

  useEffect(() => {
    const requestedDay = filteredDay
      ? days.find((day) => day.date.slice(0, 10) === filteredDay)
      : days.find((day) => day.date === focusedDayDate) ?? days.find((day) => day.isToday) ?? days[0];

    if (requestedDay && requestedDay.date !== focusedDayDate) {
      setFocusedDayDate(requestedDay.date);
    }
  }, [days, filteredDay, focusedDayDate]);

  useEffect(() => {
    function handleShowTodayAsDay() {
      const today = days.find((day) => day.isToday) ?? days[0];

      if (!today) {
        return;
      }

      setFocusedDayDate(today.date);
      setSelectedDate(null);
      setActiveCalendarModal(null);
      setFeedback(null);
    }

    window.addEventListener("workbit:calendar-show-today-day", handleShowTodayAsDay);

    return () => {
      window.removeEventListener("workbit:calendar-show-today-day", handleShowTodayAsDay);
    };
  }, [days]);

  useEffect(() => {
    if (calendarView !== "day" || !focusedDayDate) {
      return;
    }

    if (skipDayScrollIntoViewRef.current) {
      skipDayScrollIntoViewRef.current = false;
      return;
    }

    const frame = requestAnimationFrame(() => {
      const target = dayStripRef.current?.querySelector<HTMLElement>(
        `[data-day-date="${focusedDayDate}"]`
      );

      target?.scrollIntoView({
        behavior: "auto",
        block: "nearest",
        inline: "center",
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [calendarView, focusedDayDate]);

  useEffect(() => {
    return () => {
      if (dayScrollTimerRef.current !== null) {
        window.cancelAnimationFrame(dayScrollTimerRef.current);
      }
    };
  }, []);

  const selectedDay = useMemo(
    () => days.find((day) => day.date === selectedDate) ?? null,
    [days, selectedDate]
  );
  const selectedNote = useMemo(
    () => selectedDay?.notes.find((note) => note.id === selectedNoteId) ?? null,
    [selectedDay, selectedNoteId]
  );
  const editingShift = useMemo(
    () => selectedDay?.shifts.find((shift) => shift.id === editingShiftId) ?? null,
    [editingShiftId, selectedDay]
  );
  const weeks = useMemo(() => chunkByWeek(days), [days]);
  const focusedDayIndex = useMemo(
    () => Math.max(0, days.findIndex((day) => day.date === focusedDayDate)),
    [days, focusedDayDate]
  );
  const focusedDay = days[focusedDayIndex] ?? days.find((day) => day.isToday) ?? days[0] ?? null;
  const visibleWeeks = useMemo(
    () =>
      filteredDay
        ? weeks.filter((week) => week.some((day) => day.date.slice(0, 10) === filteredDay))
        : weeks,
    [filteredDay, weeks]
  );
  const visibleDayItems = useMemo(() => {
    if (filteredDay) {
      return focusedDay ? [focusedDay] : [];
    }

    return days;
  }, [days, filteredDay, focusedDay]);

  const toggleExpandedWeekDay = useCallback((date: string) => {
    setExpandedWeekDays((current) => {
      const next = new Set(current);

      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }

      return next;
    });
  }, []);

  function handleDayStripScroll() {
    if (calendarView !== "day" || filteredDay) {
      return;
    }

    if (dayScrollTimerRef.current !== null) {
      window.cancelAnimationFrame(dayScrollTimerRef.current);
    }

    dayScrollTimerRef.current = window.requestAnimationFrame(() => {
      const strip = dayStripRef.current;
      if (!strip) {
        return;
      }

      const center = strip.scrollLeft + strip.clientWidth / 2;
      const cards = Array.from(strip.querySelectorAll<HTMLElement>("[data-day-date]"));
      let nearestDate = focusedDayDate;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const card of cards) {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const distance = Math.abs(cardCenter - center);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestDate = card.dataset.dayDate ?? nearestDate;
        }
      }

      if (nearestDate && nearestDate !== focusedDayDate) {
        skipDayScrollIntoViewRef.current = true;
        setFocusedDayDate(nearestDate);
      }
    });
  }

  const isCompany = activityType === ActivityType.COMPANY;
  const canManageOptionalShifts =
    features.shifts && isCompany && companyShiftsEnabled && (role === Role.OWNER || role === Role.MANAGER);
  const canOpenTaskComposer = features.tasks;

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

    if (draft.isOnCall) {
      for (const userId of blocked.keys()) {
        blocked.set(userId, "Impossibile assegnare alla reperibilità: assente o indisponibile");
      }
    }

    return blocked;
  }

  function openDay(day: DayItem, mode: CalendarModalMode = "day") {
    setSelectedDate(day.date);
    setActiveCalendarModal(mode);
    setEditingShiftId(null);
    setShowShiftComposer(false);
    setQuickComposer(null);
    setFeedback(null);
    setShiftDrafts([]);
    setSavedShiftDrafts([]);
    setCurrentShiftDraft(createShiftDraft(day.date));
    setShiftInsertMode("DAY");
    setSelectedShiftWeekdays([]);
    setRequestType(RequestType.VACATION);
  }

  function moveFocusedDay(direction: -1 | 1) {
    if (!days.length) {
      return;
    }

    const nextIndex = Math.min(days.length - 1, Math.max(0, focusedDayIndex + direction));
    const nextDay = days[nextIndex];

    if (!nextDay || nextDay.date === focusedDayDate) {
      return;
    }

    setFocusedDayDate(nextDay.date);
    setSelectedDate(null);
    setActiveCalendarModal(null);
    setSelectedNoteId(null);
    setFeedback(null);
  }

  function closeModal() {
    if (isPending) {
      return;
    }

    setEditingShiftId(null);
    setActiveCalendarModal(null);
    setSelectedNoteId(null);
    setShowShiftComposer(false);
    setSelectedDate(null);
    setQuickComposer(null);
    setFeedback(null);
    setCurrentShiftDraft(null);
    setSavedShiftDrafts([]);
    setShiftInsertMode("DAY");
    setSelectedShiftWeekdays([]);
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

    const draftsToAdd = createRepeatedShiftDrafts(
      currentShiftDraft,
      shiftInsertMode,
      selectedShiftWeekdays,
      todayKey
    );

    if (draftsToAdd.length === 0) {
      setFeedback({ tone: "danger", message: "Seleziona almeno un giorno valido da oggi in poi." });
      return;
    }

    runAction(async () => {
      for (const draft of draftsToAdd) {
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

      setSavedShiftDrafts((current) => sortShiftDraftsByDateTime(current.concat(draftsToAdd)));
      setShiftDrafts([]);
      setCurrentShiftDraft(createShiftDraft(selectedDay.date));
    }, draftsToAdd.length === 1 ? "Turno salvato." : "Turni salvati.");
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

  function runAction(
    task: () => Promise<void>,
    successMessage: string,
    closeOnSuccess = false
  ) {
    startTransition(async () => {
      const refreshDate = selectedDay?.date.slice(0, 10);
      const refreshView = calendarView;

      try {
        await task();
        setFeedback({ tone: "success", message: successMessage });
        if (closeOnSuccess) {
          setEditingShiftId(null);
          setSelectedDate(null);
        }
        window.setTimeout(() => {
          if (refreshDate) {
            const url = new URL(window.location.href);
            url.searchParams.set("anchor", refreshDate);
            url.searchParams.delete("day");
            url.searchParams.set("view", refreshView);
            window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
          }
          router.refresh();
        }, 0);
      } catch (error) {
        setFeedback({ tone: "danger", message: getErrorMessage(error) });
      }
    });
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
    }, "Nota completata.");
  }

  function submitQuickTask(formData: FormData) {
    runAction(async () => {
      await createTaskAction(formData);
    }, "Nota aggiunta.");
  }

  function submitQuickBoard(formData: FormData) {
    runAction(async () => {
      await createBoardNoteAction(formData);
    }, "Nota pubblicata.");
  }

  const todayKey = toDateInputValueInTimeZone(new Date());

  return (
    <>
      <div
        style={{
          display: "grid",
          gap: 12,
          width: "100%",
          marginBottom: 14,
          overflow: "visible",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: todayAction ? "1fr 1fr 1fr" : "1fr 1fr",
            alignItems: "center",
            gap: 0,
            padding: 4,
            borderRadius: 999,
            background: "linear-gradient(135deg, #ffffff 0%, #f3e8ff 100%)",
            border: "1px solid rgba(124, 58, 237, 0.16)",
            maxWidth: "100%",
            width: "100%",
            boxShadow: "0 12px 26px rgba(88, 28, 135, 0.08)",
            overflow: "hidden",
          }}
        >
          {(["week", "day"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                if (calendarView === mode) {
                  return;
                }

                setCalendarView(mode);
              }}
              style={{
                border: 0,
                borderRadius: 999,
                minHeight: 42,
                padding: "0 12px",
                background: calendarView === mode ? "linear-gradient(135deg, #111936, #7c3aed)" : "transparent",
                color: calendarView === mode ? "#ffffff" : "#475569",
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {mode === "week" ? "Settimana" : "Giorno"}
            </button>
          ))}
          {todayAction}
        </div>
        {publishAction ? <div style={{ width: "100%" }}>{publishAction}</div> : null}
      </div>

      {calendarView === "day" ? (
        <div
          ref={dayStripRef}
          onScroll={handleDayStripScroll}
          style={{
            display: "flex",
            gap: 14,
            width: "100%",
            maxWidth: "100%",
            overflowX: "auto",
            overflowY: "hidden",
            scrollSnapType: "x mandatory",
            scrollPaddingInline: 12,
            padding: "2px 2px 12px",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
          }}
        >
          {visibleDayItems.map((day) => {
            const hasEvents =
              (features.shifts ? day.shifts.length : 0) +
                (features.requests ? day.requests.length + day.pendingRequests.length : 0) +
                (features.availability ? day.availabilities.length : 0) +
                (features.tasks ? day.tasks.length : 0) +
                (features.noticeBoard ? day.notes.length : 0) +
                (features.courses ? day.courses.length : 0) +
                day.closures.length >
              0;

            return (
              <section
                key={`day-view-${day.date}`}
                data-day-date={day.date}
                style={{
                  display: "grid",
                  gap: 10,
                  flex: "0 0 min(92%, 820px)",
                  width: "min(92%, 820px)",
                  scrollSnapAlign: "center",
                  alignSelf: "start",
                  minHeight: "auto",
                  padding: "12px min(14px, 4vw)",
                  borderRadius: 22,
                  background: "linear-gradient(145deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
                  border: "1px solid rgba(124,58,237,0.12)",
                  boxShadow: "0 12px 28px rgba(88, 28, 135, 0.07)",
                  boxSizing: "border-box",
                  touchAction: "pan-x pan-y",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  <IconButton
                    type="button"
                    onClick={() => moveFocusedDay(-1)}
                    disabled={focusedDayIndex <= 0}
                    aria-label="Giorno precedente"
                    style={{ width: 38, height: 38, display: "none" }}
                  >
                    ‹
                  </IconButton>
                  <div style={{ display: "grid", gap: 2, textAlign: "center", minWidth: 0 }}>
                    <strong style={{ color: "#0f172a", fontSize: 16, lineHeight: 1.15 }}>
                      {formatDayLabel(day.date, locale)}
                    </strong>
                    <span style={{ color: "#64748b", fontSize: 12, display: "none" }}>
                      Scorri per cambiare giorno
                    </span>
                  </div>
                  <IconButton
                    type="button"
                    onClick={() => moveFocusedDay(1)}
                    disabled={focusedDayIndex >= days.length - 1}
                    aria-label="Giorno successivo"
                    style={{ width: 38, height: 38, display: "none" }}
                  >
                    ›
                  </IconButton>
                </div>

                <div style={{ display: "none" }}>
                  {features.shifts &&
                  day.date.slice(0, 10) >= todayKey &&
                  canManageOptionalShifts ? (
                    <PrimaryButton
                      type="button"
                      tone="sand"
                      onClick={() => {
                        setSelectedDate(day.date);
                        setActiveCalendarModal("shifts");
                        setShowShiftComposer(true);
                        setCurrentShiftDraft(createShiftDraft(day.date));
                      }}
                      style={{ minHeight: 38, borderRadius: 999, paddingInline: 14 }}
                    >
                      + Turni
                    </PrimaryButton>
                  ) : null}
                </div>

                {!hasEvents ? <div style={{ color: "#64748b" }}>Nessun evento in questa giornata.</div> : null}

                {features.shifts && (day.shifts.length > 0 || canManageOptionalShifts) ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <strong>👤 Turni</strong>
                      {day.date.slice(0, 10) >= todayKey && canManageOptionalShifts ? (
                        <IconButton
                          type="button"
                          onClick={() => {
                            setSelectedDate(day.date);
                            setActiveCalendarModal("shifts");
                            setShowShiftComposer(true);
                            setCurrentShiftDraft(createShiftDraft(day.date));
                          }}
                          aria-label="Aggiungi turni"
                          disabled={isPending}
                          style={{ width: 32, height: 32 }}
                        >
                          +
                        </IconButton>
                      ) : null}
                    </div>
                    {day.shifts.length === 0 ? (
                      <div style={{ color: "#64748b" }}>Nessun turno in questa giornata.</div>
                    ) : null}
                    {day.shifts.map((shift) => renderShiftCard(shift, locale, true, () => {
                      setSelectedDate(day.date);
                      setActiveCalendarModal("shifts");
                      setEditingShiftId(null);
                    }))}
                  </div>
                ) : null}

                {features.requests && day.requests.length > 0 ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <strong>🏖️ Ferie / Permessi / Assenze</strong>
                    {day.requests.map((request) => renderApprovedRequestCard(request, true))}
                  </div>
                ) : null}

                {features.availability && day.availabilities.length > 0 ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <strong>🚫 Indisponibilità</strong>
                    {day.availabilities.map((availability) => renderAvailabilityCard(availability, true))}
                  </div>
                ) : null}

                {false && features.shifts && day.pendingOnCallShifts.length > 0 ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <strong>📍 Reperibilità</strong>
                    {day.pendingOnCallShifts.map((shift) => renderPendingOnCallCard(shift, locale, true))}
                  </div>
                ) : null}

                {features.tasks || features.noticeBoard ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <strong>📌 Note</strong>
                      {(features.tasks || features.noticeBoard) && day.date.slice(0, 10) >= todayKey ? (
                        <IconButton
                          type="button"
                          onClick={() => {
                            setSelectedDate(day.date);
                            setActiveCalendarModal("notes");
                            setQuickComposer("task");
                          }}
                          aria-label="Aggiungi note"
                          disabled={isPending}
                          style={{ width: 32, height: 32 }}
                        >
                          +
                        </IconButton>
                      ) : null}
                    </div>
                    {day.tasks.length === 0 && day.notes.length === 0 ? (
                      <div style={{ color: "#64748b" }}>Nessuna nota in questa giornata.</div>
                    ) : null}
                    {day.tasks.map((task) =>
                      renderTaskCard(task, true, submitTaskCompletion, isPending)
                    )}
                    {day.notes.map((note) => renderNoteCard(note, locale, currentUserId, true))}
                  </div>
                ) : null}

                {features.courses && day.courses.length > 0 ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <strong>🎓 Corsi</strong>
                    {day.courses.map((course) => renderCourseCard(course, locale, true))}
                  </div>
                ) : null}

                {day.closures.length > 0 ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <strong>🔒 Chiusure</strong>
                    {day.closures.map((closure) => (
                      <div key={closure.id} style={{ padding: "8px 10px", borderRadius: 12, background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", fontSize: 12, lineHeight: 1.35 }}>
                        {closure.title}
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : (
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
                    timeZone: APP_TIME_ZONE,
                  }).format(new Date(week[0].date))}
                  {" - "}
                  {new Intl.DateTimeFormat(locale, {
                    day: "numeric",
                    month: "long",
                    timeZone: APP_TIME_ZONE,
                  }).format(new Date(week[week.length - 1].date))}
                </span>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {week.map((day) => {
                  const isExpanded = expandedWeekDays.has(day.date);
                  const categoryBadges = buildWeekBadges(day, features);
                  const isPastDay = day.date.slice(0, 10) < todayKey;
                  const hasDayEvents = day.shifts.length > 0 || categoryBadges.length > 0;

                  return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => {
                      if (!isPastDay) {
                        openDay(day);
                      }
                    }}
                    title={
                      isPastDay
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
                        isPastDay
                          ? 0.58
                          : day.inCurrentMonth
                            ? 1
                            : 0.7,
                      textAlign: "left",
                      cursor: isPastDay ? "default" : "pointer",
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
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {day.isToday ? <StatusPill label="Oggi" tone="neutral" /> : null}
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={isExpanded ? "Comprimi giorno" : "Espandi giorno"}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleExpandedWeekDay(day.date);
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") {
                              return;
                            }

                            event.preventDefault();
                            event.stopPropagation();
                            toggleExpandedWeekDay(day.date);
                          }}
                          style={{
                            borderRadius: 999,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            minHeight: 28,
                            padding: "5px 10px",
                            background: isExpanded ? "linear-gradient(135deg, #f5f3ff, #ffffff)" : "#ffffff",
                            border: "1px solid rgba(124, 58, 237, 0.18)",
                            color: "#6d28d9",
                            fontSize: 11,
                            fontWeight: 900,
                            cursor: "pointer",
                            lineHeight: 1,
                            boxShadow: isExpanded ? "0 8px 18px rgba(124, 58, 237, 0.10)" : "none",
                            transition: "background 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
                          }}
                        >
                          <span>{isExpanded ? "Chiudi" : "Dettagli"}</span>
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                            style={{
                              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 140ms ease",
                            }}
                          >
                            <path
                              d="M7 10l5 5 5-5"
                              stroke="currentColor"
                              strokeWidth="2.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      </span>
                    </div>

                    {!hasDayEvents ? (
                      <div style={{ color: "#94a3b8", fontSize: 12 }}>Nessun evento</div>
                    ) : null}

                    {features.shifts && day.shifts.length > 0 ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        {day.shifts.map((shift) =>
                          renderShiftCard(shift, locale, true, () => {
                            setSelectedDate(day.date);
                            setActiveCalendarModal("shifts");
                            setEditingShiftId(null);
                          })
                        )}
                      </div>
                    ) : null}

                    {categoryBadges.length > 0 ? (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        {categoryBadges.map((badge) =>
                          renderWeekBadge(badge, () => toggleExpandedWeekDay(day.date))
                        )}
                      </div>
                    ) : null}

                    {isExpanded ? (
                      <div
                        style={{
                          display: "grid",
                          gap: 10,
                          marginTop: 4,
                          paddingTop: 8,
                          borderTop: "1px solid #eef2f7",
                          animation: "dashboardModalEnter 140ms ease-out",
                        }}
                      >
                        {features.requests && [...day.requests, ...day.pendingRequests].filter((request) => request.type === RequestType.PERMISSION).length > 0
                          ? renderWeekSection(
                              "🟠 Permessi",
                              <>
                                {day.requests
                                  .filter((request) => request.type === RequestType.PERMISSION)
                                  .map((request) => renderApprovedRequestCard(request, true))}
                                {day.pendingRequests
                                  .filter((request) => request.type === RequestType.PERMISSION)
                                  .map((request) => renderPendingRequestCard(request, true))}
                              </>
                            )
                          : null}
                        {features.requests && [...day.requests, ...day.pendingRequests].filter((request) => request.type === RequestType.VACATION).length > 0
                          ? renderWeekSection(
                              "🏖️ Ferie",
                              <>
                                {day.requests
                                  .filter((request) => request.type === RequestType.VACATION)
                                  .map((request) => renderApprovedRequestCard(request, true))}
                                {day.pendingRequests
                                  .filter((request) => request.type === RequestType.VACATION)
                                  .map((request) => renderPendingRequestCard(request, true))}
                              </>
                            )
                          : null}
                        {features.courses && day.courses.length > 0
                          ? renderWeekSection(
                              "🎓 Corsi",
                              day.courses.map((course) => renderCourseCard(course, locale, true))
                            )
                          : null}
                        {(features.tasks && day.tasks.length > 0) || (features.noticeBoard && day.notes.length > 0)
                          ? renderWeekSection(
                              "📌 Note",
                              <>
                                {features.tasks
                                  ? day.tasks.map((task) =>
                                      renderTaskPreviewCard(task, true, () => {
                                        setSelectedDate(day.date);
                                        setActiveCalendarModal("notes");
                                      })
                                    )
                                  : null}
                                {features.noticeBoard
                                  ? day.notes.map((note) =>
                                      renderNotePreviewCard(note, true, () => {
                                        setSelectedDate(day.date);
                                        setActiveCalendarModal("notes");
                                      })
                                    )
                                  : null}
                              </>
                            )
                          : null}
                        {features.availability && day.availabilities.length > 0
                          ? renderWeekSection(
                              "🚫 Indisponibilità",
                              day.availabilities.map((availability) => renderAvailabilityCard(availability, true))
                            )
                          : null}
                        {features.shifts && day.shifts.filter((shift) => shift.isOnCall).length > 0
                          ? renderWeekSection(
                              "📍 Reperibilità",
                              day.shifts
                                .filter((shift) => shift.isOnCall)
                                .map((shift) => renderPendingOnCallCard(shift, locale, true))
                            )
                          : null}
                        {features.requests && [...day.requests, ...day.pendingRequests].filter((request) => request.type === RequestType.OVERTIME).length > 0
                          ? renderWeekSection(
                              "⭐ Straordinari",
                              <>
                                {day.requests
                                  .filter((request) => request.type === RequestType.OVERTIME)
                                  .map((request) => renderApprovedRequestCard(request, true))}
                                {day.pendingRequests
                                  .filter((request) => request.type === RequestType.OVERTIME)
                                  .map((request) => renderPendingRequestCard(request, true))}
                              </>
                            )
                          : null}
                        {day.closures.length > 0
                          ? renderWeekSection(
                              "Chiusure",
                              day.closures.map((closure) =>
                                renderCompactTextCard(
                                  `closure-${closure.id}`,
                                  closure.title,
                                  formatRange(closure.startTime, closure.endTime, locale),
                                  "closure"
                                )
                              )
                            )
                          : null}
                      </div>
                    ) : null}

                    {false && (() => {
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
                            renderShiftCard(shift, locale, true, () => {
                              setSelectedDate(day.date);
                              setActiveCalendarModal("shifts");
                              setEditingShiftId(null);
                            })
                          );
                        }
                      }

                      if (features.requests) {
                        for (const request of day.requests) {
                          pushCard(`request-${request.id}`, renderApprovedRequestCard(request, true));
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
                          pushCard(`course-${course.id}`, renderCourseCard(course, locale, true));
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

                      if (features.requests) {
                        for (const request of day.pendingRequests) {
                          pushCard(`pending-${request.id}`, renderPendingRequestCard(request, true));
                        }
                      }

                      if (features.availability) {
                        for (const availability of day.availabilities) {
                          pushCard(`availability-${availability.id}`, renderAvailabilityCard(availability, true));
                        }
                      }

                      const totalCount =
                        (features.shifts ? day.shifts.length : 0) +
                        (features.requests ? day.requests.length + day.pendingRequests.length : 0) +
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
                  );
                })}
              </div>
            </section>
          );
        })}
      </CalendarWeekStrip>
      )}

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
                  background: "linear-gradient(180deg, #ffffff 0%, #fbf8ff 100%)",
                  border: "1px solid rgba(124, 58, 237, 0.16)",
                  borderRadius: 28,
                  boxShadow: "0 24px 60px rgba(88, 28, 135, 0.20)",
                  animation: "dashboardModalEnter 140ms ease-out",
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
                      timeZone: APP_TIME_ZONE,
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

                {features.shifts && activeCalendarModal !== "notes" ? (
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
                            if (!currentShiftDraft) {
                              setCurrentShiftDraft(createShiftDraft(selectedDay.date));
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

                    {showShiftComposer && canManageOptionalShifts ? createPortal(
                      <div
                        className="dashboard-modal-wrap"
                        style={{
                          position: "fixed",
                          inset: 0,
                          zIndex: 2147483647,
                          display: "grid",
                          placeItems: "center",
                          padding: 16,
                          background: "rgba(15, 23, 42, 0.28)",
                          backdropFilter: "blur(10px)",
                          WebkitBackdropFilter: "blur(10px)",
                          boxSizing: "border-box",
                        }}
                        onClick={() => setShowShiftComposer(false)}
                      >
                        <section
                          className="dashboard-modal-panel"
                          onClick={(event) => event.stopPropagation()}
                          style={{
                            position: "relative",
                            display: "grid",
                            gap: 12,
                            width: "min(92vw, 760px)",
                            maxHeight: "calc(100dvh - 32px)",
                            overflowY: "auto",
                            overflowX: "hidden",
                            padding: 18,
                            borderRadius: 28,
                            background: "linear-gradient(180deg, #ffffff 0%, #fbf8ff 100%)",
                            border: "1px solid rgba(124, 58, 237, 0.16)",
                            boxShadow: "0 24px 60px rgba(88, 28, 135, 0.20)",
                            boxSizing: "border-box",
                            animation: "dashboardModalEnter 120ms ease-out",
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
                        {savedShiftDrafts.length > 0 ? (
                          <div
                            style={{
                              display: "grid",
                              gap: 8,
                              maxHeight: 156,
                              overflowY: "auto",
                              padding: 10,
                              borderRadius: 18,
                              background: "rgba(248,250,252,0.92)",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            <span style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>
                              Turni salvati in questo inserimento
                            </span>
                            {savedShiftDrafts.map((draft) => {
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
                                    padding: "9px 11px",
                                    borderRadius: 14,
                                    background: "#ffffff",
                                    border: "1px solid #dbe3ee",
                                    minWidth: 0,
                                  }}
                                >
                                  <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                                    <strong
                                      style={{
                                        color: "#0f172a",
                                        fontSize: 13,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {draftMemberNames}
                                    </strong>
                                    <span style={{ color: "#64748b", fontSize: 12 }}>
                                      {draft.date} · {draft.startTime} - {draft.endTime}
                                      {draft.isOnCall ? " · Reperibilità" : ""}
                                    </span>
                                  </div>
                                  <span
                                    aria-label="Salvato"
                                    title="Salvato"
                                    style={{
                                      flexShrink: 0,
                                      width: 28,
                                      height: 28,
                                      borderRadius: 999,
                                      display: "grid",
                                      placeItems: "center",
                                      background: "#dcfce7",
                                      color: "#166534",
                                      fontWeight: 900,
                                    }}
                                  >
                                    ✓
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
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

                        {currentShiftDraft ? (
                          <div
                            key={currentShiftDraft.id}
                            style={{
                              display: "grid",
                              gap: 12,
                              padding: 16,
                              borderRadius: 20,
                              background: "#ffffff",
                              border: "1px solid #dbe3ee",
                            }}
                          >
                            <strong style={{ color: "#0f172a" }}>Nuovo turno</strong>

                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                                gap: 8,
                                padding: 4,
                                borderRadius: 999,
                                background: "#eef2ff",
                                border: "1px solid #ddd6fe",
                              }}
                            >
                              {[
                                { value: "DAY" as ShiftInsertMode, label: "Per giorno" },
                                { value: "EMPLOYEE" as ShiftInsertMode, label: "Per dipendente" },
                              ].map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => {
                                    setShiftInsertMode(option.value);
                                    setSelectedShiftWeekdays([]);
                                  }}
                                  style={{
                                    border: 0,
                                    borderRadius: 999,
                                    padding: "9px 12px",
                                    background: shiftInsertMode === option.value ? "#4c1d95" : "transparent",
                                    color: shiftInsertMode === option.value ? "#ffffff" : "#475569",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                  }}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>

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
                              {shiftInsertMode === "DAY" ? (
                                <label style={{ display: "grid", gap: 8 }}>
                                  <span style={{ fontWeight: 600, color: "#1e293b" }}>Giorno</span>
                                  <TextInput
                                    type="date"
                                    value={currentShiftDraft.date}
                                    onChange={(event) =>
                                      updateCurrentShiftDraft({ date: event.target.value })
                                    }
                                  />
                                </label>
                              ) : null}

                              <label style={{ display: "grid", gap: 8 }}>
                                <span style={{ fontWeight: 600, color: "#1e293b" }}>Inizio</span>
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
                                <span style={{ fontWeight: 600, color: "#1e293b" }}>Fine</span>
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

                            {shiftInsertMode === "EMPLOYEE" ? (
                              <div style={{ display: "grid", gap: 12 }}>
                                <div
                                  className="dashboard-modal-body-grid"
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                                    gap: 12,
                                  }}
                                >
                                  <div style={{ display: "grid", gap: 10 }}>
                                    <span style={{ fontWeight: 600, color: "#1e293b" }}>Dipendenti</span>
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
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: "grid", gap: 8 }}>
                                  <span style={{ fontWeight: 600, color: "#1e293b" }}>Seleziona giorni</span>
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  {shiftRepeatWeekdays.map((day) => {
                                    const selected = selectedShiftWeekdays.includes(day.value);
                                    return (
                                      <button
                                        key={day.value}
                                        type="button"
                                        onClick={() =>
                                          setSelectedShiftWeekdays((current) =>
                                            selected
                                              ? current.filter((value) => value !== day.value)
                                              : current.concat(day.value)
                                          )
                                        }
                                        style={{
                                          borderRadius: 999,
                                          border: selected ? "1px solid #7c3aed" : "1px solid #e2e8f0",
                                          background: selected ? "#ede9fe" : "#ffffff",
                                          color: selected ? "#4c1d95" : "#475569",
                                          padding: "8px 11px",
                                          fontWeight: 800,
                                          cursor: "pointer",
                                        }}
                                      >
                                        {day.label}
                                      </button>
                                    );
                                  })}
                                  </div>
                                </div>
                              </div>
                            ) : (
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
                                  );
                                })}
                              </div>
                            </div>
                            )}
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

                        </section>
                      </div>,
                      document.body
                    ) : null}

                    {selectedDay.shifts.length === 0 ? (
                      <div style={{ color: "#64748b" }}>Nessun turno presente in questa giornata.</div>
                    ) : (
                      <div className="dashboard-scroll-list" style={{ display: "grid", gap: 10 }}>
                        {selectedDay.shifts.map((shift) => (
                          <div
                            key={shift.id}
                            className="dashboard-list-card"
                            style={{
                              width: "100%",
                              padding: 14,
                              borderRadius: 18,
                              border: "1px solid #e2e8f0",
                              background: "#f8fafc",
                              textAlign: "left",
                              display: "grid",
                              gap: 6,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                              <div style={{ display: "grid", gap: 6 }}>
                                <strong style={{ color: "#0f172a", fontSize: 16 }}>
                                  {formatRange(shift.startTime, shift.endTime, locale)}
                                </strong>
                                {shift.isOnCall ? (
                                  <StatusPill
                                    label={shift.confirmedAt ? "Reperibilita" : "Reperibilita in attesa"}
                                    tone={shift.confirmedAt ? "warning" : "danger"}
                                  />
                                ) : null}
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
                              </div>
                              {canManageOptionalShifts ? (
                                <IconButton
                                  type="button"
                                  onClick={() => setEditingShiftId(shift.id)}
                                  disabled={isPending}
                                  aria-label="Modifica turno"
                                >
                                  ✎
                                </IconButton>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

                {(activeCalendarModal === "day" || activeCalendarModal === "shifts") && (selectedDay?.pendingOnCallShifts ?? []).filter(
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

                {(features.tasks || features.noticeBoard) && activeCalendarModal !== "shifts" ? (
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
                      }).format(new Date(selectedDay.date))}
                    </strong>
                      <CountBadge count={selectedDay.tasks.length + selectedDay.notes.length} />
                      {canOpenTaskComposer ? (
                        <IconButton
                          type="button"
                          onClick={() => setQuickComposer("task")}
                          aria-label="Aggiungi note"
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
                    {selectedDay.tasks.length === 0 && selectedDay.notes.length === 0 ? (
                      <div style={{ color: "#64748b" }}>Nessuna nota collegata a questa giornata.</div>
                    ) : (
                      <div className="dashboard-scroll-list" style={{ display: "grid", gap: 10 }}>
                        {selectedDay.tasks.map((task) =>
                          renderTaskCard(task, true, submitTaskCompletion, isPending)
                        )}
                        {selectedDay.notes.map((note) => (
                          <div
                            key={note.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedNoteId(note.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedNoteId(note.id);
                              }
                            }}
                            style={{
                              border: 0,
                              padding: 0,
                              background: "transparent",
                              textAlign: "left",
                              cursor: "pointer",
                            }}
                          >
                            {renderNoteCard(note, locale, currentUserId, true)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
                {selectedNote ? (
                  <div
                    style={{
                      position: "fixed",
                      inset: 0,
                      zIndex: 2147483647,
                      display: "grid",
                      placeItems: "center",
                      padding: 16,
                      background: "rgba(15, 23, 42, 0.24)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <section
                      className="dashboard-modal-panel"
                      style={{
                        position: "relative",
                        width: "min(520px, calc(100vw - 32px))",
                        maxHeight: "calc(100dvh - 32px)",
                        overflowY: "auto",
                        padding: 18,
                        borderRadius: 28,
                        background: "linear-gradient(180deg, #ffffff 0%, #fbf8ff 100%)",
                        border: "1px solid rgba(124, 58, 237, 0.16)",
                        boxShadow: "0 24px 60px rgba(88, 28, 135, 0.20)",
                        display: "grid",
                        gap: 14,
                      }}
                    >
                      <IconButton
                        type="button"
                        onClick={() => setSelectedNoteId(null)}
                        aria-label="Chiudi dettaglio nota"
                        style={{ position: "absolute", top: 14, right: 14, width: 36, height: 36 }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </IconButton>
                      <strong style={{ color: "#0f172a", fontSize: 20, paddingRight: 44 }}>
                        📌 Nota
                      </strong>
                      {renderNoteCard(selectedNote, locale, currentUserId, true)}
                    </section>
                  </div>
                ) : null}
              </section>
            </div>,
            document.body
          )
          : null}
      <QuickCalendarEntryModal
        open={Boolean(
          selectedDay &&
            quickComposer &&
            (features.tasks || features.noticeBoard)
        )}
        mode={quickComposer}
        dateIso={selectedDay?.date ?? null}
        members={members}
        canPinBoard={role === Role.OWNER || role === Role.MANAGER}
        canChooseAudience={role === Role.OWNER || role === Role.MANAGER}
        canCreateTask={features.tasks}
        canCreateBoard={features.noticeBoard}
        isPending={isPending}
        onClose={closeModal}
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
        onClose={closeModal}
      />
    </>
  );
}
