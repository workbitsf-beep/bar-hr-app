"use client";

import { RequestType } from "@prisma/client";
import type { NoteMeta } from "@/lib/note-list-format";
import { NoteRow } from "../note-row";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
  type TouchEvent,
  type WheelEvent,
} from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { combineDateAndTime, toDateInputValue } from "@/lib/shift-datetime";
import { APP_TIME_ZONE, toDateInputValueInTimeZone } from "@/lib/time-zone";
import type { ShiftPreset } from "@/lib/shift-presets";
import type { FeatureFlags } from "@/lib/features";
import {
  addStandardShiftPresetAction,
  completeTaskAction,
  createBoardNoteAction,
  createShiftAction,
  createTaskAction,
  confirmBoardNoteReadAction,
  confirmShiftAction,
  deleteAvailabilityAction,
  deleteBoardNoteAction,
  deleteRequestAction,
  deleteShiftAction,
  deleteTaskAction,
} from "../actions";
import { ShiftEditorModal } from "../shifts/shift-editor-modal";
import { SwipeRevealAction } from "../swipe-reveal-action";
import { IconButton, PrimaryButton, SuccessCallout } from "../ui";
import { useOverlayLock } from "../use-overlay-lock";
import { CalendarWeekStrip } from "./calendar-week-strip";
import { groupShiftsByTime } from "./group-shifts-by-time";
import { QuickCalendarEntryModal } from "./quick-calendar-entry-modal";
import { scrollToTodayCard } from "./scroll-to-today-button";
import { ShiftQuickAdd } from "./shift-quick-add";
import {
  addDaysToDateKey,
  chunkByWeek,
  formatCompactDayLabel,
  formatDayHeading,
  formatDayLabel,
  formatRange,
  formatRequestTypeLabel,
  formatRoleLabel,
  formatTime as formatDayTime,
  formatWeekHeading,
  getErrorMessage,
  hasTimeOverlap,
  isShiftPastDay,
  truncateCalendarText,
} from "./calendar-client-utils";

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
  isCurrentUser: boolean;
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
  requiresConfirmation: boolean;
  /** Worked out server-side, so a note reads the same here as on the Note page. */
  meta: NoteMeta;
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
  confirmationCount: number;
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
  shiftId?: string;
  date: string;
  startTime: string;
  endTime: string;
  presetKey: string;
  memberIds: string[];
  isOnCall: boolean;
};

const clockFormatter = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: APP_TIME_ZONE,
});

/** An instant as the venue's own wall clock reads it: "09:00". */
function formatClockValue(value: string) {
  return clockFormatter.format(new Date(value)).replace("24:", "00:");
}

/** "lun", for the seven day buttons. */
function formatWeekdayShort(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: APP_TIME_ZONE,
  })
    .format(new Date(value))
    .replace(".", "");
}

/** "28", in the venue's own time zone. */
function formatDayNumber(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
}

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

function sortShiftDraftsByDateTime(drafts: ShiftDraft[]) {
  return drafts.slice().sort((left, right) => {
    const leftKey = `${left.date}T${left.startTime || "00:00"}`;
    const rightKey = `${right.date}T${right.startTime || "00:00"}`;
    return leftKey.localeCompare(rightKey);
  });
}

function shiftDraftToShiftItem(
  draft: ShiftDraft | null | undefined,
  members: MemberOption[],
  currentUserId: string
): ShiftItem | null {
  if (!draft?.shiftId) {
    return null;
  }

  return {
    id: draft.shiftId,
    title: null,
    startTime: combineDateAndTime(draft.date, draft.startTime),
    endTime: combineDateAndTime(draft.date, draft.endTime),
    confirmedAt: null,
    isOnCall: draft.isOnCall,
    assignments: draft.memberIds
      .map((memberId) => members.find((member) => member.id === memberId))
      .filter((member): member is MemberOption => Boolean(member))
      .map((member) => ({
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        role: member.role,
        isCurrentUser: member.id === currentUserId,
      })),
  };
}

function isOwnShift(shift: Pick<ShiftItem, "assignments">) {
  return shift.assignments.some((assignment) => assignment.isCurrentUser);
}

function formatAssignmentNames(assignments: ShiftAssignment[]) {
  return assignments.map((assignment, index) => {
    const name = `${assignment.firstName} ${assignment.lastName}`;
    return (
      <span key={assignment.id} style={{ fontWeight: 400 }}>
        {index > 0 ? ", " : null}
        {assignment.isCurrentUser ? <strong style={{ fontWeight: 900 }}>{name}</strong> : name}
      </span>
    );
  });
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

/** The dot that stands in for a category while the day is closed up. */
const WEEK_TONE_DOTS: Record<WeekBadgeTone, string> = {
  note: "#f59e0b",
  vacation: "#10b981",
  permission: "#f97316",
  course: "#0ea5e9",
  availability: "#94a3b8",
  onCall: "#f6b73c",
  overtime: "#a855f7",
  closure: "#e0868f",
};

/** The same colour, dark enough to read as a word. */
const WEEK_TONE_LABELS: Record<WeekBadgeTone, string> = {
  note: "#b45309",
  vacation: "#047857",
  permission: "#c2410c",
  course: "#0284c7",
  availability: "#64748b",
  onCall: "#a15c07",
  overtime: "#7e22ce",
  closure: "#a8424f",
};

function getRequestBadge(type: string): { key: string; label: string; tone: WeekBadgeTone } {
  if (type === RequestType.OVERTIME) {
    return { key: "overtime", label: "Straordinari", tone: "overtime" };
  }

  if (type === RequestType.PERMISSION) {
    return { key: "permission", label: "Permessi", tone: "permission" };
  }

  if (type === RequestType.SICKNESS) {
    return { key: "sickness", label: "Malattia", tone: "availability" };
  }

  return { key: "vacation", label: "Ferie", tone: "vacation" };
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
    addBadge("notes", "Note", (features.tasks ? day.tasks.length : 0) + (features.noticeBoard ? day.notes.length : 0), "note");
  }

  if (features.requests) {
    for (const request of day.requests) {
      const badge = getRequestBadge(request.type);
      addBadge(badge.key, badge.label, 1, badge.tone);
    }
  }

  if (features.courses) {
    addBadge("courses", "Corsi", day.courses.length, "course");
  }

  if (features.availability) {
    addBadge("availability", "Indisponibilità", day.availabilities.length, "availability");
  }

  if (features.shifts) {
    addBadge("on-call", "Reperibilità", day.shifts.filter((shift) => shift.isOnCall).length, "onCall");
  }

  addBadge("closures", "Chiusure", day.closures.length, "closure");

  return Array.from(badges.values());
}

/**
 * A closed-up day says what else it holds with one dot per category. The word
 * and the count are in the label, for anyone who taps or reads with a screen
 * reader; on screen a row of seven coloured pills was more ink than the shifts
 * underneath them.
 */
function renderWeekDot(badge: WeekBadge, onOpen: () => void) {
  const label = badge.count > 1 ? `${badge.label} · ${badge.count}` : badge.label;

  return (
    <button
      key={badge.key}
      type="button"
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen();
      }}
      style={{
        width: 14,
        height: 14,
        padding: 0,
        border: 0,
        borderRadius: 999,
        background: "transparent",
        display: "inline-grid",
        placeItems: "center",
        cursor: "pointer",
        flex: "0 0 auto",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: WEEK_TONE_DOTS[badge.tone],
          display: "block",
        }}
      />
    </button>
  );
}

function renderWeekSection(title: string, children: ReactNode, tone: WeekBadgeTone = "note") {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 9.5,
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: WEEK_TONE_LABELS[tone],
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: WEEK_TONE_DOTS[tone],
            display: "block",
            flex: "0 0 auto",
          }}
        />
        {title}
      </span>
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
      <path d="M7 12h10m-3-3 3 3-3 3" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Who is booked twice at the same time, and which shifts are involved.
 *
 * The server refuses to save an overlap now, but the ones already in the
 * database predate that check, so the day says so instead of pretending the
 * schedule is fine.
 */
function buildShiftOverlaps(shifts: ShiftItem[]) {
  const clashing = new Set<string>();
  const byPerson = new Map<string, { name: string; shiftIds: Set<string> }>();

  for (let index = 0; index < shifts.length; index += 1) {
    for (let other = index + 1; other < shifts.length; other += 1) {
      const left = shifts[index];
      const right = shifts[other];

      if (!hasTimeOverlap(left.startTime, left.endTime, right.startTime, right.endTime)) {
        continue;
      }

      for (const assignment of left.assignments) {
        if (!right.assignments.some((entry) => entry.id === assignment.id)) {
          continue;
        }

        clashing.add(left.id);
        clashing.add(right.id);

        const person = byPerson.get(assignment.id) ?? {
          name: `${assignment.firstName} ${assignment.lastName}`.trim(),
          shiftIds: new Set<string>(),
        };
        person.shiftIds.add(left.id);
        person.shiftIds.add(right.id);
        byPerson.set(assignment.id, person);
      }
    }
  }

  const people = Array.from(byPerson.values());
  const message =
    people.length === 0
      ? null
      : people.length === 1
        ? `${people[0].name} è in ${people[0].shiftIds.size} turni che si accavallano`
        : `${people.map((person) => person.name).join(", ")} hanno turni che si accavallano`;

  return { clashing, message };
}

/** The small capitals above a list, with the one round button that adds to it. */
function renderDaySectionHeader(
  label: string,
  count: number,
  addLabel: string,
  onAdd: () => void,
  disabled: boolean,
  canAdd = true
) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 9.5,
          fontWeight: 830,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#a3a0b8",
        }}
      >
        {count > 0 ? `${label} · ${count}` : label}
      </span>
      {canAdd ? (
        <button
          type="button"
          onClick={onAdd}
          aria-label={addLabel}
          title={addLabel}
          disabled={disabled}
          style={{
            width: 26,
            height: 26,
            flex: "0 0 auto",
            borderRadius: 999,
            border: 0,
            background: "#efecff",
            color: "#4c1d95",
            display: "grid",
            placeItems: "center",
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1,
            cursor: disabled ? "default" : "pointer",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          +
        </button>
      ) : null}
    </div>
  );
}

/**
 * A shift inside the day sheet. One mark per row - the state, with its word -
 * because the whole row already opens the shift, so the chevron beside it said
 * nothing the row did not.
 */
function renderDayShiftRow(
  shift: ShiftItem,
  locale: string,
  currentUserId: string,
  clashing: boolean
) {
  const mine = shift.assignments.some((assignment) => assignment.id === currentUserId);
  const confirmed = Boolean(shift.confirmedAt);

  return (
    <div
      className="dashboard-list-card"
      key={shift.id}
      style={{
        display: "grid",
        gridTemplateColumns: "3px minmax(0, 1fr)",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        borderRadius: 13,
        overflow: "hidden",
        background: "#ffffff",
        border: `1px solid ${clashing ? "#f5dcb3" : "#eae7f6"}`,
        textAlign: "left",
      }}
    >
      <span
        aria-hidden="true"
        style={{ background: clashing ? "#f0a742" : mine ? "#6d5ce7" : "#eae7f6" }}
      />
      <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, padding: "10px 11px" }}>
        <span
          style={{
            flex: "0 0 auto",
            fontSize: 14,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.012em",
            fontWeight: mine ? 850 : 600,
            color: mine ? "#17161f" : "#3a3850",
          }}
        >
          {formatDayTime(shift.startTime, locale)}–{formatDayTime(shift.endTime, locale)}
        </span>
        {shift.isOnCall ? (
          <span style={{ flex: "0 0 auto", fontSize: 11, fontWeight: 640, color: "#a15c07" }}>
            reperibilità
          </span>
        ) : null}
        <span
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 12.5,
            fontWeight: 500,
            color: "#6b6880",
          }}
        >
          {formatAssignmentNames(shift.assignments)}
        </span>
        <span
          style={{
            marginLeft: "auto",
            flex: "0 0 auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11,
            fontWeight: 640,
            color: confirmed ? "#15803d" : "#a15c07",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              display: "inline-grid",
              placeItems: "center",
              fontSize: 9,
              background: confirmed ? "#e7f7ec" : "#fdf0dc",
            }}
          >
            {confirmed ? "✓" : "◷"}
          </span>
          {confirmed ? "" : "in attesa"}
        </span>
      </span>
    </div>
  );
}

/**
 * A shift as one line inside the week card: no box of its own, because the day
 * is already a card and the week is already a card around that.
 *
 * Bold is spent on one thing only - your own hours and your own name - so a
 * glance down the week finds where you are working.
 */
function renderWeekShiftLine(
  shift: ShiftItem,
  locale: string,
  currentUserId: string,
  onOpen: () => void
) {
  const mine = shift.assignments.some((assignment) => assignment.id === currentUserId);

  return (
    <div
      key={shift.id}
      className="workbit-week-shift-line"
      role="button"
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        onOpen();
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        minWidth: 0,
        fontSize: 13,
        lineHeight: 1.35,
        cursor: "pointer",
        touchAction: "manipulation",
      }}
    >
      <span
        style={{
          flex: "0 0 auto",
          fontVariantNumeric: "tabular-nums",
          fontWeight: mine ? 850 : 600,
          color: mine ? "#17161f" : "#3a3850",
        }}
      >
        {formatDayTime(shift.startTime, locale)}–{formatDayTime(shift.endTime, locale)}
      </span>
      {shift.isOnCall ? (
        <span style={{ flex: "0 0 auto", color: "#a15c07", fontSize: 11, fontWeight: 600 }}>
          {shift.confirmedAt ? "Reperibilità" : "Reperibilità in attesa"}
        </span>
      ) : null}
      <span
        style={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: "#55536a",
          fontSize: 12.5,
          fontWeight: 500,
        }}
      >
        {formatAssignmentNames(shift.assignments)}
      </span>
      <span
        title={shift.confirmedAt ? "Confermato" : "In attesa"}
        aria-label={shift.confirmedAt ? "Confermato" : "In attesa"}
        style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", flex: "0 0 auto" }}
      >
        {renderShiftStateIcon(Boolean(shift.confirmedAt), 14)}
      </span>
    </div>
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
      className="workbit-day-shift-row"
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
        {isOwnShift(shift) ? (
          <strong style={{ color: "#0f172a", fontSize: mobile ? 12 : 12 }}>
            {formatDayTime(shift.startTime, locale)}–{formatDayTime(shift.endTime, locale)}
          </strong>
        ) : (
          <span style={{ color: "#0f172a", fontSize: mobile ? 12 : 12 }}>
            {formatDayTime(shift.startTime, locale)}–{formatDayTime(shift.endTime, locale)}
          </span>
        )}
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
      className="workbit-day-note-card"
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
      {/* The cell already says which day it is, so the date is dropped and
          only what is unusual about the note is left. */}
      {task.meta.parts.length > 1 ? (
        <div style={{ color: "#64748b", fontSize: mobile ? 11 : 11 }}>
          {task.meta.parts
            .slice(1)
            .map((part) => part.text)
            .join(" · ")}
        </div>
      ) : null}
    </div>
  );
}

function renderNotePreviewCard(note: NoteItem, mobile = false, onOpen?: () => void) {
  return (
    <div
      key={note.id}
      className="workbit-day-note-card"
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

  const confirmationCount = Math.max(note.confirmationCount, note.confirmations.length);

  if (confirmationCount === 0) {
    return <span style={{ color: "#94a3b8", fontSize: 13 }}>Nessuna conferma</span>;
  }

  if (note.confirmations.length < confirmationCount) {
    return (
      <div style={{ display: "grid", gap: 4 }}>
        <span style={{ color: "#64748b", fontSize: 13, fontWeight: 700 }}>
          Conferme
        </span>
        <span style={{ color: "#64748b", fontSize: 13 }}>
          {confirmationCount} {confirmationCount === 1 ? "conferma" : "conferme"}
        </span>
      </div>
    );
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

function renderPendingOnCallCard(shift: ShiftItem, locale: string, mobile = false) {
  return (
    <div
      key={shift.id}
      onClick={(event) => event.stopPropagation()}
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
  days,
  members,
  presets,
  filteredDay,
  initialFocusedDay,
  initialCalendarView,
  currentUserId,
  features,
  todayAction,
  publishAction,
}: {
  locale: string;
  weekdayLabels: string[];
  days: DayItem[];
  members: MemberOption[];
  presets: ShiftPreset[];
  filteredDay?: string | null;
  initialFocusedDay?: string | null;
  initialCalendarView?: "week" | "day";
  role: string;
  currentUserId: string;
  features: FeatureFlags;
  todayAction?: ReactNode;
  publishAction?: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [calendarView, setCalendarView] = useState<"week" | "day">(initialCalendarView ?? "week");
  const [expandedWeekDays, setExpandedWeekDays] = useState<Set<string>>(() => new Set());
  const [visibleWeekStart, setVisibleWeekStart] = useState("");
  const [focusedDayDate, setFocusedDayDate] = useState<string>(() => {
    const today = days.find((day) => day.isToday) ?? days[0];
    const initialDay = initialFocusedDay
      ? days.find((day) => day.date.slice(0, 10) === initialFocusedDay)
      : null;
    return filteredDay ?? initialDay?.date ?? today?.date ?? "";
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeCalendarModal, setActiveCalendarModal] = useState<CalendarModalMode | null>(null);
  const [modalContentReady, setModalContentReady] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [showShiftComposer, setShowShiftComposer] = useState(false);
  const [quickComposer, setQuickComposer] = useState<"task" | "board" | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [savedShiftDrafts, setSavedShiftDrafts] = useState<ShiftDraft[]>([]);
  const [currentShiftDraft, setCurrentShiftDraft] = useState<ShiftDraft | null>(null);
  const [requestType, setRequestType] = useState<string>(RequestType.VACATION);
  const [noteConfirmationsById, setNoteConfirmationsById] = useState<Record<string, NoteItem["confirmations"]>>({});
  // The hours this venue actually works, counted from the shifts already on
  // the calendar. Typed times beat standard slots here, so the keypad offers
  // back what has been typed before rather than only what settings holds.
  const recentShiftTimes = useMemo(() => {
    const counts = new Map<string, { startTime: string; endTime: string; count: number }>();

    for (const day of days) {
      for (const shift of day.shifts) {
        const startTime = formatClockValue(shift.startTime);
        const endTime = formatClockValue(shift.endTime);
        const key = `${startTime}-${endTime}`;
        const entry = counts.get(key);

        if (entry) {
          entry.count += 1;
        } else {
          counts.set(key, { startTime, endTime, count: 1 });
        }
      }
    }

    return Array.from(counts.values()).sort((left, right) => right.count - left.count);
  }, [days]);
  const calendarTopRef = useRef<HTMLDivElement | null>(null);
  const dayStripRef = useRef<HTMLDivElement | null>(null);
  const dayScrollTimerRef = useRef<number | null>(null);
  const daySnapTimerRef = useRef<number | null>(null);
  const dayWheelLockedRef = useRef(false);
  const skipDayScrollIntoViewRef = useRef(false);
  const smoothDayScrollIntoViewRef = useRef(false);
  const boundaryTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const boundaryNavigationLockedRef = useRef(false);
  const previousInitialFocusedDayRef = useRef(initialFocusedDay);
  useOverlayLock(Boolean(selectedDate));

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!selectedDate) {
      setModalContentReady(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setModalContentReady(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [selectedDate]);

  useEffect(() => {
    function resetCalendarDom() {
      if (dayScrollTimerRef.current !== null) {
        window.cancelAnimationFrame(dayScrollTimerRef.current);
        dayScrollTimerRef.current = null;
      }

      if (daySnapTimerRef.current !== null) {
        window.clearTimeout(daySnapTimerRef.current);
        daySnapTimerRef.current = null;
      }

      skipDayScrollIntoViewRef.current = false;
      boundaryTouchStartRef.current = null;
      boundaryNavigationLockedRef.current = false;
      dayStripRef.current?.scrollTo({ left: 0, behavior: "auto" });
      document.querySelectorAll<HTMLElement>(".dashboard-week-strip, .dashboard-calendar-scroll").forEach((element) => {
        element.scrollLeft = 0;
      });
    }

    function handleCalendarCleanup() {
      setEditingShiftId(null);
      setActiveCalendarModal(null);
      setModalContentReady(false);
      setSelectedNoteId(null);
      setShowShiftComposer(false);
      setQuickComposer(null);
      setSelectedDate(null);
      setFeedback(null);
      setCurrentShiftDraft(null);
      setSavedShiftDrafts([]);
      resetCalendarDom();
    }

    window.addEventListener("workbit:calendar-cleanup", handleCalendarCleanup);
    window.addEventListener("pagehide", resetCalendarDom);

    return () => {
      window.removeEventListener("workbit:calendar-cleanup", handleCalendarCleanup);
      window.removeEventListener("pagehide", resetCalendarDom);
      resetCalendarDom();
    };
  }, []);

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
    if (!initialFocusedDay || previousInitialFocusedDayRef.current === initialFocusedDay) {
      return;
    }

    previousInitialFocusedDayRef.current = initialFocusedDay;
    const nextFocusedDay = days.find((day) => day.date.slice(0, 10) === initialFocusedDay);

    if (!nextFocusedDay) {
      return;
    }

    skipDayScrollIntoViewRef.current = false;
    setFocusedDayDate(nextFocusedDay.date);
    setSelectedDate(null);
    setActiveCalendarModal(null);
    setSelectedNoteId(null);
    dayStripRef.current?.scrollTo({ left: 0, behavior: "auto" });
    window.requestAnimationFrame(() => {
      calendarTopRef.current?.scrollIntoView({
        behavior: "auto",
        block: "start",
        inline: "nearest",
      });
    });
  }, [days, initialFocusedDay]);

  useEffect(() => {
    const requestedDay = filteredDay
      ? days.find((item) => item.date.slice(0, 10) === filteredDay)
      : days.find((item) => item.date === focusedDayDate) ?? days.find((item) => item.isToday) ?? days[0];

    if (requestedDay && requestedDay.date !== focusedDayDate) {
      setFocusedDayDate(requestedDay.date);
    }
  }, [days, filteredDay, focusedDayDate]);

  useEffect(() => {
    function handleShowTodayAsDay() {
      const today = days.find((item) => item.isToday) ?? days[0];

      if (!today) {
        return;
      }

      smoothDayScrollIntoViewRef.current = true;
      setFocusedDayDate(today.date);
      setSelectedDate(null);
      setActiveCalendarModal(null);
      setFeedback(null);

      // Moving the focused day is enough for the day view, which scrolls its
      // own strip. The week strip has to be pushed by hand, or "Oggi" left it
      // on whatever week the finger had reached.
      window.requestAnimationFrame(() => {
        const card = document.querySelector<HTMLElement>('[data-current-week="true"]');
        const strip = card?.closest<HTMLElement>(".dashboard-week-strip") ?? null;

        if (card && strip) {
          strip.scrollTo({ left: card.offsetLeft, behavior: "smooth" });
          setVisibleWeekStart(card.dataset.weekStart ?? "");
        }
      });
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

      const strip = dayStripRef.current;
      const behavior = smoothDayScrollIntoViewRef.current ? "smooth" : "auto";
      smoothDayScrollIntoViewRef.current = false;

      if (strip && target) {
        strip.scrollTo({ left: target.offsetLeft, behavior });
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [calendarView, focusedDayDate]);

  const selectedDay = useMemo(
    () => days.find((day) => day.date === selectedDate) ?? null,
    [days, selectedDate]
  );
  // The weeks the "per dipendente" day picker can page through: the one
  // holding the open day, and the ones after it. Days already past are left
  // out, since a shift cannot be put there anyway.
  const composerWeeks = useMemo(() => {
    const openKey = (selectedDay?.date ?? "").slice(0, 10);
    const todayValue = toDateInputValueInTimeZone(new Date());
    const weeks = chunkByWeek(days);
    const startIndex = weeks.findIndex((week) =>
      week.some((day) => day.date.slice(0, 10) === openKey)
    );

    return weeks.slice(startIndex < 0 ? 0 : startIndex).map((week) => ({
      label: formatWeekHeading(week, locale),
      days: week
        .filter((day) => day.date.slice(0, 10) >= todayValue)
        .map((day) => ({
          key: day.date.slice(0, 10),
          weekday: formatWeekdayShort(day.date, locale),
          number: formatDayNumber(day.date),
        })),
    }));
  }, [days, locale, selectedDay]);
  const selectedNote = useMemo(() => {
    const note = selectedDay?.notes.find((item) => item.id === selectedNoteId) ?? null;
    const confirmations = selectedNoteId ? noteConfirmationsById[selectedNoteId] : null;

    return note && confirmations ? { ...note, confirmations } : note;
  }, [noteConfirmationsById, selectedDay, selectedNoteId]);
  const editingShift = useMemo(
    () =>
      selectedDay?.shifts.find((shift) => shift.id === editingShiftId) ??
      shiftDraftToShiftItem(
        savedShiftDrafts.find((draft) => draft.shiftId === editingShiftId) ?? null,
        members,
        currentUserId
      ),
    [currentUserId, editingShiftId, members, savedShiftDrafts, selectedDay]
  );
  const weeks = useMemo(() => chunkByWeek(days), [days]);
  const focusedDayIndex = useMemo(
    () => Math.max(0, days.findIndex((item) => item.date === focusedDayDate)),
    [days, focusedDayDate]
  );
  const focusedDay = days[focusedDayIndex] ?? days.find((item) => item.isToday) ?? days[0] ?? null;
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
  const activeVisibleWeek = useMemo(
    () =>
      visibleWeeks.find((week) => week[0]?.date.slice(0, 10) === visibleWeekStart) ??
      visibleWeeks.find((week) => week.some((day) => day.date === focusedDayDate)) ??
      visibleWeeks.find((week) => week.some((day) => day.isToday)) ??
      visibleWeeks[0] ??
      [],
    [focusedDayDate, visibleWeekStart, visibleWeeks]
  );
  const calendarWindowKey = useMemo(
    () =>
      `${calendarView}-${initialFocusedDay ?? "auto"}-${visibleDayItems[0]?.date ?? ""}-${
        visibleDayItems[visibleDayItems.length - 1]?.date ?? ""
      }`,
    [calendarView, initialFocusedDay, visibleDayItems]
  );

  // The strip tells us which week is on screen. The focused day has to follow
  // it, because the strip re-aligns itself on the focused week: left behind,
  // it dragged the calendar back to the week you had just scrolled away from.
  const daysRef = useRef(days);
  useEffect(() => {
    daysRef.current = days;
  }, [days]);

  const handleActiveWeekChange = useCallback((weekStart: string) => {
    setVisibleWeekStart(weekStart);

    if (!weekStart) {
      return;
    }

    setFocusedDayDate((current) => {
      const week = chunkByWeek(daysRef.current).find(
        (entry) => entry[0]?.date.slice(0, 10) === weekStart
      );

      if (!week || week.some((day) => day.date === current)) {
        return current;
      }

      // Keep the same weekday where the week has one, so scrolling sideways
      // reads as moving a week, not as jumping to a different day.
      const weekdayIndex = Math.max(
        0,
        chunkByWeek(daysRef.current)
          .find((entry) => entry.some((day) => day.date === current))
          ?.findIndex((day) => day.date === current) ?? 0
      );

      return (week[weekdayIndex] ?? week.find((day) => day.isToday) ?? week[0])?.date ?? current;
    });
  }, []);

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

      const targetLeft = strip.scrollLeft;
      const cards = Array.from(strip.querySelectorAll<HTMLElement>("[data-day-date]"));
      let nearestDate = focusedDayDate;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const card of cards) {
        const distance = Math.abs(card.offsetLeft - targetLeft);
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

    if (daySnapTimerRef.current !== null) {
      window.clearTimeout(daySnapTimerRef.current);
    }

    daySnapTimerRef.current = window.setTimeout(() => {
      const strip = dayStripRef.current;
      const cards = strip ? Array.from(strip.querySelectorAll<HTMLElement>("[data-day-date]")) : [];
      const targetLeft = strip?.scrollLeft ?? 0;
      let target: HTMLElement | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const card of cards) {
        const distance = Math.abs(card.offsetLeft - targetLeft);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          target = card;
        }
      }

      if (strip && target) {
        strip.scrollTo({ left: target.offsetLeft, behavior: "smooth" });
      }
    }, 120);
  }
  /** Who cannot take a shift that day between those hours, and why. */
  const busyAt = useCallback(
    (dayKeyValue: string, startTime: string, endTime: string) => {
      const blocked = new Map<string, string>();
      const day = days.find((entry) => entry.date.slice(0, 10) === dayKeyValue);

      if (!day || !startTime || !endTime || startTime.includes("-") || endTime.includes("-")) {
        return blocked;
      }

      const shiftStart = combineDateAndTime(dayKeyValue, startTime);
      const shiftEnd = combineDateAndTime(dayKeyValue, endTime);

      if (features.availability) {
        for (const availability of day.availabilities) {
          if (hasTimeOverlap(availability.startsAt, availability.endsAt, shiftStart, shiftEnd)) {
            blocked.set(availability.userId, "indisponibile");
          }
        }
      }

      if (features.requests) {
        for (const request of day.requests) {
          if (hasTimeOverlap(request.startsAt, request.endsAt, shiftStart, shiftEnd)) {
            blocked.set(request.userId, formatRequestTypeLabel(request.type).toLowerCase());
          }
        }
      }

      return blocked;
    },
    [days, features.availability, features.requests]
  );
  function openDay(day: DayItem, mode: CalendarModalMode = "day") {
    setModalContentReady(false);
    // The day you opened becomes the focused one, so closing the popup leaves
    // the calendar where you were and not back on today's week. The strip
    // scrolling itself onto that day is exactly where it should end up.
    setFocusedDayDate(day.date);
    setSelectedDate(day.date);
    setActiveCalendarModal(mode);
    setEditingShiftId(null);
    setShowShiftComposer(false);
    setQuickComposer(null);
    setFeedback(null);
    setSavedShiftDrafts([]);
    setCurrentShiftDraft(createShiftDraft(day.date));
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

  function navigateCalendarWindow(direction: -1 | 1) {
    if (boundaryNavigationLockedRef.current) {
      return;
    }

    const anchorKey = focusedDayDate?.slice(0, 10) || days[0]?.date.slice(0, 10);

    if (!anchorKey) {
      return;
    }

    boundaryNavigationLockedRef.current = true;
    window.setTimeout(() => {
      boundaryNavigationLockedRef.current = false;
    }, 1200);

    const url = new URL(window.location.href);
    url.searchParams.set("anchor", addDaysToDateKey(anchorKey, direction * 7));
    url.searchParams.delete("day");
    url.searchParams.set("view", calendarView);
    router.push(`${url.pathname}${url.search}${url.hash}`);
  }

  useEffect(() => {
    if (!selectedNoteId || noteConfirmationsById[selectedNoteId]) {
      return;
    }

    const noteId = selectedNoteId;
    let cancelled = false;

    async function loadNoteConfirmations() {
      try {
        const response = await fetch(`/api/notes/${noteId}/confirmations`, {
          cache: "no-store",
        });
        const result = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              confirmations?: NoteItem["confirmations"];
            }
          | null;

        if (!cancelled && response.ok && result?.ok && Array.isArray(result.confirmations)) {
          setNoteConfirmationsById((current) => ({
            ...current,
            [noteId]: result.confirmations ?? [],
          }));
        }
      } catch {
        // The note modal can still render from the lightweight calendar payload.
      }
    }

    void loadNoteConfirmations();

    return () => {
      cancelled = true;
    };
  }, [noteConfirmationsById, selectedNoteId]);

  function isAtCalendarBoundary(element: HTMLElement, direction: -1 | 1) {
    const maxScrollLeft = element.scrollWidth - element.clientWidth;

    if (maxScrollLeft <= 0) {
      return true;
    }

    return direction < 0 ? element.scrollLeft <= 8 : element.scrollLeft >= maxScrollLeft - 8;
  }

  function handleCalendarBoundaryWheel(event: WheelEvent<HTMLElement>) {
    const isDayStrip = calendarView === "day" && event.currentTarget === dayStripRef.current;
    const delta = isDayStrip
      ? Math.abs(event.deltaX) >= Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY
      : Math.abs(event.deltaX) >= Math.abs(event.deltaY)
        ? event.deltaX
        : event.shiftKey
          ? event.deltaY
          : 0;

    if (Math.abs(delta) < 24) {
      return;
    }

    const direction = delta > 0 ? 1 : -1;

    if (isDayStrip) {
      event.preventDefault();

      if (dayWheelLockedRef.current) {
        return;
      }

      dayWheelLockedRef.current = true;
      window.setTimeout(() => {
        dayWheelLockedRef.current = false;
      }, 280);

      if (isAtCalendarBoundary(event.currentTarget, direction)) {
        navigateCalendarWindow(direction);
      } else {
        moveFocusedDay(direction);
      }
      return;
    }

    if (!isAtCalendarBoundary(event.currentTarget, direction)) {
      return;
    }

    event.preventDefault();
    navigateCalendarWindow(direction);
  }

  function handleCalendarBoundaryTouchStart(event: TouchEvent<HTMLElement>) {
    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    boundaryTouchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  }

  function handleCalendarBoundaryTouchEnd(event: TouchEvent<HTMLElement>) {
    const start = boundaryTouchStartRef.current;
    const touch = event.changedTouches[0];
    boundaryTouchStartRef.current = null;

    if (!start || !touch) {
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (Math.abs(deltaX) < 52 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) {
      return;
    }

    const direction = deltaX < 0 ? 1 : -1;

    if (!isAtCalendarBoundary(event.currentTarget, direction)) {
      return;
    }

    navigateCalendarWindow(direction);
  }

  function closeModal() {
    if (isPending) {
      return;
    }

    setEditingShiftId(null);
    setActiveCalendarModal(null);
    setModalContentReady(false);
    setSelectedNoteId(null);
    setShowShiftComposer(false);
    setQuickComposer(null);
    setSelectedDate(null);
    setFeedback(null);
    setCurrentShiftDraft(null);
    setSavedShiftDrafts([]);
  }

  function openShiftEditor(shiftId: string, dayDate?: string) {
    const shift = days.flatMap((day) => day.shifts).find((entry) => entry.id === shiftId);

    if (shift && isShiftPastDay(shift, todayKey)) {
      setFeedback({ tone: "danger", message: "I turni dei giorni passati non si possono modificare." });
      return;
    }

    if (dayDate) {
      setSelectedDate(dayDate);
    }

    setActiveCalendarModal("shifts");
    setEditingShiftId(shiftId);
    setShowShiftComposer(false);
    setQuickComposer(null);
  }

  function handleDeleteShift(shiftId: string) {
    const shift = days.flatMap((day) => day.shifts).find((entry) => entry.id === shiftId);

    if (shift && isShiftPastDay(shift, todayKey)) {
      setFeedback({ tone: "danger", message: "I turni dei giorni passati non si possono eliminare." });
      return;
    }

    const formData = new FormData();
    formData.set("shiftId", shiftId);

    startTransition(async () => {
      try {
        await deleteShiftAction(formData);
        setFeedback(null);

        if (editingShiftId === shiftId) {
          setEditingShiftId(null);
        }

        setSavedShiftDrafts((current) =>
          current.filter((draft) => draft.shiftId !== shiftId && draft.id !== shiftId)
        );
        window.dispatchEvent(new CustomEvent("workbit:swipe-reset"));
        window.setTimeout(() => {
          router.refresh();
        }, 0);
      } catch (error) {
        setFeedback({
          tone: "danger",
          message: error instanceof Error ? error.message : "Impossibile eliminare il turno.",
        });
      }
    });
  }

  function handleDeleteTask(taskId: string) {
    const formData = new FormData();
    formData.set("taskId", taskId);

    startTransition(async () => {
      try {
        await deleteTaskAction(formData);
        setFeedback(null);
        window.dispatchEvent(new CustomEvent("workbit:swipe-reset"));
        window.setTimeout(() => router.refresh(), 0);
      } catch (error) {
        setFeedback({
          tone: "danger",
          message: error instanceof Error ? error.message : "Impossibile eliminare la nota.",
        });
      }
    });
  }

  function handleDeleteBoardNote(noteId: string) {
    const formData = new FormData();
    formData.set("noteId", noteId);

    startTransition(async () => {
      try {
        await deleteBoardNoteAction(formData);
        setSelectedNoteId(null);
        setFeedback(null);
        window.dispatchEvent(new CustomEvent("workbit:swipe-reset"));
        window.setTimeout(() => router.refresh(), 0);
      } catch (error) {
        setFeedback({
          tone: "danger",
          message: error instanceof Error ? error.message : "Impossibile eliminare la nota.",
        });
      }
    });
  }

  function handleDeleteAvailability(availabilityId: string) {
    const formData = new FormData();
    formData.set("availabilityId", availabilityId);

    startTransition(async () => {
      try {
        await deleteAvailabilityAction(formData);
        setFeedback(null);
        window.dispatchEvent(new CustomEvent("workbit:swipe-reset"));
        window.setTimeout(() => router.refresh(), 0);
      } catch (error) {
        setFeedback({
          tone: "danger",
          message: error instanceof Error ? error.message : "Impossibile eliminare l'indisponibilita.",
        });
      }
    });
  }

  function handleDeleteRequest(requestId: string) {
    const formData = new FormData();
    formData.set("requestId", requestId);

    startTransition(async () => {
      try {
        await deleteRequestAction(formData);
        setFeedback(null);
        window.dispatchEvent(new CustomEvent("workbit:swipe-reset"));
        window.setTimeout(() => router.refresh(), 0);
      } catch (error) {
        setFeedback({
          tone: "danger",
          message: error instanceof Error ? error.message : "Impossibile eliminare la richiesta.",
        });
      }
    });
  }

  function renderDeleteSwipeAction(label: string, onDelete: () => void) {
    return (
      <button
        type="button"
        aria-label={label}
        disabled={isPending}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          border: "1px solid #fecaca",
          background: "#ef4444",
          color: "#ffffff",
          cursor: isPending ? "progress" : "pointer",
          fontWeight: 900,
        }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    );
  }

  function renderDeleteSwipeCard(
    key: string,
    card: ReactNode,
    label: string,
    onDelete: () => void,
    allowSwipe = false
  ) {
    if (!allowSwipe) {
      return <div key={key}>{card}</div>;
    }

    return (
      <SwipeRevealAction
        key={key}
        action={renderDeleteSwipeAction(label, onDelete)}
        resetKey={key}
        revealWidth={64}
        actionInset={9}
        borderRadius={12}
      >
        {card}
      </SwipeRevealAction>
    );
  }

  function renderShiftSwipeActions(shift: ShiftItem, card: ReactNode, dayDate?: string, allowSwipe = false) {
    const canEditShift = features.shifts && !isShiftPastDay(shift, todayKey);

    if (!canEditShift) {
      return <div key={shift.id}>{card}</div>;
    }

    const editAction = (
      <button
        type="button"
        aria-label="Modifica turno"
        disabled={isPending}
        onClick={(event) => {
          event.stopPropagation();
          openShiftEditor(shift.id, dayDate);
        }}
        style={{
          width: 38,
          height: 38,
          borderRadius: 13,
          border: "1px solid #ddd6fe",
          background: "#7c3aed",
          color: "#ffffff",
          cursor: isPending ? "progress" : "pointer",
          fontWeight: 900,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="m14.5 5.5 4 4M4 20l4.5-1 10.5-10.5a2.8 2.8 0 0 0-4-4L4.5 15 4 20Z"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    );
    const deleteAction = (
      <button
        type="button"
        aria-label="Elimina turno"
        disabled={isPending}
        onClick={(event) => {
          event.stopPropagation();
          handleDeleteShift(shift.id);
        }}
        style={{
          width: 38,
          height: 38,
          borderRadius: 13,
          border: "1px solid #fecaca",
          background: "#ef4444",
          color: "#ffffff",
          cursor: isPending ? "progress" : "pointer",
          fontWeight: 900,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    );

    if (allowSwipe) {
      return (
        <SwipeRevealAction
          key={shift.id}
          resetKey={`${dayDate ?? "day"}-${shift.id}-${shift.startTime}-${shift.endTime}-${shift.assignments.length}`}
          revealWidth={62}
          actionInset={8}
          borderRadius={12}
          leadingAction={editAction}
          action={deleteAction}
        >
          {card}
        </SwipeRevealAction>
      );
    }

    return <div key={shift.id}>{card}</div>;
  }

  function isShiftDraftValid(draft: ShiftDraft | null) {
    return Boolean(draft?.date && draft.startTime && draft.endTime && draft.memberIds.length > 0);
  }

  /** Saves whatever the keypad handed over: one shift, or one per chosen day. */
  function addShiftDrafts(draftsToAdd: ShiftDraft[]) {
    if (!selectedDay) {
      return;
    }

    if (draftsToAdd.length === 0 || !draftsToAdd.every((draft) => isShiftDraftValid(draft))) {
      setFeedback({ tone: "danger", message: "Completa il turno prima di salvarlo." });
      return;
    }

    runAction(async () => {
      const savedDrafts: ShiftDraft[] = [];

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

        const createdShift = await createShiftAction(formData);
        savedDrafts.push({ ...draft, id: createdShift.id, shiftId: createdShift.id });
      }

      setSavedShiftDrafts((current) => sortShiftDraftsByDateTime(current.concat(savedDrafts)));
    }, draftsToAdd.length === 1 ? "Turno salvato." : "Turni salvati.");
  }

  function runAction(task: () => Promise<void>, successMessage: string, closeOnSuccess = false) {
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
        window.dispatchEvent(new CustomEvent("workbit:swipe-reset"));
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
    }, "Nota aggiunta.");
  }

  function handleQuickBoardCreate(formData: FormData) {
    runAction(async () => {
      await createBoardNoteAction(formData);
    }, "Nota pubblicata.");
  }

  if (!days.length) {
    return null;
  }

  const day = selectedDay ?? days[0];
  const todayKey = toDateInputValueInTimeZone(new Date());
  const dayOverlaps = buildShiftOverlaps(day?.shifts ?? []);

  return (
    <>
      <div
        ref={calendarTopRef}
        className="workbit-calendar-toolbar"
        style={{
          display: "grid",
          gap: 12,
          width: "100%",
          marginBottom: 14,
          overflow: "visible",
        }}
      >
        {calendarView === "day" && focusedDay ? (
          <div className="workbit-calendar-day-heading">
            <div>
              <span>{formatDayHeading(focusedDay.date, locale).weekday}</span>
              <strong>{formatDayHeading(focusedDay.date, locale).dayAndMonth}</strong>
            </div>
            {focusedDay.date.slice(0, 10) >= todayKey ? (
              <IconButton
                type="button"
                className="workbit-calendar-add-shift"
                aria-label="Aggiungi turno"
                title="Aggiungi turno"
                onClick={() => {
                  openDay(focusedDay, "shifts");
                  setShowShiftComposer(true);
                }}
              >
                +
              </IconButton>
            ) : null}
          </div>
        ) : null}
        {calendarView === "week" && activeVisibleWeek.length > 0 ? (
          <div className="workbit-calendar-week-heading">
            <span>{activeVisibleWeek.some((day) => day.isToday) ? "Questa settimana" : "Settimana"}</span>
            <strong>{formatWeekHeading(activeVisibleWeek, locale)}</strong>
          </div>
        ) : null}
        <div
          className={`workbit-calendar-segments${publishAction ? " has-publish" : ""}`}
          style={{
            display: "grid",
            gridTemplateColumns: publishAction
              ? "1fr 1fr auto auto"
              : todayAction
                ? "1fr 1fr auto"
                : "1fr 1fr",
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
              className={calendarView === mode ? "is-active" : undefined}
              type="button"
              onClick={() => {
                if (calendarView === mode) {
                  return;
                }

                // Opening the day view lands on today, whatever week you had
                // scrolled to. Somewhere in the middle of next month is not
                // where anyone means to start.
                if (mode === "day") {
                  const today = days.find((item) => item.isToday);

                  if (today) {
                    setFocusedDayDate(today.date);
                  }
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
          {publishAction}
        </div>
      </div>

      {calendarView === "day" ? (
        <div
          ref={dayStripRef}
          className="workbit-calendar-day-strip"
          onScroll={handleDayStripScroll}
          onWheel={handleCalendarBoundaryWheel}
          onTouchStart={handleCalendarBoundaryTouchStart}
          onTouchEnd={handleCalendarBoundaryTouchEnd}
          style={{
            display: "flex",
            gap: 14,
            width: "100%",
            maxWidth: "100%",
            overflowX: "auto",
            overflowY: "hidden",
            scrollSnapType: "x mandatory",
            scrollPaddingInline: 0,
            padding: "2px 0 12px",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
          }}
        >
          {visibleDayItems.map((day) => {
            const hasEvents =
              (features.shifts ? day.shifts.length : 0) +
                (features.requests ? day.requests.length : 0) +
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
                data-calendar-closed={day.closures.length > 0 ? "true" : undefined}
                className="workbit-calendar-day-card"
                style={{
                  display: "grid",
                  gap: 10,
                  flex: "0 0 100%",
                  width: "100%",
                  scrollSnapAlign: "start",
                  // One swipe, one day: without this the momentum ran through
                  // three or four cards before stopping.
                  scrollSnapStop: "always",
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
                  className="workbit-calendar-day-card-heading"
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
                {!hasEvents ? <div style={{ color: "#64748b" }}>Nessun evento in questa giornata.</div> : null}
                {features.shifts && (day.shifts.length > 0 || day.date.slice(0, 10) >= todayKey) ? (
                  <div className="workbit-calendar-day-section workbit-calendar-day-shifts" style={{ display: "grid", gap: 6 }}>
                    <div className="workbit-calendar-day-section-title">
                      {renderDaySectionHeader(
                        "Turni",
                        day.shifts.length,
                        "Aggiungi turni",
                        () => {
                          openDay(day);
                          setShowShiftComposer(true);
                        },
                        isPending,
                        day.date.slice(0, 10) >= todayKey
                      )}
                    </div>
                    {day.shifts.length === 0 ? (
                      <div style={{ color: "#64748b" }}>Nessun turno in questa giornata.</div>
                    ) : null}
                    {groupShiftsByTime(day.shifts).map((shift) =>
                      renderShiftSwipeActions(
                        shift,
                        renderCompactShiftCard(shift, locale, true, () => {
                          setSelectedDate(day.date);
                          setActiveCalendarModal("shifts");
                          setEditingShiftId(null);
                        }),
                        day.date
                      )
                    )}
                  </div>
                ) : null}
                {features.requests && day.requests.length > 0 ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <strong>🏖️ Ferie / Permessi / Assenze</strong>
                    {day.requests.map((request) =>
                      renderDeleteSwipeCard(
                        `request-${request.id}`,
                        renderApprovedRequestCard(request, true),
                        "Elimina richiesta",
                        () => handleDeleteRequest(request.id)
                      )
                    )}
                  </div>
                ) : null}
                {features.availability && day.availabilities.length > 0 ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <strong>🚫 Indisponibilità</strong>
                    {day.availabilities.map((availability) =>
                      renderDeleteSwipeCard(
                        `availability-${availability.id}`,
                        renderAvailabilityCard(availability, true),
                        "Elimina indisponibilita",
                        () => handleDeleteAvailability(availability.id)
                      )
                    )}
                  </div>
                ) : null}
                {false && features.shifts && day.pendingOnCallShifts.length > 0 ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <strong>📍 Reperibilità</strong>
                    {day.pendingOnCallShifts.map((shift) => renderPendingOnCallCard(shift, locale, true))}
                  </div>
                ) : null}
                {features.tasks || features.noticeBoard ? (
                  <div className="workbit-calendar-day-section workbit-calendar-day-notes" style={{ display: "grid", gap: 6 }}>
                    <div className="workbit-calendar-day-section-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
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
                      renderDeleteSwipeCard(
                        `task-${task.id}`,
                        renderTaskPreviewCard(task, true, () => {
                          setSelectedDate(day.date);
                          setActiveCalendarModal("notes");
                        }),
                        "Elimina nota",
                        () => handleDeleteTask(task.id)
                      )
                    )}
                    {day.notes.map((note) =>
                      renderDeleteSwipeCard(
                        `note-${note.id}`,
                        renderNotePreviewCard(note, true, () => {
                          setSelectedDate(day.date);
                          setActiveCalendarModal("notes");
                        }),
                        "Elimina nota",
                        () => handleDeleteBoardNote(note.id)
                      )
                    )}
                  </div>
                ) : null}
                {features.courses && day.courses.length > 0 ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <strong>🎓 Corsi</strong>
                    {day.courses.map((course) => (
                      <div key={course.id} style={{ padding: "8px 10px", borderRadius: 12, background: "#eef2ff", border: "1px solid #c7d2fe", color: "#3730a3", fontSize: 12, lineHeight: 1.35 }}>
                        {course.title} · {formatRange(course.startTime, course.endTime, locale)}
                      </div>
                    ))}
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
        resetKey={calendarWindowKey}
        onActiveWeekChange={handleActiveWeekChange}
        onWheel={handleCalendarBoundaryWheel}
        onTouchStart={handleCalendarBoundaryTouchStart}
        onTouchEnd={handleCalendarBoundaryTouchEnd}
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
          const weekIsFocused = week.some((day) => day.date === focusedDayDate);

          return (
            <section
              key={`${week[0]?.date ?? `${weekIndex}-${filteredDay ?? "all"}`}`}
              className="dashboard-week-card"
              data-week-start={week[0]?.date.slice(0, 10)}
              data-current-week={weekIsCurrent ? "true" : undefined}
              data-focused-week={weekIsFocused ? "true" : undefined}
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

              <div style={{ display: "grid", gap: 12 }}>
                {week.map((day) => {
                  const isExpanded = expandedWeekDays.has(day.date);
                  const categoryBadges = buildWeekBadges(day, features);
                  const isPastDay = day.date.slice(0, 10) < todayKey;
                  const isClosedDay = day.closures.length > 0;
                  const hasShifts = features.shifts && day.shifts.length > 0;
                  return (
                  <div
                    key={day.date}
                    className="workbit-week-day-card"
                    role={isPastDay ? undefined : "button"}
                    tabIndex={isPastDay ? undefined : 0}
                    onClick={() => {
                      if (!isPastDay) {
                        openDay(day);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (isPastDay || (event.key !== "Enter" && event.key !== " ")) {
                        return;
                      }

                      event.preventDefault();
                      openDay(day);
                    }}
                    title={
                      isPastDay
                        ? "Giornata passata: nuovi inserimenti non disponibili"
                        : undefined
                    }
                    data-calendar-today={day.isToday ? "true" : undefined}
                    data-calendar-closed={day.closures.length > 0 ? "true" : undefined}
                    style={{
                      // A rail three pixels wide carries the state, and only
                      // today gets a tinted ground: one coloured card per
                      // screen instead of seven.
                      display: "grid",
                      gridTemplateColumns: "3px minmax(0, 1fr)",
                      width: "100%",
                      maxWidth: "100%",
                      boxSizing: "border-box",
                      borderRadius: 15,
                      overflow: "hidden",
                      background: day.isToday ? "#f8f6ff" : "#ffffff",
                      border: `1px solid ${
                        day.isToday ? "#d9d0f8" : isClosedDay ? "#f0d5d9" : "#e9e6f5"
                      }`,
                      opacity: isPastDay ? 0.5 : day.inCurrentMonth ? 1 : 0.7,
                      textAlign: "left",
                      cursor: isPastDay ? "default" : "pointer",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        background: day.isToday
                          ? "#4c1d95"
                          : isClosedDay
                            ? "#e5a3aa"
                            : "#e9e6f5",
                      }}
                    />
                    <div style={{ display: "grid", gap: 6, minWidth: 0, padding: "10px 12px" }}>
                    <div
                      className="workbit-week-day-header"
                      style={{ display: "flex", alignItems: "center", gap: 7 }}
                    >
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 12.5,
                          letterSpacing: "0.01em",
                          fontWeight: day.isToday ? 760 : 620,
                          color: day.isToday ? "#4c1d95" : isClosedDay ? "#a8424f" : "#6b6880",
                        }}
                      >
                        {formatCompactDayLabel(day.date, locale)}
                      </span>
                      {day.isToday ? (
                        <span
                          style={{
                            flex: "0 0 auto",
                            fontSize: 9,
                            fontWeight: 780,
                            letterSpacing: "0.11em",
                            color: "#6d5ce7",
                          }}
                        >
                          OGGI
                        </span>
                      ) : null}
                      {isClosedDay ? (
                        <span style={{ flex: "0 0 auto", fontSize: 11, fontWeight: 620, color: "#a8424f" }}>
                          Chiuso
                        </span>
                      ) : null}

                      {/* The dots are the closed-up summary. While the day is
                          open the sections below say the same thing with the
                          same words, so the day printed "Corsi +1" and then
                          "Corsi" straight underneath. */}
                      {categoryBadges.length > 0 && !isExpanded ? (
                        <span
                          className="workbit-week-badges"
                          style={{ display: "inline-flex", gap: 2, alignItems: "center", flex: "0 0 auto" }}
                        >
                          {categoryBadges.map((badge) =>
                            renderWeekDot(badge, () => toggleExpandedWeekDay(day.date))
                          )}
                        </span>
                      ) : null}

                      {/* Nothing sits behind the arrow on a day that holds only
                          shifts, so the arrow is not drawn there. */}
                      {categoryBadges.length > 0 ? (
                        <span
                          className="workbit-week-details"
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
                            flex: "0 0 auto",
                            width: 18,
                            height: 18,
                            display: "inline-grid",
                            placeItems: "center",
                            color: "#b6b3c9",
                            cursor: "pointer",
                          }}
                        >
                          <svg
                            width="11"
                            height="11"
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
                              strokeWidth="2.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      ) : null}
                    </div>

                    {hasShifts ? (
                      <div className="workbit-week-shifts" style={{ display: "grid", gap: 5 }}>
                        {groupShiftsByTime(day.shifts).map((shift) =>
                          renderShiftSwipeActions(
                            shift,
                            renderWeekShiftLine(shift, locale, currentUserId, () => {
                              setSelectedDate(day.date);
                              setActiveCalendarModal("shifts");
                              setEditingShiftId(null);
                            }),
                            day.date
                          )
                        )}
                      </div>
                    ) : isClosedDay ? null : (
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: "#c2bfd4" }}>
                        {isPastDay ? "Giornata passata" : "Nessun turno"}
                      </span>
                    )}

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
                        {features.requests && day.requests.filter((request) => request.type === RequestType.PERMISSION).length > 0
                          ? renderWeekSection(
                              "Permessi",
                              day.requests
                                .filter((request) => request.type === RequestType.PERMISSION)
                                .map((request) =>
                                  renderDeleteSwipeCard(
                                    `request-${request.id}`,
                                    renderApprovedRequestCard(request, true),
                                    "Elimina richiesta",
                                    () => handleDeleteRequest(request.id)
                                  )
                                ),
                              "permission"
                            )
                          : null}
                        {features.requests && day.requests.filter((request) => request.type === RequestType.VACATION).length > 0
                          ? renderWeekSection(
                              "Ferie",
                              day.requests
                                .filter((request) => request.type === RequestType.VACATION)
                                .map((request) =>
                                  renderDeleteSwipeCard(
                                    `request-${request.id}`,
                                    renderApprovedRequestCard(request, true),
                                    "Elimina richiesta",
                                    () => handleDeleteRequest(request.id)
                                  )
                                ),
                              "vacation"
                            )
                          : null}
                        {features.courses && day.courses.length > 0
                          ? renderWeekSection(
                              "Corsi",
                              day.courses.map((course) =>
                                renderCompactTextCard(
                                  `course-${course.id}`,
                                  course.title,
                                  `${formatRange(course.startTime, course.endTime, locale)}${course.location ? ` - ${course.location}` : ""}`,
                                  "course"
                                )
                              ),
                              "course"
                            )
                          : null}
                        {(features.tasks && day.tasks.length > 0) || (features.noticeBoard && day.notes.length > 0)
                          ? renderWeekSection(
                              "Note",
                              <>
                                {features.tasks
                                  ? day.tasks.map((task) =>
                                      renderDeleteSwipeCard(
                                        `task-${task.id}`,
                                        renderTaskPreviewCard(task, true, () => {
                                          setSelectedDate(day.date);
                                          setActiveCalendarModal("notes");
                                        }),
                                        "Elimina nota",
                                        () => handleDeleteTask(task.id)
                                      )
                                    )
                                  : null}
                                {features.noticeBoard
                                  ? day.notes.map((note) =>
                                      renderDeleteSwipeCard(
                                        `note-${note.id}`,
                                        renderNotePreviewCard(note, true, () => {
                                          setSelectedDate(day.date);
                                          setActiveCalendarModal("notes");
                                        }),
                                        "Elimina nota",
                                        () => handleDeleteBoardNote(note.id)
                                      )
                                    )
                                  : null}
                              </>,
                              "note"
                            )
                          : null}
                        {features.availability && day.availabilities.length > 0
                          ? renderWeekSection(
                              "Indisponibilità",
                              day.availabilities.map((availability) =>
                                renderDeleteSwipeCard(
                                  `availability-${availability.id}`,
                                  renderAvailabilityCard(availability, true),
                                  "Elimina indisponibilita",
                                  () => handleDeleteAvailability(availability.id)
                                )
                              ),
                              "availability"
                            )
                          : null}
                        {features.shifts && day.shifts.filter((shift) => shift.isOnCall).length > 0
                          ? renderWeekSection(
                              "Reperibilità",
                              day.shifts
                                .filter((shift) => shift.isOnCall)
                                .map((shift) => renderPendingOnCallCard(shift, locale, true)),
                              "onCall"
                            )
                          : null}
                        {features.requests && day.requests.filter((request) => request.type === RequestType.OVERTIME).length > 0
                          ? renderWeekSection(
                              "Straordinari",
                              day.requests
                                .filter((request) => request.type === RequestType.OVERTIME)
                                .map((request) =>
                                  renderDeleteSwipeCard(
                                    `request-${request.id}`,
                                    renderApprovedRequestCard(request, true),
                                    "Elimina richiesta",
                                    () => handleDeleteRequest(request.id)
                                  )
                                ),
                              "overtime"
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
                              ),
                              "closure"
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
                            renderShiftSwipeActions(
                              shift,
                              renderCompactShiftCard(shift, locale, true, () => {
                              setSelectedDate(day.date);
                              setActiveCalendarModal("shifts");
                              setEditingShiftId(null);
                              }),
                              day.date
                            )
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
                              <strong style={{ display: "block", fontSize: 12 }}>
                                {formatRequestTypeLabel(request.type)}: {request.firstName} {request.lastName}
                              </strong>
                              <span style={{ display: "block", color: "#b91c1c", fontSize: 11 }}>
                                {formatRange(request.startsAt, request.endsAt, locale)}
                              </span>
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
                              <strong style={{ display: "block", fontSize: 12 }}>
                                Indisponibile: {availability.firstName} {availability.lastName}
                              </strong>
                              <span style={{ display: "block", color: "#b91c1c", fontSize: 11 }}>
                                {formatRange(availability.startsAt, availability.endsAt, locale)}
                              </span>
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
                    </div>
                  </div>
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
                <div style={{ display: "grid", gap: 1 }}>
                  {/* The year pushed the title onto a second line and nobody
                      was in doubt about it. */}
                  <strong
                    style={{
                      fontSize: 20,
                      fontWeight: 830,
                      letterSpacing: "-0.028em",
                      color: "#17161f",
                      textTransform: "capitalize",
                    }}
                  >
                    {new Intl.DateTimeFormat(locale, {
                      weekday: "long",
                      day: "numeric",
                      timeZone: APP_TIME_ZONE,
                    }).format(new Date(day.date))}
                  </strong>
                  {day.isToday ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 780,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "#6d5ce7",
                      }}
                    >
                      Oggi
                    </span>
                  ) : (
                    <span style={{ fontSize: 11.5, fontWeight: 620, color: "#a3a0b8" }}>
                      {new Intl.DateTimeFormat(locale, {
                        month: "long",
                        timeZone: APP_TIME_ZONE,
                      }).format(new Date(day.date))}
                    </span>
                  )}
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

                {!modalContentReady ? (
                  <div style={{ display: "grid", gap: 10, padding: "8px 0" }}>
                    {[0, 1, 2].map((item) => (
                      <div
                        key={item}
                        style={{
                          height: item === 0 ? 42 : 58,
                          borderRadius: 18,
                          background:
                            "linear-gradient(90deg, rgba(245,243,255,0.9), rgba(255,255,255,0.95), rgba(245,243,255,0.9))",
                          border: "1px solid rgba(124, 58, 237, 0.10)",
                        }}
                      />
                    ))}
                  </div>
                ) : null}

                {modalContentReady && features.shifts && showShiftComposer ? createPortal(
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
                  {/* No title bar of its own: the screen below already says
                      which step it is and carries the one way out. Two ✕ one
                      above the other did the same thing twice. */}

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

                        const savedShift = shiftDraftToShiftItem(draft, members, currentUserId);
                        const savedCard = (
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

                        return savedShift
                          ? renderShiftSwipeActions(savedShift, savedCard, draft.date, true)
                          : savedCard;
                      })}
                    </div>
                  ) : null}

                  {selectedDay ? (
                    <ShiftQuickAdd
                      // A saved shift lands in the list above; remounting here
                      // clears the keypad for the next one.
                      key={`${selectedDay.date}-${savedShiftDrafts.length}`}
                      dayKey={selectedDay.date.slice(0, 10)}
                      dayLabel={formatDayLabel(selectedDay.date, locale)}
                      members={members.map((member) => ({
                        id: member.id,
                        name: `${member.firstName} ${member.lastName}`.trim(),
                        roleLabel: formatRoleLabel(member.role),
                      }))}
                      presets={presets}
                      recent={recentShiftTimes}
                      weeks={composerWeeks}
                      busyAt={busyAt}
                      pending={isPending}
                      onCancel={() => setShowShiftComposer(false)}
                      onSave={(drafts) =>
                        addShiftDrafts(
                          drafts.map((draft) => ({
                            ...createShiftDraft(draft.date),
                            date: draft.date,
                            startTime: draft.startTime,
                            endTime: draft.endTime,
                            memberIds: draft.memberIds,
                            isOnCall: draft.isOnCall,
                          }))
                        )
                      }
                      onSavePreset={(slot) =>
                        runAction(async () => {
                          const formData = new FormData();
                          formData.set("startTime", slot.startTime);
                          formData.set("endTime", slot.endTime);
                          await addStandardShiftPresetAction(formData);
                        }, "Fascia salvata.")
                      }
                    />
                  ) : null}
                  </section>
                </div>,
                document.body
                ) : null}

                {modalContentReady &&
                selectedDay &&
                activeCalendarModal !== "notes" &&
                (features.shifts || features.requests || features.tasks || features.noticeBoard) ? (
                  <div style={{ display: "grid", gap: 10 }}>
                  {dayOverlaps.message ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 9,
                        padding: "11px 12px",
                        borderRadius: 13,
                        background: "#fff8ed",
                        border: "1px solid #f5dcb3",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          flex: "0 0 auto",
                          width: 18,
                          height: 18,
                          borderRadius: 999,
                          background: "#f0a742",
                          color: "#ffffff",
                          display: "grid",
                          placeItems: "center",
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        !
                      </span>
                      <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                        <strong style={{ fontSize: 12.5, fontWeight: 800, color: "#92400e" }}>
                          {dayOverlaps.message}
                        </strong>
                        <span style={{ fontSize: 12, fontWeight: 520, color: "#a16207", lineHeight: 1.45 }}>
                          Tocca un turno per correggerlo.
                        </span>
                      </span>
                    </div>
                  ) : null}

                  {renderDaySectionHeader(
                    "Turni",
                    day.shifts.length,
                    "Aggiungi turni",
                    () => {
                      setShowShiftComposer(true);
                      if (!currentShiftDraft) {
                        setCurrentShiftDraft(createShiftDraft(day.date));
                      }
                    },
                    isPending
                  )}
                  {day.shifts.length === 0 ? (
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: "#c2bfd4" }}>
                      Nessun turno in questa giornata.
                    </div>
                  ) : (
                    <div className="dashboard-scroll-list" style={{ display: "grid", gap: 7 }}>
                      {day.shifts.map((shift) => renderShiftSwipeActions(shift, (
                        renderDayShiftRow(shift, locale, currentUserId, dayOverlaps.clashing.has(shift.id))
                      ), day.date, true))}
                    </div>
                  )}
                  </div>
                ) : null}

                {modalContentReady && (activeCalendarModal === "day" || activeCalendarModal === "shifts") && features.shifts && (selectedDay?.pendingOnCallShifts ?? []).filter(
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

                {modalContentReady && activeCalendarModal !== "shifts" && (features.tasks || features.noticeBoard) ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {/* The date is already in the title of the sheet, and the
                      count no longer needs a black pill of its own. */}
                  {renderDaySectionHeader(
                    "Note",
                    day.tasks.length + day.notes.length,
                    "Aggiungi note",
                    () => setQuickComposer("task"),
                    isPending
                  )}
                  {day.tasks.length === 0 && day.notes.length === 0 ? (
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: "#c2bfd4" }}>
                      Nessuna nota in questa giornata.
                    </div>
                  ) : (
                    <div className="dashboard-scroll-list" style={{ display: "grid", gap: 10 }}>
                      {day.tasks.map((task) =>
                        renderDeleteSwipeCard(
                          `task-${task.id}`,
                          <NoteRow
                            title={task.title}
                            meta={task.meta}
                            action={
                              task.requiresConfirmation && task.status !== "DONE" ? (
                                <IconButton
                                  type="button"
                                  aria-label="Conferma nota"
                                  title="Conferma nota"
                                  onClick={() => handleCompleteTask(task.id)}
                                  disabled={isPending}
                                  style={{
                                    width: 40,
                                    height: 40,
                                    background: "#dcfce7",
                                    color: "#166534",
                                    border: "1px solid #bbf7d0",
                                    flexShrink: 0,
                                    fontSize: 15,
                                    fontWeight: 900,
                                  }}
                                >
                                  ✓
                                </IconButton>
                              ) : null
                            }
                          />,
                          "Elimina nota",
                          () => handleDeleteTask(task.id),
                          true
                        )
                      )}
                      {day.notes.map((note) =>
                        renderDeleteSwipeCard(
                          `note-${note.id}`,
                          <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedNoteId(note.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedNoteId(note.id);
                            }
                          }}
                          className="dashboard-list-card"
                          style={{
                            padding: 14,
                            borderRadius: 18,
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            display: "grid",
                            gap: 8,
                            textAlign: "left",
                            cursor: "pointer",
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
                            <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                              {renderNoteConfirmations(note, locale)}
                            </div>
                            {note.requiresConfirmation &&
                            !note.confirmations.some(
                              (confirmation) => confirmation.userId === currentUserId
                            ) &&
                            (!note.employeeId || note.employeeId === currentUserId) ? (
                              <form
                                action={confirmBoardNoteReadAction}
                                onClick={(event) => event.stopPropagation()}
                                style={{ flex: "0 0 auto" }}
                              >
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
                          </div>,
                          "Elimina nota",
                          () => handleDeleteBoardNote(note.id),
                          true
                        )
                      )}
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
                      <strong style={{ color: "#0f172a", fontSize: 20, paddingRight: 44 }}>📌 Nota</strong>
                      <div className="dashboard-list-card" style={{ padding: 14, borderRadius: 18, background: "#f8fafc", border: "1px solid #e2e8f0", display: "grid", gap: 10 }}>
                        <strong style={{ color: "#0f172a" }}>{selectedNote.content}</strong>
                        <span style={{ color: "#64748b", fontSize: 14 }}>
                          {selectedNote.authorName} - {formatDayTime(selectedNote.createdAt, locale)}
                        </span>
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", justifyContent: "space-between" }}>
                          <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                            {renderNoteConfirmations(selectedNote, locale)}
                          </div>
                          {selectedNote.requiresConfirmation &&
                          !selectedNote.confirmations.some((confirmation) => confirmation.userId === currentUserId) &&
                          (!selectedNote.employeeId || selectedNote.employeeId === currentUserId) ? (
                            <form
                              action={confirmBoardNoteReadAction}
                              onClick={(event) => event.stopPropagation()}
                              style={{ flex: "0 0 auto" }}
                            >
                              <input type="hidden" name="noteId" value={selectedNote.id} />
                              <IconButton type="submit" aria-label="Conferma lettura" title="Conferma lettura" style={{ background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" }}>
                                ✓
                              </IconButton>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    </section>
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
        onDeleted={(shiftId) => {
          setSavedShiftDrafts((current) => current.filter((draft) => draft.shiftId !== shiftId));
        }}
        onUpdated={(shiftId) => {
          setSavedShiftDrafts((current) => current.filter((draft) => draft.shiftId !== shiftId));
        }}
        onClose={closeModal}
      />
      <QuickCalendarEntryModal
        open={Boolean(
          selectedDay &&
            quickComposer &&
            (features.tasks || features.noticeBoard)
        )}
        mode={quickComposer}
        dateIso={day.date ?? null}
        members={members}
        canPinBoard
        canCreateTask={features.tasks}
        canCreateBoard={features.noticeBoard}
        isPending={isPending}
        onClose={closeModal}
        onSubmitTask={handleQuickTaskCreate}
        onSubmitBoard={handleQuickBoardCreate}
      />
    </>
  );
}
