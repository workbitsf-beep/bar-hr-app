"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import type { ClockType, Role } from "@prisma/client";
import {
  EmptyState,
  FormField,
  ItemCard,
  ItemList,
  Panel,
  PrimaryButton,
  Stack,
  StatusPill,
  TextInput,
  formatDateTime,
} from "../ui";

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

const EARTH_RADIUS_METERS = 6371000;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getDayKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatDayLabel(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export function ClockActionsPanel({
  role,
  settings,
  compact = false,
}: {
  role: Role | string;
  settings: BarSettingsSummary;
  compact?: boolean;
}) {
  const router = useRouter();
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [message, setMessage] = useState("");
  const [distance, setDistance] = useState<number | null>(null);
  const [geoReady, setGeoReady] = useState(false);
  const [submitting, setSubmitting] = useState<"in" | "out" | "geo" | null>(null);

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
    distance <= (settings?.gpsRadius ?? 0);

  useEffect(() => {
    if (!canClock || !gpsConfigured || !navigator.geolocation) {
      return;
    }

    setSubmitting("geo");
    setGeoReady(false);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextLat = position.coords.latitude;
        const nextLon = position.coords.longitude;
        setLatitude(String(nextLat));
        setLongitude(String(nextLon));
        const nextDistance = calculateDistance(
          nextLat,
          nextLon,
          settings.gpsLatitude as number,
          settings.gpsLongitude as number
        );
        setDistance(nextDistance);
        setGeoReady(true);
        setMessage(
          nextDistance <= (settings.gpsRadius as number)
            ? `Posizione aggiornata automaticamente. Sei nel raggio corretto (${Math.round(nextDistance)} m).`
            : `Posizione aggiornata automaticamente. Sei fuori raggio di ${Math.round(nextDistance)} m.`
        );
        setSubmitting((current) => (current === "geo" ? null : current));
      },
      () => {
        setGeoReady(false);
        setMessage("Impossibile leggere automaticamente la posizione attuale.");
        setSubmitting((current) => (current === "geo" ? null : current));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [canClock, gpsConfigured, settings]);

  async function runClockAction(endpoint: "clock-in" | "clock-out") {
    setSubmitting(endpoint === "clock-in" ? "in" : "out");
    setMessage("");

    try {
      const response = await fetch(`/api/timelogs/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: Number(latitude),
          longitude: Number(longitude),
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; duration?: number }
        | null;

      if (!response.ok || payload?.ok === false) {
        setMessage(payload?.message || "Operazione non riuscita");
        return;
      }

      if (endpoint === "clock-out" && typeof payload?.duration === "number") {
        const hours = Math.round((payload.duration / 3600000) * 100) / 100;
        setMessage(`Uscita registrata. Durata ${hours} ore.`);
      } else {
        setMessage("Entrata registrata.");
      }

      router.refresh();
    } catch {
      setMessage("Impossibile contattare il servizio timbrature.");
    } finally {
      setSubmitting(null);
    }
  }

  function captureGeolocation() {
    if (!navigator.geolocation || !gpsConfigured) {
      setMessage("Geolocalizzazione non disponibile.");
      return;
    }

    setSubmitting("geo");
    setMessage("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLat = position.coords.latitude;
        const nextLon = position.coords.longitude;
        setLatitude(String(nextLat));
        setLongitude(String(nextLon));
        const nextDistance = calculateDistance(
          nextLat,
          nextLon,
          settings.gpsLatitude as number,
          settings.gpsLongitude as number
        );
        setDistance(nextDistance);
        setMessage(
          nextDistance <= (settings.gpsRadius as number)
            ? `Sei nel raggio corretto (${Math.round(nextDistance)} m).`
            : `Sei fuori raggio di ${Math.round(nextDistance)} m.`
        );
        setGeoReady(true);
        setSubmitting(null);
      },
      () => {
        setGeoReady(false);
        setMessage("Impossibile leggere la posizione attuale.");
        setSubmitting(null);
      }
    );
  }

  if (!canClock) {
    return null;
  }

  return (
    <Panel
      title={compact ? "Timbratura veloce" : "Entrata / uscita"}
      action={gpsConfigured ? `Raggio ${settings?.gpsRadius} m` : "GPS non configurato"}
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
          }}
        >
          {gpsConfigured
            ? "La posizione viene aggiornata automaticamente. Puoi timbrare appena il dispositivo entra nel raggio configurato."
            : "Completa la configurazione GPS del locale per abilitare le timbrature."}
          {settings?.roundingEnabled && settings.roundingMinutes ? (
            <div style={{ marginTop: 6 }}>
              Arrotondamento attivo: {settings.roundingMode} ogni {settings.roundingMinutes} minuti.
            </div>
          ) : null}
          {distance !== null ? (
            <div style={{ marginTop: 6, fontWeight: 600 }}>
              Distanza attuale: {Math.round(distance)} m
            </div>
          ) : null}
        </div>

        <div className="dashboard-clock-actions" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {!compact ? (
            <PrimaryButton
              type="button"
              tone="sand"
              onClick={captureGeolocation}
              disabled={submitting !== null || !gpsConfigured}
            >
              {submitting === "geo" ? "Aggiornamento posizione..." : "Aggiorna posizione"}
            </PrimaryButton>
          ) : null}
          <PrimaryButton
            type="button"
            tone="green"
            onClick={() => runClockAction("clock-in")}
            disabled={submitting !== null || !insideRadius || !geoReady}
          >
            {submitting === "in" ? "Registrazione..." : "Entrata"}
          </PrimaryButton>
          <PrimaryButton
            type="button"
            tone="red"
            onClick={() => runClockAction("clock-out")}
            disabled={submitting !== null || !insideRadius || !geoReady}
          >
            {submitting === "out" ? "Registrazione..." : "Uscita"}
          </PrimaryButton>
        </div>

        {message ? (
          <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>{message}</p>
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
          <div style={{ display: "grid", gap: 10 }}>
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
                    {group.logs.length} timbrature · ultima {formatDateTime(group.latest)}
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
                      {filteredSelectedLogs.length} timbrature visibili
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

                {filteredSelectedLogs.length === 0 ? (
                  <EmptyState message="Nessuna timbratura trovata per il giorno selezionato." />
                ) : (
                  <ItemList>
                    {filteredSelectedLogs.map((log) => (
                      <ItemCard
                        key={log.id}
                        title={formatDayLabel(log.timestamp)}
                        subtitle={`${log.type} · ${formatDateTime(log.timestamp)}`}
                        meta={
                          <>
                            {log.latitude !== null && log.longitude !== null
                              ? `Lat ${log.latitude.toFixed(5)} · Lon ${log.longitude.toFixed(5)}`
                              : "Coordinate non salvate"}
                            {log.note ? (
                              <>
                                <br />
                                {log.note}
                              </>
                            ) : null}
                          </>
                        }
                        footer={
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <StatusPill
                              label={log.type}
                              tone={log.type === "IN" ? "warning" : "success"}
                            />
                            {log.isManual ? <StatusPill label="Manuale" tone="neutral" /> : null}
                          </div>
                        }
                      />
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
}: {
  initialLogs: LogItem[];
  role: Role | string;
}) {
  const [dayFilter, setDayFilter] = useState("");

  const filteredLogs = useMemo(
    () => initialLogs.filter((log) => (dayFilter ? getDayKey(log.timestamp) === dayFilter : true)),
    [dayFilter, initialLogs]
  );

  return (
    <Panel
      title={role === "OWNER" ? "Timbrature del team" : "Le tue timbrature"}
      action={`${filteredLogs.length} registrazioni`}
    >
      <div style={{ display: "grid", gap: 16 }}>
        <FormField label="Filtra per giorno">
          <TextInput
            type="date"
            value={dayFilter}
            onChange={(event) => setDayFilter(event.target.value)}
          />
        </FormField>

        {filteredLogs.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
            Nessuna timbratura registrata.
          </p>
        ) : (
          <ItemList>
            {filteredLogs.map((log) => (
              <ItemCard
                key={log.id}
                title={formatDateTime(log.timestamp)}
                subtitle={`${log.type} · ${log.isManual ? "manuale" : "ufficiale"}`}
                meta={
                  <>
                    {log.latitude !== null && log.longitude !== null
                      ? `Lat ${log.latitude.toFixed(5)} · Lon ${log.longitude.toFixed(5)}`
                      : "Coordinate non salvate"}
                    {log.note ? (
                      <>
                        <br />
                        {log.note}
                      </>
                    ) : null}
                  </>
                }
                footer={
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <StatusPill
                      label={log.type}
                      tone={log.type === "IN" ? "warning" : "success"}
                    />
                    {log.isManual ? <StatusPill label="Manuale" tone="neutral" /> : null}
                  </div>
                }
              />
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
  settings,
  totals,
}: {
  role: Role | string;
  initialLogs: LogItem[];
  settings: BarSettingsSummary;
  totals: Totals;
}) {
  return (
    <>
      {totals ? (
        <Panel title="Totale ore personale">
          <div className="dashboard-summary-grid" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <ItemCard className="dashboard-summary-card" title="Ore reali" meta={`${totals.realHours.toFixed(2)} h`} />
            <ItemCard
              className="dashboard-summary-card"
              title="Ore arrotondate"
              meta={`${totals.roundedHours.toFixed(2)} h`}
            />
          </div>
        </Panel>
      ) : null}

      <Stack>
        <ClockActionsPanel role={role} settings={settings} />

        {role === "OWNER" ? (
          <OwnerTimeLogsPanel initialLogs={initialLogs} />
        ) : (
          <PersonalTimeLogsPanel initialLogs={initialLogs} role={role} />
        )}
      </Stack>
    </>
  );
}
