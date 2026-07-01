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
          label: "In turno oggi",
          value: String(data.today.scheduledUsers),
          detail:
            data.today.scheduledShifts > 0
              ? `${data.today.scheduledShifts} turni programmati`
              : "Nessun turno oggi",
        }
      : null,
    features.tasks
      ? {
          label: "Hanno fatto",
          value: String(data.tasks.completedToday),
          detail:
            data.tasks.totalToday > 0
              ? `su ${data.tasks.totalToday} note`
              : "Nessuna nota oggi",
        }
      : null,
    features.requests
      ? {
          label: "Presente oggi",
          value: String(Math.max(0, data.today.scheduledUsers - data.today.absences)),
          detail: "personale operativo",
        }
      : null,
    features.shifts || features.requests
      ? {
          label: "Assente oggi",
          value: String(data.today.absences),
          detail:
            data.today.absences > 0
              ? "ferie, permessi o indisponibilita"
              : "nessuna assenza",
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const teamSignal =
    data.requests.totalPending > 0
      ? "Richieste da controllare"
      : data.tasks.openToday > 0
        ? "Note ancora aperte"
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
          <div
            style={{
              display: "grid",
              gap: 14,
              padding: 18,
              borderRadius: 28,
              background:
                "linear-gradient(135deg, rgba(245,243,255,0.98) 0%, rgba(255,255,255,0.98) 100%)",
              border: "1px solid rgba(124, 58, 237, 0.14)",
              boxShadow: "0 18px 38px rgba(88, 28, 135, 0.07)",
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0 }}>
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
                    flex: "0 0 auto",
                  }}
                >
                  {"\uD83D\uDC65"}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: "#64748b", fontWeight: 760, fontSize: 13 }}>
                    Stato team
                  </div>
                  <div style={{ color: "#0f172a", fontSize: 26, fontWeight: 850, lineHeight: 1.1 }}>
                    {teamSignal}
                  </div>
                </div>
              </div>

              {features.tasks ? (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 22,
                    background: "#ffffff",
                    border: "1px solid rgba(148, 163, 184, 0.18)",
                    minWidth: 140,
                  }}
                >
                  <div style={{ color: "#64748b", fontSize: 12, fontWeight: 760 }}>
                    Note oggi
                  </div>
                  <div style={{ color: "#4c1d95", fontSize: 25, fontWeight: 850 }}>
                    {data.tasks.completionRate}%
                  </div>
                </div>
              ) : null}
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
                    padding: "12px 10px",
                    borderRadius: 20,
                    background: "#ffffff",
                    border: "1px solid rgba(148, 163, 184, 0.16)",
                    display: "grid",
                    gap: 4,
                    minWidth: 0,
                  }}
                >
                  <span style={{ color: "#64748b", fontSize: 11, fontWeight: 780 }}>
                    {item.label}
                  </span>
                  <strong style={{ color: "#0f172a", fontSize: 20, lineHeight: 1 }}>
                    {item.value}
                  </strong>
                  <span style={{ color: "#64748b", fontSize: 11, lineHeight: 1.3 }}>
                    {item.detail}
                  </span>
                </div>
              ))}
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
