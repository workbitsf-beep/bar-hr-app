"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import type { ClockType, Role } from "@prisma/client";
import { ConfirmationToast } from "@/app/components/confirmation-toast";
import { SuccessPulse } from "@/app/components/workbit-animations";
import {
  DEFAULT_GEOLOCATION_MAXIMUM_AGE_MS,
  getBestAccuracyPosition,
  startPreciseGeolocationWatch,
} from "@/lib/browser-gps";
import type { GeolocationSample } from "@/lib/browser-gps";
import { calculateDistance } from "@/lib/gps";
import { isNativeApp } from "@/lib/native-app";
import { APP_TIME_ZONE, getZonedDateParts } from "@/lib/time-zone";
import {
  EmptyState,
  Panel,
  PrimaryButton,
  Stack,
  formatDateTime,
} from "../ui";
import { deleteTimeLogPairAction } from "../actions";
import { useOverlayLock } from "../use-overlay-lock";
import { formatDurationClock, formatDurationFromMilliseconds } from "@/lib/time-format";
import { calculateRoundedWorkDuration } from "@/lib/rounding";

type LogItem = {
  id: string;
  type: ClockType;
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  isManual: boolean;
  note: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

type ClockLogPair = {
  id: string;
  clockIn: LogItem | null;
  clockOut: LogItem | null;
  startTimestamp: string;
  latestTimestamp: string;
};

type BarSettingsSummary = {
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsRadius: number | null;
  roundingEnabled: boolean;
  roundingMinutes: number | null;
  roundingMode: string | null;
} | null;

type Totals = {
  realHours: number;
  roundedHours: number;
} | null;

export type ClockActionStatus = "CAN_CLOCK_IN" | "CAN_CLOCK_OUT" | "DONE";

const CLOCK_LOCATION_CACHE_KEY = "workbit.clock.location";
const CLOCK_LOCATION_CACHE_MAX_AGE_MS = 2 * 60 * 1000;

type CachedClockLocation = GeolocationSample & {
  capturedAt: number;
  barLatitude: number;
  barLongitude: number;
  barRadius: number;
};

function hasConfiguredGps(settings: BarSettingsSummary): settings is NonNullable<BarSettingsSummary> & {
  gpsLatitude: number;
  gpsLongitude: number;
  gpsRadius: number;
} {
  return (
    settings !== null &&
    settings.gpsLatitude !== null &&
    settings.gpsLongitude !== null &&
    settings.gpsRadius !== null
  );
}

function readCachedClockLocation(settings: BarSettingsSummary): GeolocationSample | null {
  if (!hasConfiguredGps(settings) || typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(CLOCK_LOCATION_CACHE_KEY);

    if (!rawValue) {
      return null;
    }

    const cached = JSON.parse(rawValue) as Partial<CachedClockLocation>;
    const isSameGpsPoint =
      cached.barLatitude === settings.gpsLatitude &&
      cached.barLongitude === settings.gpsLongitude &&
      cached.barRadius === settings.gpsRadius;
    const isFresh =
      typeof cached.capturedAt === "number" &&
      Date.now() - cached.capturedAt <= CLOCK_LOCATION_CACHE_MAX_AGE_MS;
    const cachedLatitude = cached.latitude;
    const cachedLongitude = cached.longitude;
    const cachedAccuracy = cached.accuracy;
    const hasUsableCoordinates =
      typeof cachedLatitude === "number" &&
      typeof cachedLongitude === "number" &&
      typeof cachedAccuracy === "number" &&
      Number.isFinite(cachedLatitude) &&
      Number.isFinite(cachedLongitude) &&
      Number.isFinite(cachedAccuracy);

    if (!isSameGpsPoint || !isFresh || !hasUsableCoordinates) {
      return null;
    }

    return {
      latitude: cachedLatitude,
      longitude: cachedLongitude,
      accuracy: cachedAccuracy,
      sampleCount: typeof cached.sampleCount === "number" ? cached.sampleCount : 1,
    };
  } catch {
    return null;
  }
}

function writeCachedClockLocation(settings: BarSettingsSummary, sample: GeolocationSample) {
  if (!hasConfiguredGps(settings) || typeof window === "undefined") {
    return;
  }

  const cached: CachedClockLocation = {
    ...sample,
    capturedAt: Date.now(),
    barLatitude: settings.gpsLatitude,
    barLongitude: settings.gpsLongitude,
    barRadius: settings.gpsRadius,
  };

  try {
    window.localStorage.setItem(CLOCK_LOCATION_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Local storage can be unavailable in private or restricted browsing modes.
  }
}

/**
 * How much of a reading's own error we are willing to forgive.
 *
 * Capped, so a deliberately vague fix cannot be used to stamp from down the
 * road: past this, being far away is far away.
 */
const MAX_ACCURACY_ALLOWANCE_METERS = 50;

async function getGeolocationPermissionState(): Promise<PermissionState | "unsupported"> {
  if (typeof navigator === "undefined" || !("permissions" in navigator)) {
    return "unsupported";
  }

  try {
    const status = await navigator.permissions.query({
      name: "geolocation" as PermissionName,
    });

    return status.state;
  } catch {
    return "unsupported";
  }
}

function getDayKey(value: string | Date) {
  const parts = getZonedDateParts(value, APP_TIME_ZONE);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getMonthKey(value: string | Date) {
  const parts = getZonedDateParts(value, APP_TIME_ZONE);
  return `${parts.year}-${parts.month}`;
}

function getCurrentMonthKey() {
  return getMonthKey(new Date());
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(Date.UTC(year, month - 1, 1, 12)));
}

function formatDayLabel(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
}

function formatClockTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
}

function getClockTypeVisual(type: ClockType) {
  if (type === "IN") {
    return {
      arrow: "↑",
      background: "rgba(220, 252, 231, 0.95)",
      border: "#bbf7d0",
      color: "#166534",
      timeColor: "#14532d",
    };
  }

  return {
    arrow: "↓",
    background: "rgba(254, 226, 226, 0.95)",
    border: "#fecaca",
    color: "#b91c1c",
    timeColor: "#991b1b",
  };
}

function ClockLogRow({ log, muted = false }: { log: LogItem; muted?: boolean }) {
  const base = getClockTypeVisual(log.type);
  // A stamp that lasted no time keeps its arrow but loses its colour: green
  // and red mean "this happened", and this one probably did not.
  const visual = muted
    ? { ...base, background: "#fffbeb", border: "#fde68a", color: "#92400e", timeColor: "#92400e" }
    : base;

  return (
    <div
      className={`workbit-timelog-entry workbit-timelog-entry--${log.type.toLowerCase()}`}
      style={{
        display: "grid",
        gap: 0,
        padding: "11px 13px",
        borderRadius: 13,
        background: visual.background,
        border: `1px solid ${visual.border}`,
        width: "100%",
        boxSizing: "border-box",
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
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: 0,
            background: "transparent",
            border: 0,
            color: visual.color,
            fontSize: 16,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>
            {visual.arrow}
          </span>
        </span>

        <strong style={{ color: visual.timeColor, fontSize: 18, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
          {formatClockTime(log.timestamp)}
        </strong>
      </div>
    </div>
  );
}

function buildClockLogPairs(logs: LogItem[]): ClockLogPair[] {
  const sortedLogs = [...logs].sort(
    (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
  );
  const pairs: ClockLogPair[] = [];
  let pendingIn: LogItem | null = null;

  for (const log of sortedLogs) {
    if (log.type === "IN") {
      if (pendingIn) {
        pairs.push({
          id: pendingIn.id,
          clockIn: pendingIn,
          clockOut: null,
          startTimestamp: pendingIn.timestamp,
          latestTimestamp: pendingIn.timestamp,
        });
      }

      pendingIn = log;
      continue;
    }

    if (pendingIn) {
      pairs.push({
        id: `${pendingIn.id}-${log.id}`,
        clockIn: pendingIn,
        clockOut: log,
        startTimestamp: pendingIn.timestamp,
        latestTimestamp: log.timestamp,
      });
      pendingIn = null;
      continue;
    }

    pairs.push({
      id: log.id,
      clockIn: null,
      clockOut: log,
      startTimestamp: log.timestamp,
      latestTimestamp: log.timestamp,
    });
  }

  if (pendingIn) {
    pairs.push({
      id: pendingIn.id,
      clockIn: pendingIn,
      clockOut: null,
      startTimestamp: pendingIn.timestamp,
      latestTimestamp: pendingIn.timestamp,
    });
  }

  return pairs;
}

function getClockPairDurationMs(pair: ClockLogPair) {
  const clockIn = pair.clockIn;
  const clockOut = pair.clockOut;

  if (!clockIn || !clockOut) {
    return null;
  }

  const duration = new Date(clockOut.timestamp).getTime() - new Date(clockIn.timestamp).getTime();
  return duration > 0 ? duration : null;
}

function getDayWorkedDurationMs(pairs: ClockLogPair[]) {
  return pairs.reduce((total, pair) => total + (getClockPairDurationMs(pair) ?? 0), 0);
}

function getMonthWorkSummary(logs: LogItem[], monthKey: string, settings: BarSettingsSummary) {
  return buildClockLogPairs(logs).reduce(
    (summary, pair) => {
      if (getMonthKey(pair.startTimestamp) !== monthKey || !pair.clockIn || !pair.clockOut) {
        return summary;
      }

      const rounded = calculateRoundedWorkDuration(
        new Date(pair.clockIn.timestamp),
        new Date(pair.clockOut.timestamp),
        settings
      );

      return {
        realMs: summary.realMs + rounded.realMs,
        roundedMs: summary.roundedMs + rounded.roundedMs,
      };
    },
    { realMs: 0, roundedMs: 0 }
  );
}

function formatPairCount(pairs: ClockLogPair[]) {
  const count = pairs.length;
  return `${count} ${count === 1 ? "turno" : "turni"}`;
}

function formatShiftCount(logs: LogItem[]) {
  return formatPairCount(buildClockLogPairs(logs));
}

function getTodayKey() {
  return getDayKey(new Date());
}

function groupLogsByDay(logs: LogItem[]) {
  const groups = new Map<
    string,
    {
      dayKey: string;
      dayLabel: string;
      latest: string;
      pairs: ClockLogPair[];
    }
  >();

  for (const pair of buildClockLogPairs(logs)) {
    const dayKey = getDayKey(pair.startTimestamp);
    const current = groups.get(dayKey);

    if (!current) {
      groups.set(dayKey, {
        dayKey,
        dayLabel: formatDayLabel(pair.startTimestamp),
        latest: pair.latestTimestamp,
        pairs: [pair],
      });
      continue;
    }

    current.pairs.push(pair);
    if (new Date(pair.latestTimestamp).getTime() > new Date(current.latest).getTime()) {
      current.latest = pair.latestTimestamp;
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      pairs: group.pairs.sort(
        (a, b) => new Date(a.startTimestamp).getTime() - new Date(b.startTimestamp).getTime()
      ),
    }))
    .sort((a, b) => new Date(b.latest).getTime() - new Date(a.latest).getTime());
}

/**
 * Under a minute between clocking in and out. Nobody works forty seconds: it
 * is a double tap, and until now it looked exactly like a real shift.
 */
const MISSTAMP_THRESHOLD_MS = 60_000;

function isMisstampedPair(pair: ClockLogPair) {
  if (!pair.clockIn || !pair.clockOut) {
    return false;
  }

  const duration = getClockPairDurationMs(pair);

  return duration === null || duration < MISSTAMP_THRESHOLD_MS;
}

function formatShiftDuration(durationMs: number) {
  const minutes = Math.floor(durationMs / 60_000);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

/**
 * One shift, as one object.
 *
 * The green and the red are the same two cards as before - they read from
 * across the room, which is the point of them. What is new is underneath: how
 * long it lasted, so nobody does the subtraction in their head four times a
 * day, and a plain question when it lasted no time at all.
 */
function ShiftBox({
  pair,
  position,
  total,
  onCancel,
  pending = false,
}: {
  pair: ClockLogPair;
  position: number;
  /** How many shifts the day has: with one, "1º turno" says nothing. */
  total: number;
  onCancel?: (pair: ClockLogPair) => void;
  pending?: boolean;
}) {
  const durationMs = getClockPairDurationMs(pair);
  const misstamp = isMisstampedPair(pair);
  const stamps = [pair.clockIn, pair.clockOut].filter(Boolean) as LogItem[];

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        padding: 10,
        borderRadius: 18,
        border: `1px solid ${misstamp ? "#fde68a" : "#e9edf3"}`,
        background: misstamp ? "#fffbeb" : "#ffffff",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.max(1, stamps.length)}, minmax(0, 1fr))`,
          gap: 8,
        }}
      >
        {stamps.map((log) => (
          <ClockLogRow key={log.id} log={log} muted={misstamp} />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "0 3px",
        }}
      >
        <span
          style={{
            fontSize: 12.5,
            fontWeight: misstamp ? 830 : 780,
            color: misstamp ? "#92400e" : "#64748b",
          }}
        >
          {misstamp
            ? "Timbratura per sbaglio?"
            : !pair.clockOut
              ? "In corso"
              : total > 1
                ? `${position}º turno`
                : ""}
        </span>

        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {misstamp && onCancel ? (
            <button
              type="button"
              onClick={() => onCancel(pair)}
              disabled={pending}
              style={{
                padding: "5px 11px",
                borderRadius: 999,
                background: "#ffffff",
                border: "1px solid #fde68a",
                color: "#92400e",
                fontSize: 11.5,
                fontWeight: 850,
                cursor: pending ? "default" : "pointer",
              }}
            >
              Annulla
            </button>
          ) : null}
          <strong
            style={{
              fontSize: 14,
              fontVariantNumeric: "tabular-nums",
              color: misstamp ? "#92400e" : "#0f172a",
            }}
          >
            {pair.clockOut ? formatShiftDuration(durationMs ?? 0) : "—"}
          </strong>
        </span>
      </div>
    </div>
  );
}

type TeamPerson = {
  id: string;
  name: string;
  latest: string;
  shiftCount: number;
  monthMs: number;
  since: string | null;
};

function groupLabelStyle(color: string) {
  return {
    marginTop: 3,
    fontSize: 11.5,
    fontWeight: 820,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color,
  } as const;
}

/** How long they have been in, counted live rather than at page load. */
function ElapsedSince({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);

    return () => window.clearInterval(id);
  }, []);

  const elapsed = Math.max(0, now - new Date(since).getTime());

  return <>{formatDurationFromMilliseconds(elapsed)}</>;
}

function PersonRow({
  person,
  live = false,
  onOpen,
}: {
  person: TeamPerson;
  live?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: "grid",
        gridTemplateColumns: "36px minmax(0, 1fr) auto",
        alignItems: "center",
        gap: 11,
        width: "100%",
        padding: "11px 12px",
        borderRadius: 16,
        border: `1px solid ${live ? "#bbf7d0" : "#e9edf3"}`,
        background: live ? "#f4fdf6" : "#ffffff",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          display: "inline-grid",
          placeItems: "center",
          borderRadius: 999,
          background: live ? "#dcfce7" : "#f3e8ff",
          color: live ? "#15803d" : "#4c1d95",
          fontSize: 12.5,
          fontWeight: 850,
        }}
      >
        {initialsOfName(person.name)}
      </span>

      <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
        <strong style={{ fontSize: 14.5, color: "#0f172a", letterSpacing: "-0.015em" }}>
          {person.name}
        </strong>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: live ? "#15803d" : "#64748b",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {person.since
            ? `dalle ${formatClockTime(person.since)}`
            : `ultima ${formatDateTime(person.latest)}`}
        </span>
      </span>

      <span style={{ display: "grid", gap: 0, justifyItems: "end", flex: "0 0 auto" }}>
        <strong
          style={{
            fontSize: 14,
            fontWeight: 830,
            fontVariantNumeric: "tabular-nums",
            color: live ? "#15803d" : "#0f172a",
          }}
        >
          {person.since ? <ElapsedSince since={person.since} /> : formatDurationFromMilliseconds(person.monthMs)}
        </strong>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#94a3b8",
          }}
        >
          {person.since ? "in corso" : "mese"}
        </span>
      </span>
    </button>
  );
}

function initialsOfName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function shiftMonthKey(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);

  return getMonthKey(new Date(Date.UTC(year, month - 1 + delta, 1, 12)));
}

const monthArrowStyle = {
  display: "inline-grid",
  placeItems: "center",
  height: 30,
  borderRadius: 10,
  background: "#ffffff",
  border: "1px solid #e9edf3",
  color: "#64748b",
  fontSize: 16,
  fontWeight: 800,
  cursor: "pointer",
} as const;

const footerActionStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  width: "100%",
  padding: "12px 13px",
  borderRadius: 15,
  border: "1px dashed #cbd5e1",
  background: "transparent",
  color: "#64748b",
  fontSize: 13.5,
  fontWeight: 800,
  textAlign: "left",
  cursor: "pointer",
} as const;

/** One figure of the month, with the word that says which figure it is. */
function SheetTotal({ label, value, lead = false }: { label: string; value: string; lead?: boolean }) {
  return (
    <span
      style={{
        display: "grid",
        gap: 1,
        padding: "10px 12px",
        borderRadius: 15,
        background: lead ? "#f3e8ff" : "#f8fafc",
        border: `1px solid ${lead ? "rgba(124, 58, 237, 0.42)" : "#e9edf3"}`,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 820,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: lead ? "#8b5cf6" : "#94a3b8",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 19,
          fontWeight: 830,
          letterSpacing: "-0.03em",
          fontVariantNumeric: "tabular-nums",
          color: lead ? "#4c1d95" : "#0f172a",
        }}
      >
        {value}
      </span>
    </span>
  );
}

export function ClockActionsPanel({
  role,
  settings,
  compact = false,
  clockStatus = "CAN_CLOCK_IN",
  hasScheduledShiftToday = false,
  activeClockInAt = null,
  shiftLabel = null,
}: {
  role: Role | string;
  settings: BarSettingsSummary;
  compact?: boolean;
  clockStatus?: ClockActionStatus;
  hasScheduledShiftToday?: boolean;
  /** When set, the bar counts up from here instead of naming the shift. */
  activeClockInAt?: string | null;
  shiftLabel?: string | null;
}) {
  const router = useRouter();
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [distance, setDistance] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [geoReady, setGeoReady] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [confirmationKey, setConfirmationKey] = useState(0);
  const [successPulse, setSuccessPulse] = useState<"in" | "out" | null>(null);
  const [successPulseKey, setSuccessPulseKey] = useState(0);
  const [temporaryWarning, setTemporaryWarning] = useState("");
  const [temporaryWarningKey, setTemporaryWarningKey] = useState(0);
  const [submitting, setSubmitting] = useState<"in" | "out" | null>(null);
  const [locating, setLocating] = useState(false);
  const [weakAccuracy, setWeakAccuracy] = useState<number | null>(null);
  const stopWatchRef = useRef<(() => void) | null>(null);

  // Ticks only while someone is actually clocked in, so the bar can say how
  // long they have been in rather than repeating the shift they are on.
  const [elapsedLabel, setElapsedLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!activeClockInAt) {
      setElapsedLabel(null);
      return;
    }

    const startedAt = new Date(activeClockInAt).getTime();

    function tick() {
      const minutes = Math.max(0, Math.floor((Date.now() - startedAt) / 60000));
      setElapsedLabel(
        `dentro da ${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
      );
    }

    tick();
    const id = window.setInterval(tick, 30_000);

    return () => window.clearInterval(id);
  }, [activeClockInAt]);

  const gpsConfigured = hasConfiguredGps(settings);
  const canClock = role !== "OWNER";

  // A reading carries an error of its own, often tens of metres indoors, so a
  // distance of exactly the radius means nothing: standing still, the point
  // drifts in and out and the button flickered with it. The reading's own
  // margin is allowed for, capped so a deliberately vague fix cannot be used
  // to stamp from down the road.
  const accuracyAllowance = Math.min(accuracy ?? 0, MAX_ACCURACY_ALLOWANCE_METERS);
  const insideRadius =
    gpsConfigured &&
    latitude !== "" &&
    longitude !== "" &&
    distance !== null &&
    distance <= (settings?.gpsRadius ?? 0) + accuracyAllowance;
  const canClockIn =
    insideRadius &&
    geoReady &&
    hasScheduledShiftToday &&
    clockStatus !== "CAN_CLOCK_OUT";
  const canClockOut = insideRadius && geoReady && clockStatus === "CAN_CLOCK_OUT";

  const locationSummary = useMemo(() => {
    if (!gpsConfigured) {
      return "Il punto del locale non e ancora impostato dal titolare.";
    }

    if (locating && !geoReady) {
      return "Posizione in aggiornamento...";
    }

    if (locationError) {
      return "Posizione non aggiornata.";
    }

    if (weakAccuracy !== null) {
      return "Posizione poco precisa. Avvicinati al punto impostato dal titolare e riprova.";
    }

    if (distance === null || accuracy === null) {
      return "Posizione non aggiornata.";
    }

    if (!insideRadius) {
      return "Avvicinati di più al punto impostato dal titolare.";
    }

    return "Posizione aggiornata.";
  }, [
    accuracy,
    distance,
    geoReady,
    gpsConfigured,
    insideRadius,
    locating,
    locationError,
    weakAccuracy,
  ]);

  const stopGeolocationWatch = useCallback(() => {
    stopWatchRef.current?.();
    stopWatchRef.current = null;
  }, []);

  const applyGeolocationSample = useCallback((sample: GeolocationSample, persist = true) => {
    if (!hasConfiguredGps(settings)) {
      return;
    }

    const nextDistance = calculateDistance(
      sample.latitude,
      sample.longitude,
      settings.gpsLatitude,
      settings.gpsLongitude
    );

    setLatitude(String(sample.latitude));
    setLongitude(String(sample.longitude));
    setAccuracy(sample.accuracy);
    setDistance(nextDistance);
    setGeoReady(true);
    setWeakAccuracy(null);
    setLocationError("");
    setLocating(false);

    if (persist) {
      writeCachedClockLocation(settings, sample);
    }
  }, [settings]);

  const startGeolocationWatch = useCallback((manual = false) => {
    if (
      !canClock ||
      !hasConfiguredGps(settings) ||
      typeof navigator === "undefined" ||
      !navigator.geolocation
    ) {
      return;
    }

    if (!manual && stopWatchRef.current) {
      return;
    }

    stopGeolocationWatch();
    setLocating(true);
    setLocationError("");
    setWeakAccuracy(null);

    if (manual) {
      setActionMessage("");
    }

    // Keep one browser watch open and publish the best point from each short
    // batch, avoiding repeated GPS restarts while the profile is open.
    stopWatchRef.current = startPreciseGeolocationWatch({
      onSample(sample) {
        applyGeolocationSample(sample);
      },
      onLowAccuracy(nextAccuracy) {
        setAccuracy(nextAccuracy);
        setWeakAccuracy(nextAccuracy);
        setLocationError("");
        setLocating(true);
      },
      onError() {
        setWeakAccuracy(null);
        setLocating(false);
        setLocationError(
          manual
            ? "Impossibile leggere la posizione attuale."
            : "Impossibile aggiornare automaticamente la posizione."
        );
      },
      maximumAgeMs: DEFAULT_GEOLOCATION_MAXIMUM_AGE_MS,
      stopAfterFirstSample: false,
    });
  }, [applyGeolocationSample, canClock, settings, stopGeolocationWatch]);

  useEffect(() => {
    if (!canClock || !gpsConfigured) {
      return;
    }

    let cancelled = false;
    const cachedSample = readCachedClockLocation(settings);

    if (cachedSample) {
      applyGeolocationSample(cachedSample, false);
    }

    async function startGrantedWatch() {
      const permissionState = await getGeolocationPermissionState();

      if (cancelled) {
        return;
      }

      if (permissionState === "denied") {
        setLocationError("Consenti la posizione dalle impostazioni del dispositivo.");
        return;
      }

      // Inside the installed app the browser permission registry does not
      // reflect what Android granted, so it answers "prompt" or nothing at all
      // even when the position is available. Waiting for "granted" there meant
      // the reading never started by itself and every stamp had to begin with
      // a manual refresh. Asking the device directly costs nothing: the
      // permission is already held, so no prompt appears.
      if (permissionState === "granted" || isNativeApp()) {
        startGeolocationWatch(false);
      }
    }

    void startGrantedWatch();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void startGrantedWatch();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopGeolocationWatch();
    };
  }, [
    applyGeolocationSample,
    canClock,
    gpsConfigured,
    settings,
    startGeolocationWatch,
    stopGeolocationWatch,
  ]);

  function showTemporaryWarning(message: string) {
    setTemporaryWarning(message);
    setTemporaryWarningKey((current) => current + 1);
  }

  async function getClockActionLocation() {
    if (!hasConfiguredGps(settings)) {
      setLocationError("Geolocalizzazione non disponibile.");
      return null;
    }

    const cachedSample = readCachedClockLocation(settings);

    if (cachedSample) {
      applyGeolocationSample(cachedSample, false);
      return cachedSample;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Geolocalizzazione non disponibile.");
      return null;
    }

    setLocating(true);
    setLocationError("");
    setWeakAccuracy(null);
    setActionMessage("Rilevo la posizione...");

    try {
      const sample = await getBestAccuracyPosition({
        maxWaitMs: 25000,
        onLowAccuracy(nextAccuracy) {
          setAccuracy(nextAccuracy);
          setWeakAccuracy(nextAccuracy);
          setLocationError("");
        },
      });

      applyGeolocationSample(sample);
      return sample;
    } catch {
      setWeakAccuracy(null);
      setLocating(false);
      setLocationError("Impossibile leggere la posizione attuale.");
      setActionMessage("Impossibile leggere la posizione attuale.");
      return null;
    }
  }

  async function runClockAction(endpoint: "clock-in" | "clock-out") {
    if (endpoint === "clock-in" && !hasScheduledShiftToday) {
      setActionMessage("Non hai un turno programmato per oggi.");
      return;
    }

    setSubmitting(endpoint === "clock-in" ? "in" : "out");
    setActionMessage("");

    try {
      const sample = await getClockActionLocation();

      if (!sample || !hasConfiguredGps(settings)) {
        return;
      }

      const nextDistance = calculateDistance(
        sample.latitude,
        sample.longitude,
        settings.gpsLatitude,
        settings.gpsLongitude
      );

      if (nextDistance > settings.gpsRadius) {
        setLocationError("");
        const message = "Non sei ancora nel tuo luogo di lavoro, avvicinati.";
        setActionMessage(message);
        showTemporaryWarning(message);
        return;
      }

      const response = await fetch(`/api/timelogs/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: sample.latitude,
          longitude: sample.longitude,
          accuracy: sample.accuracy,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; duration?: number }
        | null;

      if (!response.ok || payload?.ok === false) {
        const message =
          payload?.message === "Outside allowed radius"
            ? "Non sei ancora nel tuo luogo di lavoro, avvicinati."
            : payload?.message || "Operazione non riuscita";
        setActionMessage(message);
        if (payload?.message === "Outside allowed radius") {
          showTemporaryWarning(message);
        }
        return;
      }

      if (endpoint === "clock-out") {
        setSuccessPulse("out");
        setSuccessPulseKey((current) => current + 1);
        setActionMessage(
          typeof payload?.duration === "number"
            ? `Uscita registrata. Durata ${formatDurationFromMilliseconds(payload.duration)}.`
            : "Uscita registrata."
        );
        setConfirmationMessage("Per oggi hai finito");
        setConfirmationKey((current) => current + 1);
      } else {
        setSuccessPulse("in");
        setSuccessPulseKey((current) => current + 1);
        setActionMessage("Entrata registrata.");
        setConfirmationMessage("Buon lavoro");
        setConfirmationKey((current) => current + 1);
      }

      router.refresh();
    } catch {
      setActionMessage("Impossibile contattare il servizio timbrature.");
    } finally {
      setSubmitting(null);
    }
  }

  function captureGeolocation() {
    if (locating) {
      return;
    }

    if (!navigator.geolocation || !gpsConfigured) {
      setLocationError("Geolocalizzazione non disponibile.");
      return;
    }

    startGeolocationWatch(true);
  }

  if (!canClock) {
    return null;
  }

  if (compact) {
    const leaving = clockStatus === "CAN_CLOCK_OUT";
    const enabled = leaving ? canClockOut : canClockIn;
    const tone = !enabled ? "off" : leaving ? "out" : "in";
    const label = submitting
      ? "..."
      : leaving
        ? "Timbra uscita"
        : "Timbra entrata";
    const meta = leaving ? elapsedLabel : shiftLabel;

    return (
      <section className="wb-act" aria-label="Entrata e uscita">
        <button
          type="button"
          className={`wb-act-bar wb-act-bar--${tone}`}
          onClick={() => runClockAction(leaving ? "clock-out" : "clock-in")}
          disabled={submitting !== null || !enabled}
        >
          <SuccessPulse
            key={`${leaving ? "out" : "in"}-${successPulseKey}`}
            active={successPulse === (leaving ? "out" : "in")}
            tone={leaving ? "red" : "green"}
          />
          <i aria-hidden="true" />
          <span className="wb-act-text">
            <b>{label}</b>
            {meta ? <em>{meta}</em> : null}
          </span>
        </button>

        {/* The position only speaks up when it is in the way. */}
        {!enabled ? (
          <p className="wb-act-note">
            <span>{locationSummary}</span>
            <button type="button" onClick={captureGeolocation} disabled={locating}>
              {locating ? "..." : "Aggiorna"}
            </button>
          </p>
        ) : null}

        {/* The outcome passes through and goes: pinned under the bar it stayed
            there long after it stopped being news. */}
        {actionMessage && !confirmationMessage ? (
          <ConfirmationToast key={`esito-${actionMessage}`}>{actionMessage}</ConfirmationToast>
        ) : null}
        {confirmationMessage ? (
          <ConfirmationToast key={confirmationKey}>{confirmationMessage}</ConfirmationToast>
        ) : null}
        {temporaryWarning ? (
          <TemporaryWarningToast key={temporaryWarningKey}>{temporaryWarning}</TemporaryWarningToast>
        ) : null}
      </section>
    );
  }

  return (
    <Panel
      title={compact ? "Timbratura veloce" : "Entrata / uscita"}
      action={gpsConfigured ? "Pronta" : "Da impostare"}
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div
          style={{
            background: "#ffffff",
            border: "1px solid rgba(60, 60, 67, 0.12)",
            borderRadius: 18,
            padding: "12px 14px",
            color: "#8E8E93",
            lineHeight: 1.45,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 180px", minWidth: 0 }}>{locationSummary}</div>
          <button
            type="button"
            onClick={captureGeolocation}
            disabled={locating || !gpsConfigured}
            aria-label="Aggiorna posizione"
            title={locating ? "Aggiornamento posizione..." : "Aggiorna posizione"}
            style={{
              width: 62,
              height: 62,
              minWidth: 62,
              padding: 0,
              borderRadius: 0,
              fontSize: locating ? 30 : 38,
              lineHeight: 1,
              flex: "0 0 auto",
              background: "transparent",
              border: "none",
              boxShadow: "none",
              color: "#3D2A99",
              cursor: locating || !gpsConfigured ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: locating || !gpsConfigured ? 0.5 : 1,
              WebkitAppearance: "none",
              appearance: "none",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "1em",
                height: "1em",
                lineHeight: 1,
              }}
            >
              {locating ? "…" : "🔄"}
            </span>
          </button>
          {settings?.roundingEnabled && settings.roundingMinutes ? (
            <div style={{ flex: "1 1 100%", fontSize: 13, color: "#64748b" }}>
              Arrotondamento ore attivo.
            </div>
          ) : null}
        </div>

        <div className="dashboard-clock-actions" style={{ display: "grid", gap: 12 }}>
        <div
          className="dashboard-clock-actions-row"
          style={{ display: "flex", gap: 10, alignItems: "stretch" }}
        >
          <PrimaryButton
            className="dashboard-clock-button"
            type="button"
            tone="green"
            onClick={() => runClockAction("clock-in")}
            disabled={submitting !== null || !canClockIn}
            aria-label={submitting === "in" ? "Registrazione entrata" : "Registra entrata"}
            title={submitting === "in" ? "Registrazione entrata" : "Registra entrata"}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 66,
              fontSize: 18,
              letterSpacing: "0.08em",
              color: "#ffffff",
              background: "linear-gradient(135deg, #16a34a 0%, #22c55e 58%, #4ade80 100%)",
              border: "1px solid rgba(34, 197, 94, 0.72)",
              boxShadow: "0 14px 28px rgba(22, 163, 74, 0.24)",
            }}
          >
            <SuccessPulse key={`in-${successPulseKey}`} active={successPulse === "in"} tone="green" />
            {submitting === "in" ? "..." : "ENTRA"}
          </PrimaryButton>
          <PrimaryButton
            className="dashboard-clock-button"
            type="button"
            tone="red"
            onClick={() => runClockAction("clock-out")}
            disabled={submitting !== null || !canClockOut}
            aria-label={submitting === "out" ? "Registrazione uscita" : "Registra uscita"}
            title={submitting === "out" ? "Registrazione uscita" : "Registra uscita"}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 66,
              fontSize: 18,
              letterSpacing: "0.08em",
              color: "#ffffff",
              background: "linear-gradient(135deg, #dc2626 0%, #ef4444 58%, #fb7185 100%)",
              border: "1px solid rgba(239, 68, 68, 0.72)",
              boxShadow: "0 14px 28px rgba(220, 38, 38, 0.24)",
            }}
          >
            <SuccessPulse key={`out-${successPulseKey}`} active={successPulse === "out"} tone="red" />
            {submitting === "out" ? "..." : "ESCI"}
          </PrimaryButton>
        </div>
        </div>

        {actionMessage ? (
          <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>{actionMessage}</p>
        ) : null}

        {confirmationMessage ? (
          <ConfirmationToast key={confirmationKey}>{confirmationMessage}</ConfirmationToast>
        ) : null}

        {temporaryWarning ? (
          <TemporaryWarningToast key={temporaryWarningKey}>{temporaryWarning}</TemporaryWarningToast>
        ) : null}

        {compact && !gpsConfigured ? (
          <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
            Configura il GPS del locale per abilitare la timbratura.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

function TemporaryWarningToast({
  children,
  duration = 2400,
}: {
  children: ReactNode;
  duration?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(false), duration);
    return () => window.clearTimeout(timeout);
  }, [duration]);

  if (!mounted || !visible) {
    return null;
  }

  return createPortal(
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        display: "grid",
        placeItems: "center",
        padding: 24,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: "min(88vw, 360px)",
          borderRadius: 28,
          border: "1px solid rgba(251, 146, 60, 0.28)",
          background: "rgba(255, 251, 235, 0.96)",
          boxShadow: "0 28px 70px rgba(124, 45, 18, 0.22)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          padding: "22px 20px",
          textAlign: "center",
          animation: "workbit-warning-pop 170ms ease-out",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 54,
            height: 54,
            margin: "0 auto 12px",
            borderRadius: 22,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#ffedd5",
            color: "#c2410c",
            fontSize: 28,
            fontWeight: 900,
          }}
        >
          !
        </span>
        <strong
          style={{
            display: "block",
            color: "#7c2d12",
            fontSize: 18,
            lineHeight: 1.25,
            fontWeight: 900,
          }}
        >
          {children}
        </strong>
      </div>
      <style jsx>{`
        @keyframes workbit-warning-pop {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>,
    document.body
  );
}

function OwnerTimeLogsPanel({
  initialLogs,
  settings,
  manualEntry,
}: {
  initialLogs: LogItem[];
  settings: BarSettingsSummary;
  manualEntry?: ReactNode;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [sheetMonth, setSheetMonth] = useState(getCurrentMonthKey());
  const [onlyToFix, setOnlyToFix] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  useOverlayLock(Boolean(selectedUser));

  useEffect(() => {
    setMounted(true);
  }, []);

  const groupedLogs = useMemo(() => {
    const groups = new Map<
      string,
      { id: string; name: string; logs: LogItem[]; latest: string }
    >();

    for (const log of initialLogs) {
      const groupKey = log.user.id;
      const name = `${log.user.firstName} ${log.user.lastName}`;
      const current = groups.get(groupKey);

      if (!current) {
        groups.set(groupKey, {
          id: groupKey,
          name,
          logs: [log],
          latest: log.timestamp,
        });
        continue;
      }

      current.logs.push(log);
      if (new Date(log.timestamp).getTime() > new Date(current.latest).getTime()) {
        current.latest = log.timestamp;
      }
    }

    return Array.from(groups.values()).sort(
      (a, b) => new Date(b.latest).getTime() - new Date(a.latest).getTime()
    );
  }, [initialLogs]);

  // Someone is in service when their most recent stamp is an entrata. It is
  // the same rule the clock-in button uses, read from the other side.
  const people = useMemo(
    () =>
      groupedLogs.map((group) => {
        const pairs = buildClockLogPairs(group.logs);
        const openPair = pairs.find((pair) => pair.clockIn && !pair.clockOut) ?? null;
        const monthMs = pairs.reduce(
          (total, pair) =>
            getMonthKey(pair.startTimestamp) === getCurrentMonthKey()
              ? total + (getClockPairDurationMs(pair) ?? 0)
              : total,
          0
        );

        return {
          id: group.id,
          name: group.name,
          latest: group.latest,
          shiftCount: pairs.length,
          monthMs,
          since: openPair?.clockIn?.timestamp ?? null,
        };
      }),
    [groupedLogs]
  );

  const onShiftNow = useMemo(() => people.filter((person) => person.since), [people]);
  const offShift = useMemo(() => people.filter((person) => !person.since), [people]);

  const selectedGroup = useMemo(
    () => groupedLogs.find((group) => group.id === selectedUser) ?? null,
    [groupedLogs, selectedUser]
  );

  const selectedMonthSummary = useMemo(
    () => (selectedGroup ? getMonthWorkSummary(selectedGroup.logs, sheetMonth, settings) : null),
    [selectedGroup, settings, sheetMonth]
  );

  // Every day of the chosen month, with the mistakes counted separately: they
  // are the reason this sheet gets opened at the end of a month.
  const monthDayGroups = useMemo(() => {
    if (!selectedGroup) {
      return [];
    }

    return groupLogsByDay(selectedGroup.logs).filter((group) =>
      group.dayKey.startsWith(sheetMonth)
    );
  }, [selectedGroup, sheetMonth]);

  const misstampCount = useMemo(
    () =>
      monthDayGroups.reduce(
        (total, group) => total + group.pairs.filter(isMisstampedPair).length,
        0
      ),
    [monthDayGroups]
  );

  const visibleDayGroups = useMemo(() => {
    if (!onlyToFix) {
      return monthDayGroups;
    }

    return monthDayGroups
      .map((group) => ({ ...group, pairs: group.pairs.filter(isMisstampedPair) }))
      .filter((group) => group.pairs.length > 0);
  }, [monthDayGroups, onlyToFix]);

  const workedDayCount = useMemo(
    () => monthDayGroups.filter((group) => getDayWorkedDurationMs(group.pairs) > 0).length,
    [monthDayGroups]
  );

  function closeModal() {
    setSelectedUser(null);
    setSheetMonth(getCurrentMonthKey());
    setOnlyToFix(false);
  }

  async function cancelPair(pair: ClockLogPair) {
    if (!selectedGroup || cancelling) {
      return;
    }

    const logIds = [pair.clockIn?.id, pair.clockOut?.id].filter(Boolean) as string[];

    if (logIds.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      "Annullare questa timbratura? Il dipendente riceve un avviso, cosi nessuno si trova le ore cambiate senza saperlo."
    );

    if (!confirmed) {
      return;
    }

    setCancelling(true);

    try {
      const formData = new FormData();
      formData.set("userId", selectedGroup.id);
      formData.set("logIds", logIds.join(","));
      await deleteTimeLogPairAction(formData);
      router.refresh();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <Panel title="Timbrature" className="workbit-timelogs-panel">
        {groupedLogs.length === 0 ? (
          <EmptyState message="Nessuna timbratura registrata." />
        ) : (
          <div style={{ display: "grid", gap: 9 }}>
            {/* Who is working right now, first. It is the only question anyone
                opens this page to answer, and until now the page could not. */}
            {onShiftNow.length > 0 ? (
              <span style={groupLabelStyle("#15803d")}>
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background: "#22c55e",
                    marginRight: 6,
                  }}
                />
                In servizio adesso
              </span>
            ) : null}

            {onShiftNow.map((person) => (
              <PersonRow key={person.id} person={person} live onOpen={() => setSelectedUser(person.id)} />
            ))}

            <span style={groupLabelStyle("#94a3b8")}>
              {onShiftNow.length > 0 ? "Il resto del team" : "Il team"}
            </span>

            {offShift.length === 0 ? (
              <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700, padding: "2px 2px 6px" }}>
                Sono tutti dentro.
              </span>
            ) : (
              offShift.map((person) => (
                <PersonRow key={person.id} person={person} onOpen={() => setSelectedUser(person.id)} />
              ))
            )}
          </div>
        )}

        {manualEntry ? <div style={{ marginTop: 14 }}>{manualEntry}</div> : null}
      </Panel>

      {mounted && selectedGroup
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
                aria-label="Chiudi popup timbrature"
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
                  width: "min(760px, calc(var(--workbit-vw, 100vw) - 32px))",
                  maxHeight: "calc(var(--workbit-vh, 100dvh) - 32px)",
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
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "40px minmax(0, 1fr)",
                      gap: 11,
                      alignItems: "center",
                      minWidth: 0,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 40,
                        height: 40,
                        display: "inline-grid",
                        placeItems: "center",
                        borderRadius: 999,
                        background: "#f3e8ff",
                        color: "#4c1d95",
                        fontSize: 14,
                        fontWeight: 850,
                      }}
                    >
                      {initialsOfName(selectedGroup.name)}
                    </span>
                    <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: 19, color: "#0f172a", letterSpacing: "-0.03em" }}>
                        {selectedGroup.name}
                      </strong>
                      <span style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
                        {formatShiftCount(selectedGroup.logs)} in tutto
                      </span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={closeModal}
                    aria-label="Chiudi timbrature"
                    style={{
                      width: 34,
                      height: 34,
                      flex: "0 0 auto",
                      display: "inline-grid",
                      placeItems: "center",
                      borderRadius: 999,
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      color: "#64748b",
                      cursor: "pointer",
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M6 6l12 12M18 6 6 18"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>

                {/* The month with arrows, in place of the empty day picker.
                    Timbrature get looked at a month at a time, at the end of
                    the month, to pay people. */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "34px minmax(0, 1fr) 34px",
                    alignItems: "center",
                    gap: 8,
                    padding: 5,
                    borderRadius: 14,
                    background: "#f8fafc",
                    border: "1px solid #e9edf3",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSheetMonth((current) => shiftMonthKey(current, -1))}
                    aria-label="Mese precedente"
                    style={monthArrowStyle}
                  >
                    &lsaquo;
                  </button>
                  <span
                    style={{
                      textAlign: "center",
                      fontWeight: 820,
                      fontSize: 14.5,
                      letterSpacing: "-0.02em",
                      color: "#0f172a",
                    }}
                  >
                    {formatMonthLabel(sheetMonth)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSheetMonth((current) => shiftMonthKey(current, 1))}
                    aria-label="Mese successivo"
                    style={monthArrowStyle}
                  >
                    &rsaquo;
                  </button>
                </div>

                <div
                  className="dashboard-inline-grid"
                  style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}
                >
                  <SheetTotal
                    label="Reali"
                    value={formatDurationFromMilliseconds(selectedMonthSummary?.realMs ?? 0)}
                    lead
                  />
                  <SheetTotal
                    label="Arrotondate"
                    value={formatDurationFromMilliseconds(selectedMonthSummary?.roundedMs ?? 0)}
                  />
                  <SheetTotal label="Giorni" value={String(workedDayCount)} />
                </div>

                {misstampCount > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 14,
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      color: "#92400e",
                      fontSize: 12.5,
                      fontWeight: 780,
                    }}
                  >
                    <span>
                      {misstampCount === 1
                        ? "1 turno sotto il minuto"
                        : `${misstampCount} turni sotto il minuto`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOnlyToFix((current) => !current)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        background: "#ffffff",
                        border: "1px solid #fde68a",
                        color: "#92400e",
                        fontSize: 12,
                        fontWeight: 850,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {onlyToFix ? "Vedi tutti" : "Vedi"}
                    </button>
                  </div>
                ) : null}

                {visibleDayGroups.length === 0 ? (
                  <EmptyState
                    message={
                      onlyToFix
                        ? "Nessuna timbratura da correggere in questo mese."
                        : "Nessuna timbratura in questo mese."
                    }
                  />
                ) : (
                  <div style={{ display: "grid", gap: 14 }}>
                    {visibleDayGroups.map((dayGroup) => {
                      const dayWorkedMs = getDayWorkedDurationMs(dayGroup.pairs);

                      return (
                        <div key={dayGroup.dayKey} style={{ display: "grid", gap: 9 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "baseline",
                              justifyContent: "space-between",
                              gap: 10,
                            }}
                          >
                            <span style={{ minWidth: 0 }}>
                              <span
                                style={{
                                  fontSize: 14.5,
                                  fontWeight: 820,
                                  letterSpacing: "-0.02em",
                                  color: "#0f172a",
                                }}
                              >
                                {dayGroup.dayLabel}
                              </span>
                            </span>
                            <span
                              style={{
                                flex: "0 0 auto",
                                fontSize: 13,
                                fontWeight: 830,
                                fontVariantNumeric: "tabular-nums",
                                borderRadius: 999,
                                padding: "3px 10px",
                                color: dayWorkedMs > 0 ? "#4c1d95" : "#92400e",
                                background: dayWorkedMs > 0 ? "#f3e8ff" : "#fffbeb",
                              }}
                            >
                              {formatDurationFromMilliseconds(dayWorkedMs)}
                            </span>
                          </div>

                          {dayGroup.pairs.map((pair, index) => (
                            <ShiftBox
                              key={pair.id}
                              pair={pair}
                              position={index + 1}
                              total={dayGroup.pairs.length}
                              onCancel={cancelPair}
                              pending={cancelling}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ height: 1, background: "#e9edf3" }} />

                <button
                  type="button"
                  onClick={() => {
                    closeModal();
                    window.setTimeout(() => {
                      document
                        .querySelector(".workbit-manual-timelog")
                        ?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }, 80);
                  }}
                  style={footerActionStyle}
                >
                  <span>+ Aggiungi una timbratura mancante</span>
                  <span style={{ color: "#cbd5e1" }}>&rsaquo;</span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/export")}
                  style={{
                    ...footerActionStyle,
                    border: "1px solid #e9edf3",
                    background: "#f8fafc",
                    color: "#0f172a",
                  }}
                >
                  <span>Esporta il mese in PDF</span>
                  <span style={{ color: "#94a3b8" }}>&rsaquo;</span>
                </button>
              </section>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function PersonalTimeLogsPanel({
  initialLogs,
  role,
  todayTotals,
  hasMoreInitialLogs,
}: {
  initialLogs: LogItem[];
  role: Role | string;
  todayTotals: Totals;
  hasMoreInitialLogs: boolean;
}) {
  const [logs, setLogs] = useState(initialLogs);
  const [hasMoreLogs, setHasMoreLogs] = useState(hasMoreInitialLogs);
  const [loadingMoreLogs, setLoadingMoreLogs] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState("");
  const [monthFilter, setMonthFilter] = useState(getCurrentMonthKey());

  const allDayGroups = useMemo(() => groupLogsByDay(logs), [logs]);
  const monthDayGroups = useMemo(
    () => allDayGroups.filter((group) => group.dayKey.startsWith(monthFilter)),
    [allDayGroups, monthFilter]
  );
  const dayGroups = monthDayGroups;
  const misstampCount = useMemo(
    () =>
      monthDayGroups.reduce(
        (total, group) => total + group.pairs.filter(isMisstampedPair).length,
        0
      ),
    [monthDayGroups]
  );
  const todayKey = getTodayKey();
  const oldestLoadedLog = logs[logs.length - 1] ?? null;

  async function loadMoreLogs() {
    if (!oldestLoadedLog || loadingMoreLogs || !hasMoreLogs) {
      return;
    }

    setLoadingMoreLogs(true);
    setLoadMoreError("");

    try {
      const response = await fetch(
        `/api/timelogs?before=${encodeURIComponent(oldestLoadedLog.timestamp)}`,
        { cache: "no-store" }
      );
      const result = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            hasMore?: boolean;
            logs?: LogItem[];
            message?: string;
          }
        | null;

      if (!response.ok || !result?.ok || !Array.isArray(result.logs)) {
        setLoadMoreError(result?.message || "Impossibile caricare lo storico.");
        return;
      }

      setLogs((current) => {
        const seen = new Set(current.map((log) => log.id));
        const nextLogs = result.logs?.filter((log) => !seen.has(log.id)) ?? [];
        return current.concat(nextLogs);
      });
      setHasMoreLogs(Boolean(result.hasMore));
    } catch {
      setLoadMoreError("Impossibile caricare lo storico.");
    } finally {
      setLoadingMoreLogs(false);
    }
  }

  return (
    <Panel
      className="workbit-timelog-history-panel workbit-personal-timelog-panel"
      title={role === "OWNER" ? "Timbrature del team" : "Le tue timbrature"}
      action={formatMonthLabel(monthFilter)}
    >
      <div className="workbit-timelog-history-content" style={{ display: "grid", gap: 16 }}>
        {todayTotals ? (
          <div
            className="workbit-timelog-today-total"
            style={{
              padding: "12px 14px",
              borderRadius: 18,
              background: "linear-gradient(135deg, #f5f3ff, #ffffff)",
              border: "1px solid rgba(124, 58, 237, 0.14)",
              color: "#4c1d95",
              fontWeight: 850,
            }}
          >
            Oggi hai lavorato {formatDurationClock(todayTotals.roundedHours)}
            <span> (arrotondate)</span>
          </div>
        ) : null}

        <div className="workbit-time-section-label">Le tue timbrature</div>

        {/* The same month arrows as the owner's sheet: hours are looked at a
            month at a time. The day dropdown went with them - the days are
            already the list. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "34px minmax(0, 1fr) 34px",
            alignItems: "center",
            gap: 8,
            padding: 5,
            borderRadius: 14,
            background: "#f8fafc",
            border: "1px solid #e9edf3",
          }}
        >
          <button
            type="button"
            onClick={() => setMonthFilter((current) => shiftMonthKey(current, -1))}
            aria-label="Mese precedente"
            style={monthArrowStyle}
          >
            &lsaquo;
          </button>
          <span
            style={{
              textAlign: "center",
              fontWeight: 820,
              fontSize: 14.5,
              letterSpacing: "-0.02em",
              color: "#0f172a",
            }}
          >
            {formatMonthLabel(monthFilter)}
          </span>
          <button
            type="button"
            onClick={() => setMonthFilter((current) => shiftMonthKey(current, 1))}
            aria-label="Mese successivo"
            style={monthArrowStyle}
          >
            &rsaquo;
          </button>
        </div>

        {misstampCount > 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 14,
              background: "#fffbeb",
              border: "1px solid #fde68a",
              color: "#92400e",
              fontSize: 12.5,
              fontWeight: 780,
            }}
          >
            {misstampCount === 1
              ? "1 turno sotto il minuto: avvisa il titolare se è un errore."
              : `${misstampCount} turni sotto il minuto: avvisa il titolare se sono errori.`}
          </div>
        ) : null}

        {dayGroups.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
            Nessuna timbratura registrata in questo mese.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {dayGroups.map((dayGroup) => {
              const dayWorkedMs = getDayWorkedDurationMs(dayGroup.pairs);

              return (
                <div key={dayGroup.dayKey} style={{ display: "grid", gap: 9 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 14.5,
                          fontWeight: 820,
                          letterSpacing: "-0.02em",
                          color: "#0f172a",
                        }}
                      >
                        {dayGroup.dayKey === todayKey ? "Oggi" : dayGroup.dayLabel}
                      </span>
                    </span>
                    <span
                      style={{
                        flex: "0 0 auto",
                        fontSize: 13,
                        fontWeight: 830,
                        fontVariantNumeric: "tabular-nums",
                        borderRadius: 999,
                        padding: "3px 10px",
                        color: dayWorkedMs > 0 ? "#4c1d95" : "#92400e",
                        background: dayWorkedMs > 0 ? "#f3e8ff" : "#fffbeb",
                      }}
                    >
                      {formatDurationFromMilliseconds(dayWorkedMs)}
                    </span>
                  </div>

                  {dayGroup.pairs.map((pair, index) => (
                    <ShiftBox
                      key={pair.id}
                      pair={pair}
                      position={index + 1}
                      total={dayGroup.pairs.length}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {hasMoreLogs ? (
          <PrimaryButton
            type="button"
            tone="sand"
            onClick={loadMoreLogs}
            disabled={loadingMoreLogs}
            style={{ justifySelf: "center", minHeight: 38, padding: "0 16px", borderRadius: 999 }}
          >
            {loadingMoreLogs ? "Caricamento..." : "Carica storico precedente"}
          </PrimaryButton>
        ) : null}

        {loadMoreError ? (
          <p style={{ margin: 0, color: "#b91c1c", lineHeight: 1.6 }}>{loadMoreError}</p>
        ) : null}
      </div>
    </Panel>
  );
}

export function TimeLogsClient({
  role,
  initialLogs,
  settings,
  totals,
  todayTotals,
  hasMoreInitialLogs = false,
  manualEntry = null,
}: {
  role: Role | string;
  initialLogs: LogItem[];
  settings: BarSettingsSummary;
  totals: Totals;
  todayTotals: Totals;
  hasMoreInitialLogs?: boolean;
  /** The "add a missing stamp" form, handed in from the page. */
  manualEntry?: ReactNode;
}) {
  if (role === "OWNER") {
    return (
      <Stack>
        <OwnerTimeLogsPanel initialLogs={initialLogs} settings={settings} manualEntry={manualEntry} />
      </Stack>
    );
  }

  return (
    <div className="workbit-time-page">
      <section className="workbit-time-overview" aria-labelledby="workbit-time-title">
        <div className="workbit-time-heading">
          <span>Riepilogo</span>
          <h2 id="workbit-time-title">Il tuo tempo</h2>
        </div>

        <div className="workbit-time-summary-grid">
          <div className="workbit-time-summary-card">
            <span>Ore reali</span>
            <strong>{formatDurationClock(totals?.realHours ?? 0)}</strong>
          </div>
          <div className="workbit-time-summary-card">
            <span>Ore arrotondate</span>
            <strong>{formatDurationClock(totals?.roundedHours ?? 0)}</strong>
          </div>
        </div>
      </section>

      <PersonalTimeLogsPanel
        initialLogs={initialLogs}
        role={role}
        todayTotals={todayTotals}
        hasMoreInitialLogs={hasMoreInitialLogs}
      />
    </div>
  );
}

