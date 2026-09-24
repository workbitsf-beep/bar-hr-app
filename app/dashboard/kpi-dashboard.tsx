"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
/** Tallest bar in the week chart, in pixels. */
const BAR_MAX_HEIGHT = 58;
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

    if (initialData) {
      const seededAt = Date.now();
      kpiCache.set(activeBarId, { data: initialData, updatedAt: seededAt });
      return initialData;
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
    let requestInFlight = false;
    const abortController = new AbortController();

    async function load(force = false) {
      if (requestInFlight) {
        return;
      }

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
      requestInFlight = true;

      try {
        const response = await fetch("/api/dashboard/kpi", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: abortController.signal,
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
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Impossibile caricare le statistiche."
          );
        }
      } finally {
        requestInFlight = false;
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
      abortController.abort();
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

  // Only what has a number, so nothing here says zero. The order is the order
  // an owner would deal with them in.
  const attention = [
    features.requests && data.requests.totalPending > 0
      ? {
          key: "requests",
          count: data.requests.totalPending,
          label: "Richieste da approvare",
          detail: [
            data.requests.pendingLeaves > 0 ? `${data.requests.pendingLeaves} ferie` : null,
            data.requests.pendingPermissions > 0
              ? `${data.requests.pendingPermissions} permessi`
              : null,
            data.requests.pendingShiftSwaps > 0
              ? `${data.requests.pendingShiftSwaps} cambi turno`
              : null,
          ]
            .filter(Boolean)
            .join(", "),
          href: "/dashboard/requests",
          urgent: true,
        }
      : null,
    features.shifts && data.today.pendingShifts > 0
      ? {
          key: "shifts",
          count: data.today.pendingShifts,
          label: "Turni da confermare",
          detail: "in programma oggi",
          href: "/dashboard/calendar",
          urgent: false,
        }
      : null,
    features.tasks && data.tasks.openToday > 0
      ? {
          key: "tasks",
          count: data.tasks.openToday,
          label: "Compiti aperti oggi",
          detail: `su ${data.tasks.totalToday} assegnati`,
          href: "/dashboard/tasks",
          urgent: false,
        }
      : null,
    // Kept from the old tile, with the breakdown it never showed.
    features.requests && data.today.absences > 0
      ? {
          key: "absences",
          count: data.today.absences,
          label: "Assenze oggi",
          detail:
            [
              data.today.approvedLeaves > 0 ? `${data.today.approvedLeaves} ferie` : null,
              data.today.approvedPermissions > 0
                ? `${data.today.approvedPermissions} permessi`
                : null,
              data.today.sickness > 0 ? `${data.today.sickness} malattia` : null,
              data.today.unavailability > 0
                ? `${data.today.unavailability} indisponibilita`
                : null,
            ]
              .filter(Boolean)
              .join(", ") || "ferie, permessi o indisponibilita",
          href: "/dashboard/requests",
          urgent: false,
        }
      : null,
    // Who is in right now is told better by the roster block on the home
    // screen, with names. It is only worth repeating here when shifts are off
    // and that block cannot appear at all.
    !features.shifts && features.timeTracking && data.today.presentUsers > 0
      ? {
          key: "present",
          count: data.today.presentUsers,
          label: "Persone presenti ora",
          detail: "entrata timbrata",
          href: "/dashboard/timelogs",
          urgent: false,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const weekDays = data.shifts.byDay;
  const busiestDay = weekDays.reduce((max, day) => Math.max(max, day.count), 0);
  const emptyDays = weekDays.filter((day) => day.count === 0);
  // en-CA gives YYYY-MM-DD, which is the shape the day entries already carry.
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
  }).format(new Date());

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* No pills in the header: side by side they wrapped onto two lines, and
          the time was already printed below. */}
      <Panel title="Andamento team">
        <div style={{ display: "grid", gap: 12 }}>
          {features.shifts ? (
            <section className="dashboard-team-card">
              <div className="dashboard-team-head">
                <strong>Turni della settimana</strong>
                <span>
                  {data.shifts.weekTotal} {data.shifts.weekTotal === 1 ? "turno" : "in totale"}
                </span>
              </div>

              <div className="dashboard-team-chart">
                {weekDays.map((day) => {
                  const isToday = day.date === todayKey;
                  // Real pixels: a percentage height has nothing to resolve
                  // against in a track sized by its own content, so every bar
                  // came out the same hairline whatever the count.
                  const height =
                    day.count === 0
                      ? 3
                      : Math.max(10, Math.round((day.count / busiestDay) * BAR_MAX_HEIGHT));

                  return (
                    <div
                      key={day.date}
                      className={`dashboard-team-bar${day.count === 0 ? " dashboard-team-bar--zero" : ""}${isToday ? " dashboard-team-bar--today" : ""}`}
                    >
                      <u>{day.count}</u>
                      <span style={{ height }} />
                    </div>
                  );
                })}
              </div>

              <div className="dashboard-team-axis">
                {weekDays.map((day) => (
                  <span
                    key={day.date}
                    className={day.date === todayKey ? "dashboard-team-axis--today" : undefined}
                  >
                    {day.label}
                  </span>
                ))}
              </div>

              {emptyDays.length > 0 ? (
                <p className="dashboard-team-foot">
                  {emptyDays.length === 1 ? (
                    <>
                      <b>{emptyDays[0].label}</b> è l&apos;unico giorno senza nessuno in turno.
                    </>
                  ) : (
                    <>
                      <b>{emptyDays.length} giorni</b> senza nessuno in turno:{" "}
                      {emptyDays.map((day) => day.label).join(", ")}.
                    </>
                  )}
                </p>
              ) : (
                <p className="dashboard-team-foot">Tutti i giorni della settimana sono coperti.</p>
              )}
            </section>
          ) : null}

          <section className="dashboard-team-card">
            <div className="dashboard-team-head">
              <strong>Da sistemare</strong>
              <span>{freshnessLabel}</span>
            </div>

            {attention.length === 0 ? (
              <p className="dashboard-team-clear">
                <i aria-hidden="true" /> Niente in attesa di te.
              </p>
            ) : (
              attention.map((item) => (
                <div
                  key={item.key}
                  className={`dashboard-team-todo${item.urgent ? " dashboard-team-todo--urgent" : ""}`}
                >
                  <span className="dashboard-team-count">{item.count}</span>
                  <div>
                    <b>{item.label}</b>
                    {item.detail}
                  </div>
                  <Link href={item.href}>Apri</Link>
                </div>
              ))
            )}
          </section>
        </div>
      </Panel>


      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes dashboardSkeletonPulse {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }

            .dashboard-team-card {
              border-radius: 22px;
              background: #ffffff;
              border: 1px solid rgba(94, 92, 230, 0.13);
              box-shadow: 0 8px 22px rgba(61, 42, 153, 0.05);
              padding: 16px;
            }

            .dashboard-team-head {
              display: flex;
              align-items: baseline;
              justify-content: space-between;
              gap: 10px;
              margin-bottom: 14px;
            }

            .dashboard-team-head strong {
              font-size: 15.5px;
              font-weight: 800;
              color: #20202a;
              letter-spacing: -0.025em;
            }

            .dashboard-team-head span {
              font-size: 12px;
              color: #667085;
              font-variant-numeric: tabular-nums;
            }

            .dashboard-team-chart {
              display: grid;
              grid-template-columns: repeat(7, minmax(0, 1fr));
              gap: 5px;
              align-items: end;
            }

            .dashboard-team-bar {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-end;
              gap: 4px;
            }

            .dashboard-team-bar u {
              text-decoration: none;
              font-size: 11px;
              font-weight: 800;
              color: #20202a;
              font-variant-numeric: tabular-nums;
            }

            .dashboard-team-bar span {
              width: 100%;
              border-radius: 7px 7px 3px 3px;
              background: linear-gradient(180deg, #a78bfa, #7c3aed);
            }

            .dashboard-team-bar--zero span {
              background: #ded9ec;
            }

            .dashboard-team-bar--zero u {
              color: #a8a3b8;
            }

            .dashboard-team-bar--today span {
              background: linear-gradient(180deg, #4c1d95, #7c3aed);
              box-shadow: 0 6px 14px rgba(124, 58, 237, 0.3);
            }

            .dashboard-team-axis {
              display: grid;
              grid-template-columns: repeat(7, minmax(0, 1fr));
              gap: 5px;
              margin-top: 8px;
            }

            /* Seven columns on a phone: the labels carry a day and a number,
               so they have to stay on one line or some wrap and some do not. */
            .dashboard-team-axis span {
              text-align: center;
              font-size: 9px;
              font-weight: 800;
              letter-spacing: 0.01em;
              text-transform: uppercase;
              color: #667085;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .dashboard-team-axis .dashboard-team-axis--today {
              color: #4c1d95;
            }

            .dashboard-team-foot {
              margin: 12px 0 0;
              padding-top: 11px;
              border-top: 1px solid rgba(94, 92, 230, 0.09);
              font-size: 12.5px;
              color: #667085;
            }

            .dashboard-team-foot b {
              color: #20202a;
              font-weight: 700;
            }

            .dashboard-team-todo {
              display: flex;
              align-items: center;
              gap: 11px;
              padding: 11px 0;
              border-top: 1px solid rgba(94, 92, 230, 0.09);
              font-size: 13.5px;
              color: #667085;
            }

            .dashboard-team-todo:first-of-type {
              border-top: 0;
              padding-top: 0;
            }

            .dashboard-team-todo b {
              display: block;
              color: #20202a;
              font-weight: 800;
              font-size: 13.5px;
            }

            .dashboard-team-count {
              min-width: 28px;
              height: 28px;
              padding: 0 7px;
              border-radius: 10px;
              display: grid;
              place-items: center;
              font-size: 14px;
              font-weight: 800;
              color: #4c1d95;
              background: #f1ecfe;
              font-variant-numeric: tabular-nums;
              flex: 0 0 auto;
            }

            .dashboard-team-todo--urgent .dashboard-team-count {
              background: #fef3c7;
              color: #92400e;
            }

            .dashboard-team-todo a {
              margin-left: auto;
              color: #7b2ff7;
              font-weight: 800;
              font-size: 12.5px;
              text-decoration: none;
              white-space: nowrap;
            }

            .dashboard-team-clear {
              display: flex;
              align-items: center;
              gap: 10px;
              margin: 0;
              font-size: 13.5px;
              color: #667085;
            }

            .dashboard-team-clear i {
              width: 7px;
              height: 7px;
              border-radius: 999px;
              background: #16a34a;
              flex: 0 0 auto;
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
