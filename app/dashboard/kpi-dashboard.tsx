"use client";

import { useEffect, useMemo, useState } from "react";
import type { ActivityType, Role } from "@prisma/client";
import type { DashboardKpiData } from "@/lib/dashboard-kpi";
import type { FeatureFlags } from "@/lib/features";
import { APP_TIME_ZONE } from "@/lib/time-zone";
import { EmptyState, Panel, StatusPill } from "./ui";

type DashboardKpiResponse =
  | {
      ok: true;
      data: DashboardKpiData;
    }
  | {
      ok: false;
      message?: string;
    };

type KpiDashboardProps = {
  activeBarId: string;
  role: Role | string;
  activityType: ActivityType | null;
  features: FeatureFlags;
  initialData?: DashboardKpiData | null;
};

const CACHE_TTL_MS = 45_000;
const kpiCache = new Map<string, { data: DashboardKpiData; updatedAt: number }>();

function KpiSkeletonCard() {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 22,
        background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        border: "1px solid rgba(148, 163, 184, 0.18)",
        display: "grid",
        gap: 12,
      }}
    >
      {[
        { height: 14, width: "45%" },
        { height: 40, width: "35%" },
        { height: 12, width: "72%" },
      ].map((item, index) => (
        <div
          key={index}
          style={{
            height: item.height,
            width: item.width,
            borderRadius: 999,
            background:
              "linear-gradient(90deg, #eef2f7 0%, #f8fafc 50%, #eef2f7 100%)",
            backgroundSize: "200% 100%",
            animation: "dashboardSkeletonPulse 1.4s ease-in-out infinite",
          }}
        />
      ))}
    </div>
  );
}

function TeamTrendBar({
  label,
  value,
  max,
  tone = "purple",
}: {
  label: string;
  value: number;
  max: number;
  tone?: "purple" | "green" | "amber";
}) {
  const width = max > 0 && value > 0 ? Math.max(8, Math.round((value / max) * 100)) : 0;
  const fill =
    tone === "green"
      ? "linear-gradient(135deg, #86efac 0%, #22c55e 100%)"
      : tone === "amber"
        ? "linear-gradient(135deg, #fde68a 0%, #f59e0b 100%)"
        : "linear-gradient(135deg, #ddd6fe 0%, #8b5cf6 100%)";

  return (
    <div style={{ display: "grid", gap: 7, minWidth: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          color: "#64748b",
          fontSize: 12,
          fontWeight: 760,
        }}
      >
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div
        style={{
          height: 9,
          borderRadius: 999,
          background: "#eef2f7",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${width}%`,
            height: "100%",
            borderRadius: 999,
            background: fill,
            transition: "width 180ms ease",
          }}
        />
      </div>
    </div>
  );
}

export function KpiDashboard({
  activeBarId,
  role,
  features,
  initialData,
}: KpiDashboardProps) {
  const cached = kpiCache.get(activeBarId);
  const [data, setData] = useState<DashboardKpiData | null>(() => {
    if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) {
      return cached.data;
    }

    return initialData ?? null;
  });
  const [loading, setLoading] = useState(data === null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(() => {
    if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) {
      return cached.updatedAt;
    }

    return initialData ? Date.now() : null;
  });

  useEffect(() => {
    if (!initialData) {
      return;
    }

    const cachedEntry = kpiCache.get(activeBarId);
    if (!cachedEntry || Date.now() - cachedEntry.updatedAt >= CACHE_TTL_MS) {
      const seededAt = Date.now();
      kpiCache.set(activeBarId, { data: initialData, updatedAt: seededAt });
      setUpdatedAt(seededAt);
    }
  }, [activeBarId, initialData]);

  useEffect(() => {
    let cancelled = false;

    async function load(force = false) {
      const cached = kpiCache.get(activeBarId);

      if (!force && cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) {
        if (!cancelled) {
          setData(cached.data);
          setUpdatedAt(cached.updatedAt);
          setLoading(false);
          setError(null);
        }
        return;
      }

      if (!cancelled) {
        setLoading(true);
      }

      try {
        const response = await fetch("/api/dashboard/kpi", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = (await response.json()) as DashboardKpiResponse;

        if (!response.ok || !payload.ok) {
          throw new Error(
            payload.ok
              ? "Impossibile caricare le statistiche."
              : payload.message || "Impossibile caricare le statistiche."
          );
        }

        const nextUpdatedAt = Date.now();
        kpiCache.set(activeBarId, { data: payload.data, updatedAt: nextUpdatedAt });

        if (!cancelled) {
          setData(payload.data);
          setUpdatedAt(nextUpdatedAt);
          setError(null);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Impossibile caricare le statistiche."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    function refreshOnFocus() {
      const cached = kpiCache.get(activeBarId);
      if (!cached || Date.now() - cached.updatedAt >= CACHE_TTL_MS) {
        void load(true);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshOnFocus();
      }
    }

    function handleManualRefresh() {
      void load(true);
    }

    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener(
      "workbit:kpi-refresh",
      handleManualRefresh as EventListener
    );
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener(
        "workbit:kpi-refresh",
        handleManualRefresh as EventListener
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeBarId]);

  const roleLabel = role === "OWNER" ? "Panoramica titolare" : "Panoramica responsabile";

  const freshnessLabel = useMemo(() => {
    if (!updatedAt) {
      return "Caricamento dati";
    }

    return `Aggiornata ${new Intl.DateTimeFormat("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: APP_TIME_ZONE,
    }).format(new Date(updatedAt))}`;
  }, [updatedAt]);

  if (loading && !data) {
    return (
      <Panel title="Andamento team" action={<StatusPill tone="neutral" label={roleLabel} />}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {Array.from({ length: 3 }, (_, index) => (
            <KpiSkeletonCard key={index} />
          ))}
        </div>
      </Panel>
    );
  }

  if (error && !data) {
    return (
      <Panel title="Andamento team" action={<StatusPill tone="warning" label={roleLabel} />}>
        <EmptyState message={error} />
      </Panel>
    );
  }

  if (!data) {
    return null;
  }

  const teamStats = [
    features.shifts
      ? {
          label: "Persone oggi",
          value: String(data.today.scheduledUsers),
          detail:
            data.today.scheduledShifts > 0
              ? `${data.today.confirmedShifts}/${data.today.scheduledShifts} turni confermati`
              : "Nessun turno oggi",
        }
      : null,
    features.tasks
      ? {
          label: "Mansioni",
          value: `${data.tasks.completionRate}%`,
          detail:
            data.tasks.totalToday > 0
              ? `${data.tasks.completedToday}/${data.tasks.totalToday} completate`
              : "Nessuna mansione oggi",
        }
      : null,
    features.requests
      ? {
          label: "Richieste",
          value: String(data.requests.totalPending),
          detail: data.requests.totalPending > 0 ? "Da gestire" : "Tutto aggiornato",
        }
      : null,
    features.shifts || features.requests
      ? {
          label: "Mancanze",
          value: String(data.today.absences),
          detail:
            data.today.absences > 0
              ? `${data.today.approvedLeaves + data.today.approvedPermissions} ferie/permessi`
              : "Nessuna assenza oggi",
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const maxWeekShifts = Math.max(1, ...data.charts.shiftsCurrentWeek.map((entry) => entry.count));
  const maxTaskTotal = Math.max(1, ...data.charts.tasksLast7Days.map((entry) => entry.total));
  const maxRequests = Math.max(1, ...data.charts.requestsCurrentMonth.map((entry) => entry.count));
  const teamSignal =
    data.requests.totalPending > 0
      ? "Richieste da controllare"
      : data.tasks.openToday > 0
        ? "Mansioni ancora aperte"
        : data.today.pendingShifts > 0
          ? "Turni da confermare"
          : "Team allineato";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Panel
        title="Andamento team"
        action={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <StatusPill tone="neutral" label={roleLabel} />
            <StatusPill tone="neutral" label={freshnessLabel} />
          </div>
        }
      >
        {teamStats.length === 0 ? (
          <EmptyState message="Attiva le funzioni che vuoi monitorare dalle impostazioni." />
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            <div
              className="dashboard-kpi-team-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 0.75fr)",
                gap: 14,
                alignItems: "stretch",
              }}
            >
              <div
                style={{
                  padding: 20,
                  borderRadius: 28,
                  background:
                    "linear-gradient(135deg, rgba(245,243,255,0.98) 0%, rgba(255,255,255,0.98) 100%)",
                  border: "1px solid rgba(124, 58, 237, 0.14)",
                  boxShadow: "0 18px 38px rgba(88, 28, 135, 0.07)",
                  display: "grid",
                  gap: 16,
                  minWidth: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                  <div
                    aria-hidden="true"
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 22,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "linear-gradient(135deg, #ede9fe, #ffffff)",
                      color: "#5b21b6",
                      fontSize: 25,
                    }}
                  >
                    {"\uD83D\uDC65"}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "#64748b", fontWeight: 760, fontSize: 13 }}>
                      Stato operativo
                    </div>
                    <div style={{ color: "#0f172a", fontSize: 28, fontWeight: 850, lineHeight: 1.1 }}>
                      {teamSignal}
                    </div>
                  </div>
                </div>

                <div
                  className="dashboard-kpi-team-stats"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  {teamStats.map((item) => (
                    <div
                      key={item.label}
                      style={{
                        padding: 14,
                        borderRadius: 22,
                        background: "#ffffff",
                        border: "1px solid rgba(148, 163, 184, 0.18)",
                        display: "grid",
                        gap: 5,
                        minWidth: 0,
                      }}
                    >
                      <span style={{ color: "#64748b", fontSize: 12, fontWeight: 780 }}>
                        {item.label}
                      </span>
                      <strong style={{ color: "#0f172a", fontSize: 24, lineHeight: 1 }}>
                        {item.value}
                      </strong>
                      <span style={{ color: "#64748b", fontSize: 12, lineHeight: 1.35 }}>
                        {item.detail}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  padding: 18,
                  borderRadius: 28,
                  background: "#ffffff",
                  border: "1px solid rgba(148, 163, 184, 0.18)",
                  boxShadow: "0 14px 30px rgba(15, 23, 42, 0.05)",
                  display: "grid",
                  gap: 14,
                  alignContent: "start",
                  minWidth: 0,
                }}
              >
                <strong style={{ color: "#0f172a", fontSize: 17 }}>Turni settimana</strong>
                {features.shifts ? (
                  data.charts.shiftsCurrentWeek.map((entry) => (
                    <TeamTrendBar
                      key={entry.date}
                      label={entry.label}
                      value={entry.count}
                      max={maxWeekShifts}
                    />
                  ))
                ) : (
                  <EmptyState message="Turni non attivi." />
                )}
              </div>
            </div>

            <div
              className="dashboard-kpi-small-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              {features.tasks ? (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 24,
                    background: "#ffffff",
                    border: "1px solid rgba(148, 163, 184, 0.18)",
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <strong style={{ color: "#0f172a" }}>Mansioni ultimi 7 giorni</strong>
                  {data.charts.tasksLast7Days.map((entry) => (
                    <TeamTrendBar
                      key={entry.date}
                      label={entry.label}
                      value={entry.completed}
                      max={maxTaskTotal}
                      tone="green"
                    />
                  ))}
                </div>
              ) : null}

              {features.requests ? (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 24,
                    background: "#ffffff",
                    border: "1px solid rgba(148, 163, 184, 0.18)",
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <strong style={{ color: "#0f172a" }}>Richieste del mese</strong>
                  {data.charts.requestsCurrentMonth.map((entry) => (
                    <TeamTrendBar
                      key={entry.key}
                      label={entry.label}
                      value={entry.count}
                      max={maxRequests}
                      tone="amber"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </Panel>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes dashboardSkeletonPulse {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }

            @media (max-width: 760px) {
              .dashboard-kpi-team-grid {
                grid-template-columns: minmax(0, 1fr) !important;
              }

              .dashboard-kpi-team-stats {
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              }
            }

            @media (max-width: 420px) {
              .dashboard-kpi-team-stats {
                grid-template-columns: minmax(0, 1fr) !important;
              }
            }
          `,
        }}
      />
    </div>
  );
}
