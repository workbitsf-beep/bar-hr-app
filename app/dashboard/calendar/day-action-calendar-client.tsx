"use client";

import { ActivityType, RequestType, Role } from "@prisma/client";
import type { NoteMeta } from "@/lib/note-list-format";
import { NoteRow } from "../note-row";
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
  type TouchEvent,
  type WheelEvent,
} from "react";
import { combineDateAndTime } from "@/lib/shift-datetime";
import { APP_TIME_ZONE, toDateInputValueInTimeZone } from "@/lib/time-zone";
import type { ShiftPreset } from "@/lib/shift-presets";
import type { FeatureFlags } from "@/lib/features";
import {
  getRequestBadge,
  WEEK_BADGE_STYLES,
  WEEK_TONE_DOTS,
  WEEK_TONE_LABELS,
  type WeekBadge,
  type WeekBadgeTone,
} from "@/lib/calendar-tones";
import {
  buildShiftOverlaps,
  collectSharedFirstNames,
  shortNameFor,
} from "@/lib/calendar-rules";
import { isActionFailure } from "@/lib/rule-error";
import { TimeInput } from "@/app/components/time-input";
import {
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
import { IconButton, PrimaryButton, Select, StatusPill, SuccessCallout, TextInput } from "../ui";
import { useOverlayLock } from "../use-overlay-lock";
import { CalendarWeekStrip } from "./calendar-week-strip";
import { groupShiftsByTime } from "./group-shifts-by-time";
import { QuickCalendarEntryModal } from "./quick-calendar-entry-modal";
import { scrollToTodayCard } from "./scroll-to-today-button";
import {
  addDaysToDateKey,
  chunkByWeek,
  dateKeyToLocalDate,
  formatCompactDayLabel,
  formatDayHeading,
  formatDayLabel,
  formatRange,
  formatRequestTypeLabel,
  formatRoleLabel,
  formatTime,
  formatWeekHeading,
  getErrorMessage,
  hasTimeOverlap,
  isShiftPastDay,
  startOfWeekDateKey,
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
  shiftId?: string;
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

function toDateTimeLocal(dateIso: string, hour: number, minute: number) {
  const day = toDateInputValueInTimeZone(dateIso);
  return `${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function isOwnShift(shift: Pick<ShiftItem, "assignments">) {
  return shift.assignments.some((assignment) => assignment.isCurrentUser);
}

function formatAssignmentNames(
  assignments: ShiftAssignment[],
  sharedFirstNames: Set<string> = new Set()
) {
  // You first, then the rest in a fixed order, so the same shift reads the
  // same way every time it is drawn.
  const ordered = assignments.slice().sort((left, right) => {
    if (left.isCurrentUser !== right.isCurrentUser) {
      return left.isCurrentUser ? -1 : 1;
    }

    return `${left.firstName} ${left.lastName}`.localeCompare(
      `${right.firstName} ${right.lastName}`,
      "it"
    );
  });

  return ordered.map((assignment, index) => (
    <span key={assignment.id} style={{ fontWeight: 400 }}>
      {index > 0 ? ", " : null}
      {assignment.isCurrentUser ? (
        <strong style={{ fontWeight: 900 }}>{shortNameFor(assignment, sharedFirstNames)}</strong>
      ) : (
        shortNameFor(assignment, sharedFirstNames)
      )}
    </span>
  ));
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
    for (const request of [...day.requests, ...day.pendingRequests]) {
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
          width: 8,
          height: 8,
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
            width: 8,
            height: 8,
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

/**
 * The three numbers above the day: from the first one in to the last one out,
 * how many people, and how many hours of work were put in.
 *
 * `doubled` says the hours are counted twice over because two shifts on the
 * same person overlap, so the tile can admit it rather than showing a figure
 * nobody could reach.
 */
function buildDaySummary(shifts: ShiftItem[], locale: string, doubled: boolean) {
  if (shifts.length === 0) {
    return null;
  }

  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;
  let minutes = 0;
  const people = new Set<string>();

  for (const shift of shifts) {
    const start = new Date(shift.startTime).getTime();
    const end = new Date(shift.endTime).getTime();

    first = Math.min(first, start);
    last = Math.max(last, end);
    minutes += Math.max(0, Math.round((end - start) / 60_000));

    for (const assignment of shift.assignments) {
      people.add(assignment.id);
    }
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return {
    covered: `${formatTime(new Date(first).toISOString(), locale).slice(0, 2)}–${formatTime(
      new Date(last).toISOString(),
      locale
    ).slice(0, 2)}`,
    people: people.size,
    hours: rest === 0 ? `${hours}h` : `${hours}h ${String(rest).padStart(2, "0")}`,
    doubled,
  };
}

function renderDaySummaryTiles(summary: ReturnType<typeof buildDaySummary>) {
  if (!summary) {
    return null;
  }

  const tile = (value: string, caption: string, warn = false) => (
    <span
      key={caption}
      style={{
        flex: 1,
        minWidth: 0,
        display: "grid",
        gap: 1,
        padding: "9px 10px",
        borderRadius: 14,
        background: warn ? "#fffaf1" : "#ffffff",
        border: `1px solid ${warn ? "#f5dcb3" : "#e9e6f5"}`,
      }}
    >
      <strong
        style={{
          fontSize: 16.5,
          fontWeight: 840,
          letterSpacing: "-0.028em",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          color: warn ? "#92400e" : "#17161f",
        }}
      >
        {value}
      </strong>
      <span
        style={{
          fontSize: 9,
          fontWeight: 820,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: warn ? "#c08a3e" : "#a3a0b8",
        }}
      >
        {caption}
      </span>
    </span>
  );

  return (
    <div style={{ display: "flex", gap: 7 }}>
      {tile(summary.covered, "coperto")}
      {tile(String(summary.people), summary.people === 1 ? "persona" : "persone")}
      {tile(summary.hours, summary.doubled ? "ore · doppie" : "ore", summary.doubled)}
    </div>
  );
}

/** The amber line that owns up to an overlap already in the database. */
function renderOverlapWarning(message: string | null, advice: string) {
  if (!message) {
    return null;
  }

  return (
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
        <strong style={{ fontSize: 12.5, fontWeight: 800, color: "#92400e" }}>{message}</strong>
        <span style={{ fontSize: 12, fontWeight: 520, color: "#a16207", lineHeight: 1.45 }}>
          {advice}
        </span>
      </span>
    </div>
  );
}

/** One section of the day sheet: its label, its own + when it has one, its rows. */
function renderDaySheetSection(
  key: string,
  label: string,
  tone: WeekBadgeTone,
  count: number,
  children: ReactNode,
  add?: { label: string; onAdd: () => void; disabled: boolean }
) {
  return (
    <div
      key={key}
      className="workbit-day-sheet-section"
      style={{ display: "grid", gap: 6, padding: "11px 12px 12px" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 9.5,
            fontWeight: 830,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#a3a0b8",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: WEEK_TONE_DOTS[tone],
              flex: "0 0 auto",
            }}
          />
          {count > 0 ? `${label} · ${count}` : label}
        </span>
        {add ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              add.onAdd();
            }}
            aria-label={add.label}
            title={add.label}
            disabled={add.disabled}
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
              cursor: add.disabled ? "default" : "pointer",
              opacity: add.disabled ? 0.5 : 1,
            }}
          >
            +
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

type DaySectionTab = { key: string; label: string; tone: WeekBadgeTone; count: number };

/**
 * The row of jumps at the top of the day.
 *
 * The day sheet holds every category now, which on a busy day is a long
 * scroll. These say what is in the day before you scroll it, and take you
 * straight to a section - and they are the one place where a colour and its
 * word are shown together, so the dots on the week card can be learnt.
 */
function DaySectionTabs({
  tabs,
  onPick,
}: {
  tabs: DaySectionTab[];
  onPick: (key: string) => void;
}) {
  // Turni and Note are always there, so two tabs are a row of jumps to a sheet
  // short enough to see whole. They earn their place from the third on, when
  // the day is actually carrying something else.
  if (tabs.length < 3) {
    return null;
  }

  return (
    <div
      className="workbit-day-tabs"
      style={{
        display: "flex",
        gap: 6,
        overflowX: "auto",
        paddingBottom: 2,
        WebkitOverflowScrolling: "touch",
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onPick(tab.key)}
          style={{
            flex: "0 0 auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 11px",
            borderRadius: 999,
            border: "1px solid #ece9f8",
            background: "#f7f5fe",
            color: tab.count > 0 ? "#3a3850" : "#a3a0b8",
            fontSize: 11,
            fontWeight: 760,
            letterSpacing: "0.01em",
            cursor: "pointer",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              flex: "0 0 auto",
              borderRadius: 999,
              background: WEEK_TONE_DOTS[tab.tone],
              opacity: tab.count > 0 ? 1 : 0.42,
            }}
          />
          {tab.label}
          {tab.count > 0 ? (
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 840 }}>{tab.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/**
 * A plain line inside the day sheet: what it is on the left, when on the right.
 */
function renderDaySheetRow(
  key: string,
  text: string,
  meta: string,
  tone: WeekBadgeTone,
  onOpen?: () => void,
  /** A finished note is crossed out here too, not only on the Note page. */
  done = false
) {
  return (
    <div
      key={key}
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
        display: "grid",
        gridTemplateColumns: "3px minmax(0, 1fr)",
        borderRadius: 11,
        overflow: "hidden",
        background: "#ffffff",
        border: "1px solid #f0eef9",
        cursor: onOpen ? "pointer" : "default",
        textAlign: "left",
      }}
    >
      <span aria-hidden="true" style={{ background: WEEK_TONE_DOTS[tone] }} />
      <span style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", minWidth: 0 }}>
        <span
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 13,
            fontWeight: 640,
            color: done ? "#a3a0b8" : "#17161f",
            textDecoration: done ? "line-through" : "none",
          }}
        >
          {text}
        </span>
        {meta ? (
          <span
            style={{
              marginLeft: "auto",
              flex: "0 0 auto",
              fontSize: 11.5,
              fontWeight: 520,
              color: "#a3a0b8",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {meta}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/** The grey line a section shows when it is empty but still worth offering. */
function renderDaySheetEmpty(text: string) {
  return <span style={{ fontSize: 12.5, fontWeight: 500, color: "#c2bfd4" }}>{text}</span>;
}

/** The small capitals above a list, with the one round button that adds to it. */
/**
 * A shift action hands a broken rule back as a value now, because Next.js
 * hides anything thrown out of a server action. Throwing it here puts it
 * where the surrounding catch can show it.
 */
function throwIfRefused(result: unknown) {
  if (isActionFailure(result)) {
    throw new Error(result.ruleError);
  }
}

function renderDaySectionHeader(
  label: string,
  count: number,
  addLabel: string,
  onAdd: () => void,
  disabled: boolean,
  canAdd = true,
  /** The category's colour, so a section is named here the way it is on the
      week card - the same dot, not a different mark for the same thing. */
  tone?: WeekBadgeTone
) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          fontSize: 9.5,
          fontWeight: 830,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#a3a0b8",
        }}
      >
        {tone ? (
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              flex: "0 0 auto",
              borderRadius: 999,
              background: WEEK_TONE_DOTS[tone],
            }}
          />
        ) : null}
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
  sharedFirstNames: Set<string>,
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
          {formatTime(shift.startTime, locale)}–{formatTime(shift.endTime, locale)}
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
          {formatAssignmentNames(shift.assignments, sharedFirstNames)}
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
  sharedFirstNames: Set<string>,
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
        {formatTime(shift.startTime, locale)}–{formatTime(shift.endTime, locale)}
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
        {formatAssignmentNames(shift.assignments, sharedFirstNames)}
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

function renderShiftCard(
  shift: ShiftItem,
  locale: string,
  sharedFirstNames: Set<string>,
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
        {isOwnShift(shift) ? (
          <strong style={{ color: "#0f172a", fontSize: mobile ? 12 : 12 }}>
            {formatTime(shift.startTime, locale)}–{formatTime(shift.endTime, locale)}
          </strong>
        ) : (
          <span style={{ color: "#0f172a", fontSize: mobile ? 12 : 12 }}>
            {formatTime(shift.startTime, locale)}–{formatTime(shift.endTime, locale)}
          </span>
        )}
        {shift.isOnCall ? (
          <span style={{ color: "#b45309", fontSize: mobile ? 11 : 11, fontWeight: 600 }}>
            {shift.confirmedAt ? "Reperibilita" : "Reperibilita in attesa"}
          </span>
        ) : null}
        <span style={{ color: "#475569", fontSize: mobile ? 12 : 11 }}>
          {formatAssignmentNames(shift.assignments, sharedFirstNames)}
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
          Indisponibilità: {availability.firstName} {availability.lastName}
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
      <strong
        style={{
          color: task.meta.done ? "#94a3b8" : "#0f172a",
          textDecoration: task.meta.done ? "line-through" : "none",
          fontSize: mobile ? 12 : 12,
        }}
      >
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

function renderPendingOnCallCard(
  shift: ShiftItem,
  locale: string,
  sharedFirstNames: Set<string>,
  mobile = false
) {
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
      <span style={{ color: "#475569" }}>{formatAssignmentNames(shift.assignments, sharedFirstNames)}</span>
    </div>
  );
}

function renderTaskCard(
  task: TaskItem,
  mobile = false,
  onComplete?: (taskId: string) => void,
  isPending = false
) {
  const canComplete = task.requiresConfirmation && task.status !== "DONE" && Boolean(onComplete);

  return (
    <NoteRow
      key={task.id}
      title={task.title}
      meta={task.meta}
      compact={mobile}
      action={
        canComplete ? (
          <IconButton
            type="button"
            aria-label="Conferma nota"
            title="Conferma nota"
            onClick={() => onComplete?.(task.id)}
            disabled={isPending}
            style={{
              width: mobile ? 36 : 40,
              height: mobile ? 36 : 40,
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
    />
  );
}
function renderNoteCard(note: NoteItem, locale: string, currentUserId: string, mobile = false) {
  const currentUserConfirmed = note.confirmations.some(
    (confirmation) => confirmation.userId === currentUserId
  );
  const confirmationCount = Math.max(note.confirmationCount, note.confirmations.length);
  const hasFullConfirmationList = note.confirmations.length >= confirmationCount;
  const canConfirm =
    note.requiresConfirmation && !currentUserConfirmed && (!note.employeeId || note.employeeId === currentUserId);

  return (
    <div
      key={note.id}
      className="workbit-day-note-card"
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
          <div style={{ display: "grid", gap: 4, minWidth: 0, flex: "1 1 auto" }}>
            {confirmationCount === 0 ? (
              <span style={{ color: "#94a3b8", fontSize: mobile ? 11 : 12 }}>
                Nessuna conferma
              </span>
            ) : hasFullConfirmationList ? (
              note.confirmations.map((confirmation) => (
                <span
                  key={`${note.id}-${confirmation.userId}`}
                  style={{ color: "#64748b", fontSize: mobile ? 11 : 12 }}
                >
                  ✓ {confirmation.userName} - {formatTime(confirmation.readAt, locale)}
                </span>
              ))
            ) : (
              <span style={{ color: "#64748b", fontSize: mobile ? 11 : 12 }}>
                {confirmationCount} {confirmationCount === 1 ? "conferma" : "conferme"}
              </span>
            )}
          </div>
          {canConfirm ? (
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
  /** The day popup's own scroll box, which the tabs at its top scroll. */
  const dayPanelRef = useRef<HTMLElement | null>(null);
  const [modalContentReady, setModalContentReady] = useState(false);
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
  const [noteConfirmationsById, setNoteConfirmationsById] = useState<Record<string, NoteItem["confirmations"]>>({});
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
      setSelectedDate(null);
      setQuickComposer(null);
      setFeedback(null);
      setCurrentShiftDraft(null);
      setSavedShiftDrafts([]);
      setShiftDrafts([]);
      setShiftInsertMode("DAY");
      setSelectedShiftWeekdays([]);
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
  // Which first names are carried by more than one person, so only those
  // need a surname initial - and they get it on every shift, not only where
  // the two happen to work together.
  const sharedFirstNames = useMemo(() => collectSharedFirstNames(days), [days]);
  const dayOverlaps = useMemo(() => buildShiftOverlaps(selectedDay?.shifts ?? []), [selectedDay]);
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
  /**
   * The receipt of what has just been saved. Every line used to lead with the
   * person's name, which is the same on all of them - five rows reading "Work
   * Wo" - while the day, the one thing that differs, was the small grey line
   * underneath. The day leads now, and the name is said once at the top when
   * it is the same for all of them.
   */
  const savedDraftsPeopleVary = useMemo(
    () => new Set(savedShiftDrafts.map((draft) => [...draft.memberIds].sort().join("+"))).size > 1,
    [savedShiftDrafts]
  );
  const savedDraftsPeopleLabel = useMemo(() => {
    const first = savedShiftDrafts[0];

    if (!first) {
      return "";
    }

    return (
      first.memberIds
        .map((memberId) => members.find((member) => member.id === memberId))
        .filter(Boolean)
        .map((member) => `${member?.firstName} ${member?.lastName}`.trim())
        .join(", ") || "Nessuna persona"
    );
  }, [members, savedShiftDrafts]);

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
      const allWeeks = chunkByWeek(daysRef.current);
      const week = allWeeks.find((entry) => entry[0]?.date.slice(0, 10) === weekStart);

      if (!week || week.some((day) => day.date === current)) {
        return current;
      }

      // Keep the same weekday where the week has one, so scrolling sideways
      // reads as moving a week, not as jumping to a different day.
      const weekdayIndex = Math.max(
        0,
        allWeeks
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

  /**
   * Takes the day sheet to one of its sections. The panel is the scroll box,
   * and every section carries a data-day-section, so this is the same move
   * whether it comes from a tab or from the door the day was opened by.
   */
  const scrollToDaySection = useCallback((key: string) => {
    const panel = dayPanelRef.current;
    const target = panel?.querySelector(`[data-day-section="${key}"]`);

    if (!panel || !(target instanceof HTMLElement)) {
      return;
    }

    panel.scrollTo({ top: Math.max(0, target.offsetTop - 14), behavior: "smooth" });
  }, []);

  // Opening on the notes means opening the day at the notes - not opening a
  // day that is nothing but notes, which is what it used to mean.
  useEffect(() => {
    if (!modalContentReady || !activeCalendarModal || activeCalendarModal === "day") {
      return;
    }

    const timer = window.setTimeout(() => scrollToDaySection(activeCalendarModal), 60);

    return () => window.clearTimeout(timer);
  }, [activeCalendarModal, modalContentReady, scrollToDaySection]);

  function closeModal() {
    if (isPending) {
      return;
    }

    setEditingShiftId(null);
    setActiveCalendarModal(null);
    setModalContentReady(false);
    setSelectedNoteId(null);
    setShowShiftComposer(false);
    setSelectedDate(null);
    setQuickComposer(null);
    setFeedback(null);
    setCurrentShiftDraft(null);
    setSavedShiftDrafts([]);
    setShiftDrafts([]);
    setShiftInsertMode("DAY");
    setSelectedShiftWeekdays([]);
  }

  function openShiftEditor(shiftId: string, dayDate?: string) {
    if (!canManageOptionalShifts) {
      return;
    }

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
    if (!canManageOptionalShifts) {
      return;
    }

    const shift = days.flatMap((day) => day.shifts).find((entry) => entry.id === shiftId);

    if (shift && isShiftPastDay(shift, todayKey)) {
      setFeedback({ tone: "danger", message: "I turni dei giorni passati non si possono eliminare." });
      return;
    }

    const formData = new FormData();
    formData.set("shiftId", shiftId);

    startTransition(async () => {
      try {
        throwIfRefused(await deleteShiftAction(formData));
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
    const canEditShift = canManageOptionalShifts && !isShiftPastDay(shift, todayKey);

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

        const created = await createShiftAction(formData);

        // A rule the venue set comes back as a value, because Next.js hides
        // anything an action throws. Throwing it here puts it in front of
        // runAction's catch, which is what puts words on the screen.
        if (isActionFailure(created)) {
          throw new Error(created.ruleError);
        }

        savedDrafts.push({ ...draft, id: created.id, shiftId: created.id });
      }

      setSavedShiftDrafts((current) => sortShiftDraftsByDateTime(current.concat(savedDrafts)));
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
        window.dispatchEvent(new CustomEvent("workbit:swipe-reset"));
        window.setTimeout(() => {
          if (refreshDate) {
            // Marked as already handled. This anchor is our own bookkeeping
            // after a save, not somebody asking to be taken to a day, and the
            // effect that honours such a request closes whatever sheet is
            // open. It fired on the first save, when the anchor changed for
            // the first time, and never again - which is exactly how it
            // looked: the popup shut after the first shift and stayed put
            // after the rest.
            previousInitialFocusedDayRef.current = refreshDate;

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
      throwIfRefused(await confirmShiftAction(formData));
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
            {canManageOptionalShifts && focusedDay.date.slice(0, 10) >= todayKey ? (
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
            const isClosedDay = day.closures.length > 0;
            const canAddToDay = day.date.slice(0, 10) >= todayKey;
            const overlaps = buildShiftOverlaps(features.shifts ? day.shifts : []);
            const summary = buildDaySummary(
              features.shifts ? day.shifts : [],
              locale,
              overlaps.clashing.size > 0
            );

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

                {renderDaySummaryTiles(summary)}
                {renderOverlapWarning(overlaps.message, "Parlane con chi fa i turni.")}

                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e9e6f5",
                    borderRadius: 18,
                    overflow: "hidden",
                  }}
                >
                  {isClosedDay
                    ? renderDaySheetSection(
                        "closures",
                        "Chiuso",
                        "closure",
                        0,
                        <div style={{ display: "grid", gap: 6 }}>
                          {day.closures.map((closure) =>
                            renderDaySheetRow(`closure-${closure.id}`, closure.title, "", "closure")
                          )}
                        </div>
                      )
                    : null}

                  {features.shifts && (day.shifts.length > 0 || canManageOptionalShifts)
                    ? renderDaySheetSection(
                        "shifts",
                        "Turni",
                        "onCall",
                        day.shifts.length,
                        <div style={{ display: "grid", gap: 5 }}>
                          {day.shifts.length === 0
                            ? renderDaySheetEmpty("Nessun turno.")
                            : groupShiftsByTime(day.shifts).map((shift) =>
                                renderShiftSwipeActions(
                                  shift,
                                  renderWeekShiftLine(shift, locale, sharedFirstNames, currentUserId, () => {
                                    setSelectedDate(day.date);
                                    setActiveCalendarModal("shifts");
                                    setEditingShiftId(null);
                                  }),
                                  day.date
                                )
                              )}
                        </div>,
                        canManageOptionalShifts && canAddToDay
                          ? {
                              label: "Aggiungi turno",
                              disabled: isPending,
                              onAdd: () => {
                                openDay(day);
                                setShowShiftComposer(true);
                              },
                            }
                          : undefined
                      )
                    : null}

                  {features.tasks || features.noticeBoard
                    ? renderDaySheetSection(
                        "notes",
                        "Note",
                        "note",
                        day.tasks.length + day.notes.length,
                        <div style={{ display: "grid", gap: 6 }}>
                          {day.tasks.length === 0 && day.notes.length === 0
                            ? renderDaySheetEmpty("Nessuna nota.")
                            : null}
                          {day.tasks.map((task) =>
                            renderDeleteSwipeCard(
                              `task-${task.id}`,
                              renderDaySheetRow(
                                `task-row-${task.id}`,
                                task.title,
                                task.meta.parts.map((part) => part.text).join(" · "),
                                "note",
                                () => {
                                  setSelectedDate(day.date);
                                  setActiveCalendarModal("notes");
                                },
                                task.meta.done
                              ),
                              "Elimina nota",
                              () => handleDeleteTask(task.id)
                            )
                          )}
                          {day.notes.map((note) =>
                            renderDeleteSwipeCard(
                              `note-${note.id}`,
                              renderDaySheetRow(
                                `note-row-${note.id}`,
                                truncateCalendarText(note.content, 46),
                                note.isPinned ? "fissata" : "",
                                "note",
                                () => {
                                  setSelectedDate(day.date);
                                  setActiveCalendarModal("notes");
                                }
                              ),
                              "Elimina nota",
                              () => handleDeleteBoardNote(note.id)
                            )
                          )}
                        </div>,
                        canOpenTaskComposer && canAddToDay
                          ? {
                              label: "Aggiungi note",
                              disabled: isPending,
                              onAdd: () => {
                                setSelectedDate(day.date);
                                setActiveCalendarModal("notes");
                                setQuickComposer("task");
                              },
                            }
                          : undefined
                      )
                    : null}

                  {features.requests && day.requests.length > 0
                    ? renderDaySheetSection(
                        "requests",
                        "Ferie e permessi",
                        "vacation",
                        day.requests.length,
                        <div style={{ display: "grid", gap: 6 }}>
                          {day.requests.map((request) =>
                            renderDeleteSwipeCard(
                              `request-${request.id}`,
                              renderDaySheetRow(
                                `request-row-${request.id}`,
                                `${request.firstName} ${request.lastName}`,
                                formatRequestTypeLabel(request.type),
                                "vacation"
                              ),
                              "Elimina richiesta",
                              () => handleDeleteRequest(request.id)
                            )
                          )}
                        </div>
                      )
                    : null}

                  {features.availability && day.availabilities.length > 0
                    ? renderDaySheetSection(
                        "availability",
                        "Indisponibilità",
                        "availability",
                        day.availabilities.length,
                        <div style={{ display: "grid", gap: 6 }}>
                          {day.availabilities.map((availability) =>
                            renderDeleteSwipeCard(
                              `availability-${availability.id}`,
                              renderDaySheetRow(
                                `availability-row-${availability.id}`,
                                `${availability.firstName} ${availability.lastName}`,
                                formatRange(availability.startsAt, availability.endsAt, locale),
                                "availability"
                              ),
                              "Elimina indisponibilita",
                              () => handleDeleteAvailability(availability.id)
                            )
                          )}
                        </div>
                      )
                    : null}

                  {features.courses && day.courses.length > 0
                    ? renderDaySheetSection(
                        "courses",
                        "Corsi",
                        "course",
                        day.courses.length,
                        <div style={{ display: "grid", gap: 6 }}>
                          {day.courses.map((course) =>
                            renderDaySheetRow(
                              `course-${course.id}`,
                              course.title,
                              formatRange(course.startTime, course.endTime, locale),
                              "course"
                            )
                          )}
                        </div>
                      )
                    : null}
                </div>
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
              <div className="workbit-week-range" style={{ display: "grid", gap: 4 }}>
                <span style={{ color: "#64748b", lineHeight: 1.6 }}>
                  {new Intl.DateTimeFormat(locale, {
                    day: "numeric",
                    month: "long",
                    timeZone: APP_TIME_ZONE,
                  }).format(new Date(week[0].date))}
                  {"\u00a0—\u00a0"}
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
                          same words. */}
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
                            renderWeekShiftLine(shift, locale, sharedFirstNames, currentUserId, () => {
                              setSelectedDate(day.date);
                              setActiveCalendarModal("shifts");
                              setEditingShiftId(null);
                            }),
                            day.date
                          )
                        )}
                      </div>
                    ) : (
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
                        {features.requests && [...day.requests, ...day.pendingRequests].filter((request) => request.type === RequestType.PERMISSION).length > 0
                          ? renderWeekSection(
                              "Permessi",
                              <>
                                {day.requests
                                  .filter((request) => request.type === RequestType.PERMISSION)
                                  .map((request) =>
                                    renderDeleteSwipeCard(
                                      `request-${request.id}`,
                                      renderApprovedRequestCard(request, true),
                                      "Elimina richiesta",
                                      () => handleDeleteRequest(request.id)
                                    )
                                  )}
                                {day.pendingRequests
                                  .filter((request) => request.type === RequestType.PERMISSION)
                                  .map((request) => renderPendingRequestCard(request, true))}
                              </>,
                              "permission"
                            )
                          : null}
                        {features.requests && [...day.requests, ...day.pendingRequests].filter((request) => request.type === RequestType.VACATION).length > 0
                          ? renderWeekSection(
                              "Ferie",
                              <>
                                {day.requests
                                  .filter((request) => request.type === RequestType.VACATION)
                                  .map((request) =>
                                    renderDeleteSwipeCard(
                                      `request-${request.id}`,
                                      renderApprovedRequestCard(request, true),
                                      "Elimina richiesta",
                                      () => handleDeleteRequest(request.id)
                                    )
                                  )}
                                {day.pendingRequests
                                  .filter((request) => request.type === RequestType.VACATION)
                                  .map((request) => renderPendingRequestCard(request, true))}
                              </>,
                              "vacation"
                            )
                          : null}
                        {features.courses && day.courses.length > 0
                          ? renderWeekSection(
                              "Corsi",
                              day.courses.map((course) => renderCourseCard(course, locale, true)),
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
                                .map((shift) => renderPendingOnCallCard(shift, locale, sharedFirstNames, true)),
                              "onCall"
                            )
                          : null}
                        {features.requests && [...day.requests, ...day.pendingRequests].filter((request) => request.type === RequestType.OVERTIME).length > 0
                          ? renderWeekSection(
                              "Straordinari",
                              <>
                                {day.requests
                                  .filter((request) => request.type === RequestType.OVERTIME)
                                  .map((request) =>
                                    renderDeleteSwipeCard(
                                      `request-${request.id}`,
                                      renderApprovedRequestCard(request, true),
                                      "Elimina richiesta",
                                      () => handleDeleteRequest(request.id)
                                    )
                                  )}
                                {day.pendingRequests
                                  .filter((request) => request.type === RequestType.OVERTIME)
                                  .map((request) => renderPendingRequestCard(request, true))}
                              </>,
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
                              renderShiftCard(shift, locale, sharedFirstNames, true, () => {
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
                            renderDeleteSwipeCard(
                              `request-${request.id}`,
                              renderApprovedRequestCard(request, true),
                              "Elimina richiesta",
                              () => handleDeleteRequest(request.id)
                            )
                          );
                        }
                      }

                      if (features.tasks) {
                        for (const task of day.tasks) {
                          pushCard(
                            `task-${task.id}`,
                            renderDeleteSwipeCard(
                              `task-${task.id}`,
                              renderTaskPreviewCard(task, true, () => {
                                setSelectedDate(day.date);
                                setActiveCalendarModal("notes");
                              }),
                              "Elimina nota",
                              () => handleDeleteTask(task.id)
                            )
                          );
                        }
                      }

                      if (features.noticeBoard) {
                        for (const note of day.notes) {
                          pushCard(
                            `note-${note.id}`,
                            renderDeleteSwipeCard(
                              `note-${note.id}`,
                              renderNotePreviewCard(note, true, () => {
                                setSelectedDate(day.date);
                                setActiveCalendarModal("notes");
                              }),
                              "Elimina nota",
                              () => handleDeleteBoardNote(note.id)
                            )
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
                          pushCard(
                            `availability-${availability.id}`,
                            renderDeleteSwipeCard(
                              `availability-${availability.id}`,
                              renderAvailabilityCard(availability, true),
                              "Elimina indisponibilita",
                              () => handleDeleteAvailability(availability.id)
                            )
                          );
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
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(15, 23, 42, 0.28)",
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                }}
              />

              <section
                ref={dayPanelRef}
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
                    }).format(new Date(selectedDay.date))}
                  </strong>
                  {selectedDay.isToday ? (
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
                      }).format(new Date(selectedDay.date))}
                    </span>
                  )}
                </div>
                </div>

                {modalContentReady && selectedDay ? (
                  <DaySectionTabs
                    tabs={[
                      features.shifts
                        ? {
                            key: "shifts",
                            label: "Turni",
                            tone: "onCall" as WeekBadgeTone,
                            count: selectedDay.shifts.length,
                          }
                        : null,
                      features.tasks || features.noticeBoard
                        ? {
                            key: "notes",
                            label: "Note",
                            tone: "note" as WeekBadgeTone,
                            count: selectedDay.tasks.length + selectedDay.notes.length,
                          }
                        : null,
                      features.requests && selectedDay.requests.length > 0
                        ? {
                            key: "requests",
                            label: "Ferie e permessi",
                            tone: "vacation" as WeekBadgeTone,
                            count: selectedDay.requests.length,
                          }
                        : null,
                      features.courses && selectedDay.courses.length > 0
                        ? {
                            key: "courses",
                            label: "Corsi",
                            tone: "course" as WeekBadgeTone,
                            count: selectedDay.courses.length,
                          }
                        : null,
                      features.availability && selectedDay.availabilities.length > 0
                        ? {
                            key: "availability",
                            label: "Indisponibilità",
                            tone: "availability" as WeekBadgeTone,
                            count: selectedDay.availabilities.length,
                          }
                        : null,
                      selectedDay.closures.length > 0
                        ? {
                            key: "closures",
                            label: "Chiusure",
                            tone: "closure" as WeekBadgeTone,
                            count: selectedDay.closures.length,
                          }
                        : null,
                    ].filter((tab): tab is DaySectionTab => tab !== null)}
                    onPick={scrollToDaySection}
                  />
                ) : null}

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
                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      padding: "8px 0",
                    }}
                  >
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

                {/* Three doors used to open three different days: the shifts
                    hid the notes, the notes hid the shifts, and ferie, corsi,
                    indisponibilita and chiusure had no section at all - you
                    could tap their dot and find nothing. Every section is
                    drawn now, in the same order, from whichever door. */}
                {modalContentReady && features.shifts ? (
                  <div data-day-section="shifts" style={{ display: "grid", gap: 12 }}>
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
                            Parlane con chi fa i turni.
                          </span>
                        </span>
                      </div>
                    ) : null}

                    {renderDaySectionHeader(
                      "Turni",
                      selectedDay.shifts.length,
                      "Aggiungi turno",
                      () => {
                        setShowShiftComposer(true);
                        if (!currentShiftDraft) {
                          setCurrentShiftDraft(createShiftDraft(selectedDay.date));
                        }
                      },
                      isPending,
                      canManageOptionalShifts,
                      "onCall"
                    )}

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
                      >
                        <section
                          className="dashboard-modal-panel"
                          style={{
                            position: "relative",
                            display: "grid",
                            // A grid with a capped height squeezes its rows to fit
                            // instead of letting them overflow, so the panel was
                            // compressing the list of saved shifts, which then cut
                            // its own cards in half. Rows keep their height and the
                            // panel scrolls, which is what a scroll box is for.
                            alignContent: "start",
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
                        {/* No title bar of its own: the screen below already
                            says which step it is and carries the one way out. */}
                        {savedShiftDrafts.length > 0 ? (
                          <div
                            style={{
                              display: "grid",
                              gap: 8,
                              padding: 10,
                              borderRadius: 18,
                              background: "rgba(248,250,252,0.92)",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            <span style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>
                              Salvati ora · {savedShiftDrafts.length}
                              {savedDraftsPeopleVary ? "" : ` · ${savedDraftsPeopleLabel}`}
                            </span>
                            {/* The list, and only the list, scrolls - the
                                heading stays put above it. Two things were
                                wrong here. The box was a grid with a fixed
                                height, and a grid with a height that small
                                squeezes its rows to fit instead of
                                overflowing, so every card was sliced across
                                the middle. And its one column was free to
                                size itself to the longest name, which pushed
                                the cards out past the right edge where the box
                                clipped them - which is why a name stopped dead
                                with no "..." after it. */}
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "minmax(0, 1fr)",
                                alignContent: "start",
                                gap: 8,
                                maxHeight: "min(192px, 26dvh)",
                                overflowY: "auto",
                                overflowX: "hidden",
                              }}
                            >
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
                                  <div style={{ display: "grid", gap: 2, minWidth: 0, flex: 1 }}>
                                    <span style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
                                      <strong
                                        style={{
                                          minWidth: 0,
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                          color: "#0f172a",
                                          fontSize: 13.5,
                                          letterSpacing: "-0.015em",
                                        }}
                                      >
                                        {formatCompactDayLabel(draft.date, locale)}
                                      </strong>
                                      <span
                                        style={{
                                          marginLeft: "auto",
                                          flex: "0 0 auto",
                                          fontSize: 12.5,
                                          fontWeight: 700,
                                          color: "#3a3850",
                                          fontVariantNumeric: "tabular-nums",
                                        }}
                                      >
                                        {draft.startTime}–{draft.endTime}
                                      </span>
                                    </span>
                                    {savedDraftsPeopleVary || draft.isOnCall ? (
                                    <span
                                      style={{
                                        minWidth: 0,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        color: "#64748b",
                                        fontSize: 12,
                                      }}
                                    >
                                      {savedDraftsPeopleVary ? draftMemberNames : ""}
                                      {savedDraftsPeopleVary && draft.isOnCall ? " · " : ""}
                                      {draft.isOnCall ? "Reperibilità" : ""}
                                    </span>
                                  ) : null}
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
                        {selectedDay.shifts.map((shift) => renderShiftSwipeActions(shift, (
                          renderDayShiftRow(shift, locale, sharedFirstNames, currentUserId, dayOverlaps.clashing.has(shift.id))
                        ), selectedDay.date, true))}
                      </div>
                    )}
                  </div>
                ) : null}

                {modalContentReady && (selectedDay?.pendingOnCallShifts ?? []).filter(
                  (shift) => shift.assignments.some((assignment) => assignment.id === currentUserId)
                ).length > 0 ? (
                  <div data-day-section="oncall" style={{ display: "grid", gap: 12 }}>
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
                            {renderPendingOnCallCard(shift, locale, sharedFirstNames, true)}

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

                {modalContentReady && (features.tasks || features.noticeBoard) ? (
                  <div data-day-section="notes" style={{ display: "grid", gap: 10 }}>
                    {/* The date is already in the title of the sheet, and the
                        count no longer needs a black pill of its own. */}
                    {renderDaySectionHeader(
                      "Note",
                      selectedDay.tasks.length + selectedDay.notes.length,
                      "Aggiungi note",
                      () => setQuickComposer("task"),
                      isPending,
                      canOpenTaskComposer,
                      "note"
                    )}
                    {selectedDay.tasks.length === 0 && selectedDay.notes.length === 0 ? (
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: "#c2bfd4" }}>
                        Nessuna nota in questa giornata.
                      </div>
                    ) : (
                      <div className="dashboard-scroll-list" style={{ display: "grid", gap: 10 }}>
                        {selectedDay.tasks.map((task) =>
                          renderDeleteSwipeCard(
                            `task-${task.id}`,
                            renderTaskCard(task, true, submitTaskCompletion, isPending),
                            "Elimina nota",
                            () => handleDeleteTask(task.id),
                            true
                          )
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
                            {renderDeleteSwipeCard(
                              `note-${note.id}`,
                              renderNoteCard(note, locale, currentUserId, true),
                              "Elimina nota",
                              () => handleDeleteBoardNote(note.id),
                              true
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
                {/* Adding belongs to turni and note; these four are here to
                    be read, and only when there is something to read. An empty
                    section with a + on it offered a way in to something this
                    sheet does not do. */}
                {modalContentReady && features.requests && selectedDay.requests.length > 0 ? (
                  <div data-day-section="requests" style={{ display: "grid", gap: 10 }}>
                    {renderDaySectionHeader(
                      "Ferie e permessi",
                      selectedDay.requests.length,
                      "Ferie e permessi",
                      () => undefined,
                      isPending,
                      false,
                      "vacation"
                    )}
                    {selectedDay.requests.length === 0 ? (
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: "#c2bfd4" }}>
                        Nessuna richiesta in questa giornata.
                      </div>
                    ) : (
                      <div className="dashboard-scroll-list" style={{ display: "grid", gap: 6 }}>
                        {selectedDay.requests.map((request) =>
                          renderDaySheetRow(
                            `day-request-row-${request.id}`,
                            `${request.firstName} ${request.lastName}`,
                            formatRequestTypeLabel(request.type),
                            "vacation"
                          )
                        )}
                      </div>
                    )}
                  </div>
                ) : null}

                {modalContentReady && features.courses && selectedDay.courses.length > 0 ? (
                  <div data-day-section="courses" style={{ display: "grid", gap: 10 }}>
                    {renderDaySectionHeader(
                      "Corsi",
                      selectedDay.courses.length,
                      "Corsi",
                      () => undefined,
                      isPending,
                      false,
                      "course"
                    )}
                    {selectedDay.courses.length === 0 ? (
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: "#c2bfd4" }}>
                        Nessun corso in questa giornata.
                      </div>
                    ) : (
                      <div className="dashboard-scroll-list" style={{ display: "grid", gap: 6 }}>
                        {selectedDay.courses.map((course) =>
                          renderDaySheetRow(
                            `day-course-${course.id}`,
                            course.title,
                            formatRange(course.startTime, course.endTime, locale),
                            "course"
                          )
                        )}
                      </div>
                    )}
                  </div>
                ) : null}

                {modalContentReady && features.availability && selectedDay.availabilities.length > 0 ? (
                  <div data-day-section="availability" style={{ display: "grid", gap: 10 }}>
                    {renderDaySectionHeader(
                      "Indisponibilità",
                      selectedDay.availabilities.length,
                      "Indisponibilità",
                      () => undefined,
                      isPending,
                      false,
                      "availability"
                    )}
                    {selectedDay.availabilities.length === 0 ? (
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: "#c2bfd4" }}>
                        Nessuna indisponibilità in questa giornata.
                      </div>
                    ) : (
                      <div className="dashboard-scroll-list" style={{ display: "grid", gap: 6 }}>
                        {selectedDay.availabilities.map((availability) =>
                          renderDaySheetRow(
                            `day-availability-row-${availability.id}`,
                            `${availability.firstName} ${availability.lastName}`,
                            formatRange(availability.startsAt, availability.endsAt, locale),
                            "availability"
                          )
                        )}
                      </div>
                    )}
                  </div>
                ) : null}

                {modalContentReady && selectedDay.closures.length > 0 ? (
                  <div data-day-section="closures" style={{ display: "grid", gap: 10 }}>
                    {renderDaySectionHeader(
                      "Chiusure",
                      selectedDay.closures.length,
                      "Chiusure",
                      () => undefined,
                      isPending,
                      false,
                      "closure"
                    )}
                    {selectedDay.closures.length === 0 ? (
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: "#c2bfd4" }}>
                        Il locale è aperto in questa giornata.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 6 }}>
                        {selectedDay.closures.map((closure) =>
                          renderDaySheetRow(
                            `day-closure-${closure.id}`,
                            closure.title,
                            formatRange(closure.startTime, closure.endTime, locale),
                            "closure"
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
        onDeleted={(shiftId) => {
          setSavedShiftDrafts((current) => current.filter((draft) => draft.shiftId !== shiftId));
        }}
        onUpdated={(shiftId) => {
          setSavedShiftDrafts((current) => current.filter((draft) => draft.shiftId !== shiftId));
        }}
        onClose={closeModal}
      />
    </>
  );
}
