"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import type { ClockType, Role } from "@prisma/client";
import { startPreciseGeolocationWatch } from "@/lib/browser-gps";
import { calculateDistance } from "@/lib/gps";
import { APP_TIME_ZONE, getZonedDateParts } from "@/lib/time-zone";
import {
  EmptyState,
  FormField,
  ItemCard,
  ItemList,
  Panel,
  PrimaryButton,
  Stack,
  TextInput,
  formatDateTime,
} from "../ui";
import { formatDurationClock, formatDurationFromMilliseconds } from "@/lib/time-format";

type LogItem = {
  id: string;
  type: ClockType;
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  isManual: boolean;
  note: string | null;
  user: {
    firstName: string;
    lastName: string;
  };
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

function getDayKey(value: string) {
  const parts = getZonedDateParts(value, APP_TIME_ZONE);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatDayLabel(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
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

function ClockLogRow({ log }: { log: LogItem }) {
  const visual = getClockTypeVisual(log.type);

  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        padding: "10px 12px",
        borderRadius: 16,
        background: "#fff",
        border: "1px solid #e2e8f0",
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
            padding: "7px 11px",
            borderRadius: 999,
            background: visual.background,
            border: `1px solid ${visual.border}`,
            color: visual.color,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 13, lineHeight: 1 }}>
            {visual.arrow}
          </span>
        </span>

        <strong style={{ color: visual.timeColor, fontSize: 17, lineHeight: 1 }}>
          {formatClockTime(log.timestamp)}
        </strong>
      </div>
    </div>
  );
}

function groupLogsIntoRows(logs: LogItem[]) {
  const rows: LogItem[][] = [];

  for (let index = 0; index < logs.length; index += 2) {
    rows.push(logs.slice(index, index + 2));
  }

  return rows;
}

function getClockRowDurationMs(row: LogItem[]) {
  const clockIn = row.find((log) => log.type === "IN");
  const clockOut = row.find((log) => log.type === "OUT");

  if (!clockIn || !clockOut) {
    return null;
  }

  const duration = new Date(clockOut.timestamp).getTime() - new Date(clockIn.timestamp).getTime();
  return duration > 0 ? duration : null;
}

function getDayWorkedDurationMs(logs: LogItem[]) {
  return groupLogsIntoRows(logs).reduce((total, row) => total + (getClockRowDurationMs(row) ?? 0), 0);
}

function countShiftRows(logs: LogItem[]) {
  return groupLogsIntoRows(logs).length;
}

function formatShiftCount(logs: LogItem[]) {
  const count = countShiftRows(logs);
  return `${count} ${count === 1 ? "turno" : "turni"}`;
}

function getTodayKey() {
  const parts = getZonedDateParts(new Date(), APP_TIME_ZONE);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function groupLogsByDay(logs: LogItem[]) {
  const groups = new Map<
    string,
    {
      dayKey: string;
      dayLabel: string;
      latest: string;
      logs: LogItem[];
    }
  >();

  for (const log of logs) {
    const dayKey = getDayKey(log.timestamp);
    const current = groups.get(dayKey);

    if (!current) {
      groups.set(dayKey, {
        dayKey,
        dayLabel: formatDayLabel(log.timestamp),
        latest: log.timestamp,
        logs: [log],
      });
      continue;
    }

    current.logs.push(log);
    if (new Date(log.timestamp).getTime() > new Date(current.latest).getTime()) {
      current.latest = log.timestamp;
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      logs: group.logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    }))
    .sort((a, b) => new Date(b.latest).getTime() - new Date(a.latest).getTime());
}

function ClockDayCard({
  dayLabel,
  logs,
  subtitle,
  children,
}: {
  dayLabel: string;
  logs: LogItem[];
  subtitle: string;
  children: ReactNode;
}) {
  const workedMs = getDayWorkedDurationMs(logs);

  return (
    <div
      className="dashboard-item-card"
      style={{
        padding: 16,
        borderRadius: 20,
        display: "grid",
        gap: 6,
        background: "rgba(255, 255, 255, 0.92)",
        border: "1px solid rgba(124, 58, 237, 0.14)",
        boxShadow: "0 16px 32px rgba(76, 29, 149, 0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <strong style={{ color: "var(--workbit-navy)", minWidth: 0 }}>{dayLabel}</strong>
        {workedMs > 0 ? (
          <span
            title="Ore lavorate"
            style={{
              flex: "0 0 auto",
              borderRadius: 999,
              padding: "5px 9px",
              background: "linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(168, 85, 247, 0.16))",
              border: "1px solid rgba(124, 58, 237, 0.16)",
              color: "#5b21b6",
              fontSize: 12,
              fontWeight: 900,
              lineHeight: 1,
            }}
          >
            {formatDurationFromMilliseconds(workedMs)}
          </span>
        ) : null}
      </div>
      <div style={{ color: "#334155" }}>{subtitle}</div>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}

export function ClockActionsPanel({
  role,
  settings,
  compact = false,
  clockStatus = "CAN_CLOCK_IN",
}: {
  role: Role | string;
  settings: BarSettingsSummary;
  compact?: boolean;
  clockStatus?: ClockActionStatus;
}) {
  const router = useRouter();
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [distance, setDistance] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [geoReady, setGeoReady] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [submitting, setSubmitting] = useState<"in" | "out" | null>(null);
  const [locating, setLocating] = useState(false);
  const [weakAccuracy, setWeakAccuracy] = useState<number | null>(null);
  const stopWatchRef = useRef<(() => void) | null>(null);

  const gpsConfigured =
    settings &&
    settings.gpsLatitude !== null &&
    settings.gpsLongitude !== null &&
    settings.gpsRadius !== null;
  const canClock = role !== "OWNER";
  const insideRadius =
    gpsConfigured &&
    latitude !== "" &&
    longitude !== "" &&
    distance !== null &&
    accuracy !== null &&
    distance <= ((settings?.gpsRadius ?? 0) + accuracy);
  const canClockIn = insideRadius && geoReady && clockStatus === "CAN_CLOCK_IN";
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
      return "Avvicinati di piu al punto impostato dal titolare.";
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

  const startGeolocationWatch = useCallback((manual = false) => {
    if (!canClock || !gpsConfigured || !navigator.geolocation) {
      return;
    }

    stopGeolocationWatch();
    setLocating(true);
    setLocationError("");
    setWeakAccuracy(null);

    if (manual) {
      setActionMessage("");
    }

    // Continuous tracking collects multiple fresh samples and only keeps the
    // most reliable point before enabling clock in/out.
    stopWatchRef.current = startPreciseGeolocationWatch({
      onSample(sample) {
        const nextDistance = calculateDistance(
          sample.latitude,
          sample.longitude,
          settings.gpsLatitude as number,
          settings.gpsLongitude as number
        );

        setLatitude(String(sample.latitude));
        setLongitude(String(sample.longitude));
        setAccuracy(sample.accuracy);
        setDistance(nextDistance);
        setGeoReady(true);
        setWeakAccuracy(null);
        setLocationError("");
        setLocating(false);
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
    });
  }, [canClock, gpsConfigured, settings, stopGeolocationWatch]);

  useEffect(() => {
    if (!canClock || !gpsConfigured || !navigator.geolocation) {
      return;
    }

    startGeolocationWatch(false);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        startGeolocationWatch(false);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopGeolocationWatch();
    };
  }, [canClock, gpsConfigured, settings?.gpsLatitude, settings?.gpsLongitude, settings?.gpsRadius, startGeolocationWatch, stopGeolocationWatch]);

  async function runClockAction(endpoint: "clock-in" | "clock-out") {
    setSubmitting(endpoint === "clock-in" ? "in" : "out");
    setActionMessage("");

    try {
      const response = await fetch(`/api/timelogs/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: Number(latitude),
          longitude: Number(longitude),
          accuracy,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; duration?: number }
        | null;

      if (!response.ok || payload?.ok === false) {
        setActionMessage(payload?.message || "Operazione non riuscita");
        return;
      }

      if (endpoint === "clock-out" && typeof payload?.duration === "number") {
        setActionMessage(
          `Uscita registrata. Durata ${formatDurationFromMilliseconds(payload.duration)}.`
        );
      } else {
        setActionMessage("Entrata registrata.");
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

  return (
    <Panel
      title={compact ? "Timbratura veloce" : "Entrata / uscita"}
      action={gpsConfigured ? "Pronta" : "Da impostare"}
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            padding: 14,
            color: "#334155",
            lineHeight: 1.6,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 180px", minWidth: 0 }}>{locationSummary}</div>
          <PrimaryButton
            type="button"
            tone="sand"
            onClick={captureGeolocation}
            disabled={locating || !gpsConfigured}
            aria-label="Aggiorna posizione"
            title={locating ? "Aggiornamento posizione..." : "Aggiorna posizione"}
            style={{
              width: 46,
              height: 46,
              minWidth: 46,
              padding: 0,
              borderRadius: 16,
              fontSize: 21,
              flex: "0 0 auto",
            }}
          >
            {locating ? "…" : "🔄"}
          </PrimaryButton>
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
            {submitting === "out" ? "..." : "ESCI"}
          </PrimaryButton>
        </div>
        </div>

        {actionMessage ? (
          <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>{actionMessage}</p>
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

function OwnerTimeLogsPanel({ initialLogs }: { initialLogs: LogItem[] }) {
  const [mounted, setMounted] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!selectedUser) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedUser]);

  const groupedLogs = useMemo(() => {
    const groups = new Map<
      string,
      { name: string; logs: LogItem[]; latest: string }
    >();

    for (const log of initialLogs) {
      const name = `${log.user.firstName} ${log.user.lastName}`;
      const current = groups.get(name);

      if (!current) {
        groups.set(name, {
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

  const selectedGroup = useMemo(
    () => groupedLogs.find((group) => group.name === selectedUser) ?? null,
    [groupedLogs, selectedUser]
  );

  const filteredSelectedLogs = useMemo(() => {
    if (!selectedGroup) {
      return [];
    }

    return selectedGroup.logs.filter((log) =>
      dayFilter ? getDayKey(log.timestamp) === dayFilter : true
    );
  }, [dayFilter, selectedGroup]);

  const selectedDayGroups = useMemo(() => groupLogsByDay(filteredSelectedLogs), [filteredSelectedLogs]);

  function closeModal() {
    setSelectedUser(null);
    setDayFilter("");
  }

  return (
    <>
      <Panel title="Timbrature del team" action={`${groupedLogs.length} persone`}>
        {groupedLogs.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
            Nessuna timbratura registrata.
          </p>
        ) : (
          <div className="dashboard-scroll-list" style={{ display: "grid", gap: 10 }}>
            {groupedLogs.map((group) => (
              <button
                key={group.name}
                type="button"
                onClick={() => setSelectedUser(group.name)}
                className="dashboard-list-button"
                style={{
                  width: "100%",
                  padding: 16,
                  borderRadius: 20,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <strong style={{ color: "#0f172a" }}>{group.name}</strong>
                  <span style={{ color: "#475569", fontSize: 14 }}>
                    {formatShiftCount(group.logs)} - ultima {formatDateTime(group.latest)}
                  </span>
                </div>

                <span
                  className="dashboard-list-button-arrow"
                  style={{
                    color: "#64748b",
                    fontSize: 18,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  &rsaquo;
                </span>
              </button>
            ))}
          </div>
        )}
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
                  width: "min(760px, calc(100vw - 32px))",
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
                    <strong style={{ fontSize: 22, color: "#0f172a" }}>{selectedGroup.name}</strong>
                    <span style={{ color: "#475569" }}>
                      {formatShiftCount(filteredSelectedLogs)} visibili
                    </span>
                  </div>

                  <PrimaryButton type="button" tone="sand" onClick={closeModal}>
                    Chiudi
                  </PrimaryButton>
                </div>

                <FormField label="Filtra per giorno">
                  <TextInput
                    type="date"
                    value={dayFilter}
                    onChange={(event) => setDayFilter(event.target.value)}
                  />
                </FormField>

                {selectedDayGroups.length === 0 ? (
                  <EmptyState message="Nessuna timbratura trovata per il giorno selezionato." />
                ) : (
                  <ItemList scrollable={selectedDayGroups.length > 4}>
                    {selectedDayGroups.map((dayGroup) => (
                      <ClockDayCard
                        key={dayGroup.dayKey}
                        dayLabel={dayGroup.dayLabel}
                        logs={dayGroup.logs}
                        subtitle={formatShiftCount(dayGroup.logs)}
                      >
                          <div
                            style={{
                              display: "grid",
                              gap: 8,
                            }}
                          >
                            {groupLogsIntoRows(dayGroup.logs).map((row) => (
                              <div
                                key={row.map((log) => log.id).join("-")}
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`,
                                  gap: 8,
                                }}
                              >
                                {row.map((log) => (
                                  <ClockLogRow key={log.id} log={log} />
                                ))}
                              </div>
                            ))}
                          </div>
                      </ClockDayCard>
                    ))}
                  </ItemList>
                )}
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
}: {
  initialLogs: LogItem[];
  role: Role | string;
  todayTotals: Totals;
}) {
  const [dayFilter, setDayFilter] = useState("");

  const filteredLogs = useMemo(
    () => initialLogs.filter((log) => (dayFilter ? getDayKey(log.timestamp) === dayFilter : true)),
    [dayFilter, initialLogs]
  );

  const dayGroups = useMemo(() => groupLogsByDay(filteredLogs), [filteredLogs]);
  const todayKey = getTodayKey();

  return (
    <Panel
      title={role === "OWNER" ? "Timbrature del team" : "Le tue timbrature"}
      action={formatShiftCount(filteredLogs)}
    >
      <div style={{ display: "grid", gap: 16 }}>
        {todayTotals ? (
          <div
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
          </div>
        ) : null}

        <FormField label="Filtra per giorno">
          <TextInput
            type="date"
            value={dayFilter}
            onChange={(event) => setDayFilter(event.target.value)}
          />
        </FormField>

        {dayGroups.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
            Nessuna timbratura registrata.
          </p>
        ) : (
          <ItemList scrollable>
            {dayGroups.map((dayGroup) => (
              <ClockDayCard
                key={dayGroup.dayKey}
                dayLabel={dayGroup.dayLabel}
                logs={dayGroup.logs}
                subtitle={
                  dayGroup.dayKey === todayKey && todayTotals
                    ? `${formatShiftCount(dayGroup.logs)} - oggi ${formatDurationClock(todayTotals.roundedHours)}`
                    : formatShiftCount(dayGroup.logs)
                }
              >
                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    {groupLogsIntoRows(dayGroup.logs).map((row) => (
                      <div
                        key={row.map((log) => log.id).join("-")}
                        style={{
                          display: "grid",
                          gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`,
                          gap: 8,
                        }}
                      >
                        {row.map((log) => (
                          <ClockLogRow key={log.id} log={log} />
                        ))}
                      </div>
                    ))}
                  </div>
              </ClockDayCard>
            ))}
          </ItemList>
        )}
      </div>
    </Panel>
  );
}

export function TimeLogsClient({
  role,
  initialLogs,
  totals,
  todayTotals,
}: {
  role: Role | string;
  initialLogs: LogItem[];
  settings: BarSettingsSummary;
  totals: Totals;
  todayTotals: Totals;
}) {
  return (
    <>
      {totals ? (
        <Panel title="Totale ore personale">
          <div className="dashboard-summary-grid" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <ItemCard className="dashboard-summary-card" title="Ore reali" meta={formatDurationClock(totals.realHours)} />
            <ItemCard
              className="dashboard-summary-card"
              title="Ore lavorate"
              meta={formatDurationClock(totals.roundedHours)}
            />
          </div>
        </Panel>
      ) : null}

      <Stack>
        {role === "OWNER" ? (
          <OwnerTimeLogsPanel initialLogs={initialLogs} />
        ) : (
          <PersonalTimeLogsPanel initialLogs={initialLogs} role={role} todayTotals={todayTotals} />
        )}
      </Stack>
    </>
  );
}

