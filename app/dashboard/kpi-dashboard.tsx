"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ActivityType, Role } from "@prisma/client";
import type { DashboardKpiData } from "@/lib/dashboard-kpi";
import { ArrowLinkButton, EmptyState, Panel, StatusPill } from "./ui";

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
};

const CACHE_TTL_MS = 45_000;
const kpiCache = new Map<string, { data: DashboardKpiData; updatedAt: number }>();

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

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

function KpiMetricCard({
  title,
  value,
  subtitle,
  tone = "neutral",
  footer,
}: {
  title: string;
  value: string;
  subtitle: string;
  tone?: "success" | "warning" | "danger" | "neutral";
  footer?: string;
}) {
  const accent =
    tone === "success"
      ? "linear-gradient(135deg, rgba(209,250,229,0.9), rgba(255,255,255,0.98))"
      : tone === "warning"
        ? "linear-gradient(135deg, rgba(254,240,138,0.58), rgba(255,255,255,0.98))"
        : tone === "danger"
          ? "linear-gradient(135deg, rgba(254,226,226,0.86), rgba(255,255,255,0.98))"
          : "linear-gradient(135deg, rgba(241,245,249,0.98), rgba(255,255,255,0.98))";

  return (
    <div
      style={{
        padding: 18,
        borderRadius: 22,
        background: accent,
        border: "1px solid rgba(148, 163, 184, 0.18)",
        boxShadow: "0 16px 32px rgba(15, 23, 42, 0.06)",
        display: "grid",
        gap: 8,
        minWidth: 0,
      }}
    >
      <div style={{ color: "#64748b", fontSize: 13, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 34, lineHeight: 1, fontWeight: 700, color: "#0f172a" }}>{value}</div>
      <div style={{ color: "#334155", lineHeight: 1.5 }}>{subtitle}</div>
      {footer ? <div style={{ color: "#64748b", fontSize: 13 }}>{footer}</div> : null}
    </div>
  );
}

function MiniBarChart({
  items,
  emptyMessage,
  valueKey = "count",
  secondaryKey,
}: {
  items: Array<Record<string, string | number>>;
  emptyMessage: string;
  valueKey?: string;
  secondaryKey?: string;
}) {
  const maxValue = items.reduce((current, item) => {
    const value = Number(item[valueKey] ?? 0);
    const secondary = secondaryKey ? Number(item[secondaryKey] ?? 0) : 0;
    return Math.max(current, value, secondary);
  }, 0);

  if (items.length === 0 || maxValue === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((item) => {
        const value = Number(item[valueKey] ?? 0);
        const secondary = secondaryKey ? Number(item[secondaryKey] ?? 0) : 0;
        const primaryWidth = maxValue === 0 ? 0 : (value / maxValue) * 100;
        const secondaryWidth = maxValue === 0 ? 0 : (secondary / maxValue) * 100;

        return (
          <div key={String(item.date ?? item.key ?? item.label)} style={{ display: "grid", gap: 6 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "baseline",
              }}
            >
              <strong style={{ color: "#0f172a", fontSize: 14 }}>{String(item.label)}</strong>
              <span style={{ color: "#64748b", fontSize: 13 }}>
                {secondaryKey ? `${secondary}/${value}` : value}
              </span>
            </div>
            <div
              style={{
                position: "relative",
                height: 10,
                borderRadius: 999,
                background: "#e2e8f0",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${primaryWidth}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: "linear-gradient(90deg, #0f172a 0%, #475569 100%)",
                  opacity: secondaryKey ? 0.18 : 1,
                }}
              />
              {secondaryKey ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: `${secondaryWidth}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: "linear-gradient(90deg, #16a34a 0%, #22c55e 100%)",
                  }}
                />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function KpiDashboard({ activeBarId, role, activityType }: KpiDashboardProps) {
  const [data, setData] = useState<DashboardKpiData | null>(() => {
    const cached = kpiCache.get(activeBarId);
    return cached && Date.now() - cached.updatedAt < CACHE_TTL_MS ? cached.data : null;
  });
  const [loading, setLoading] = useState(data === null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(() => {
    const cached = kpiCache.get(activeBarId);
    return cached?.updatedAt ?? null;
  });

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
              ? "Impossibile caricare i KPI."
              : payload.message || "Impossibile caricare i KPI."
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
              : "Impossibile caricare i KPI."
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

  const roleLabel = role === "OWNER" ? "Panoramica titolare" : "Panoramica manager";

  const freshnessLabel = useMemo(() => {
    if (!updatedAt) {
      return "Caricamento dati";
    }

    return `Aggiornata ${new Intl.DateTimeFormat("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(updatedAt))}`;
  }, [updatedAt]);

  if (loading && !data) {
    return (
      <div style={{ display: "grid", gap: 18 }}>
        <Panel
          title="KPI operative"
          action={<StatusPill tone="neutral" label={roleLabel} />}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            {Array.from({ length: 8 }, (_, index) => (
              <KpiSkeletonCard key={index} />
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  if (error && !data) {
    return (
      <Panel
        title="KPI operative"
        action={<StatusPill tone="warning" label={roleLabel} />}
      >
        <EmptyState message={error} />
      </Panel>
    );
  }

  if (!data) {
    return null;
  }

  const hasRequestChart = data.charts.requestsCurrentMonth.some((entry) => entry.count > 0);
  const hasShiftChart = data.charts.shiftsCurrentWeek.some((entry) => entry.count > 0);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <Panel
        title="KPI operative"
        action={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <StatusPill tone="neutral" label={roleLabel} />
            <StatusPill tone="neutral" label={freshnessLabel} />
          </div>
        }
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          <KpiMetricCard
            title="Presenti oggi"
            value={String(data.today.scheduledUsers)}
            subtitle={`${data.today.scheduledShifts} turni previsti oggi`}
            footer={
              data.today.scheduledShifts > 0
                ? `${data.today.confirmedShifts} confermati | ${data.today.pendingShifts} in attesa`
                : "Nessun turno programmato oggi"
            }
            tone="success"
          />
          <KpiMetricCard
            title="Assenti oggi"
            value={String(data.today.absences)}
            subtitle={`${data.today.approvedLeaves} ferie | ${data.today.approvedPermissions} permessi`}
            footer={`${data.today.sickness} malattie | ${data.today.unavailability} indisponibilita`}
            tone={data.today.absences > 0 ? "warning" : "neutral"}
          />
          <KpiMetricCard
            title="Richieste aperte"
            value={String(data.requests.totalPending)}
            subtitle={`${data.requests.pendingLeaves} ferie | ${data.requests.pendingPermissions} permessi`}
            footer={`${data.requests.pendingShiftSwaps} cambi turno in attesa`}
            tone={data.requests.totalPending > 0 ? "warning" : "neutral"}
          />
          <KpiMetricCard
            title="Mansioni completate"
            value={`${data.tasks.completionRate}%`}
            subtitle={`${data.tasks.completedToday}/${data.tasks.totalToday} completate oggi`}
            footer={
              data.tasks.totalToday === 0
                ? "Nessuna mansione oggi"
                : `${data.tasks.openToday} ancora aperte`
            }
            tone={data.tasks.openToday === 0 && data.tasks.totalToday > 0 ? "success" : "neutral"}
          />
          <KpiMetricCard
            title="Mansioni aperte"
            value={String(data.tasks.openToday)}
            subtitle={
              data.tasks.totalToday === 0
                ? "Nessuna mansione oggi"
                : `${data.tasks.totalToday} mansioni totali in giornata`
            }
            footer="Include team e assegnazioni individuali"
            tone={data.tasks.openToday > 0 ? "warning" : "success"}
          />
          <KpiMetricCard
            title="Turni della settimana"
            value={String(data.shifts.weekTotal)}
            subtitle={
              data.shifts.weekTotal === 0
                ? "Nessun turno programmato"
                : "Turni programmati nella settimana corrente"
            }
            footer={
              hasShiftChart
                ? `${data.shifts.byDay.filter((entry) => entry.count > 0).length} giorni con copertura`
                : "Settimana ancora vuota"
            }
            tone="neutral"
          />
          <KpiMetricCard
            title="Bacheca recente"
            value={String(data.board.last7DaysCount)}
            subtitle="Messaggi pubblicati negli ultimi 7 giorni"
            footer={
              data.board.recent[0]
                ? `Ultimo: ${data.board.recent[0].authorName}`
                : "Nessun messaggio recente"
            }
            tone="neutral"
          />
          <KpiMetricCard
            title="Corsi / formazione"
            value={String(data.training.completed)}
            subtitle={
              data.training.enabled
                ? `${data.training.expiring} in scadenza | ${data.training.pending} non completati`
                : activityType === "COMPANY"
                  ? "Nessun corso registrato"
                  : "Modulo corsi non attivo per questa attivita"
            }
            footer={
              data.training.enabled
                ? "Monitoraggio formazione corrente"
                : "KPI placeholder sicuro"
            }
            tone={data.training.expiring > 0 ? "warning" : "neutral"}
          />
        </div>
      </Panel>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 18,
          alignItems: "start",
        }}
      >
        <Panel title="Mansioni ultimi 7 giorni" action={<ArrowLinkButton href="/dashboard/tasks" />}>
          <MiniBarChart
            items={data.charts.tasksLast7Days}
            valueKey="total"
            secondaryKey="completed"
            emptyMessage="Nessuna mansione oggi o negli ultimi 7 giorni."
          />
        </Panel>

        <Panel title="Richieste del mese" action={<ArrowLinkButton href="/dashboard/requests" />}>
          {hasRequestChart ? (
            <MiniBarChart
              items={data.charts.requestsCurrentMonth}
              emptyMessage="Nessuna richiesta aperta nel mese corrente."
            />
          ) : (
            <EmptyState message="Nessuna richiesta aperta nel mese corrente." />
          )}
        </Panel>

        <Panel title="Turni della settimana" action={<ArrowLinkButton href="/dashboard/shifts" />}>
          {hasShiftChart ? (
            <MiniBarChart
              items={data.charts.shiftsCurrentWeek}
              emptyMessage="Nessun turno programmato per questa settimana."
            />
          ) : (
            <EmptyState message="Nessun turno programmato per questa settimana." />
          )}
        </Panel>
      </div>

      <Panel
        title="Bacheca recente"
        action={
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span>{data.board.last7DaysCount} ultimi 7 giorni</span>
            <Link
              href="/dashboard/board"
              style={{ color: "#0f172a", textDecoration: "none", fontWeight: 700 }}
            >
              Apri
            </Link>
          </div>
        }
      >
        {data.board.recent.length === 0 ? (
          <EmptyState message="Nessun messaggio pubblicato di recente." />
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {data.board.recent.map((note) => (
              <div
                key={note.id}
                style={{
                  padding: 16,
                  borderRadius: 18,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  <strong style={{ color: "#0f172a" }}>{note.authorName}</strong>
                  {note.isPinned ? (
                    <StatusPill tone="neutral" label="In evidenza" />
                  ) : null}
                </div>
                <div style={{ color: "#334155", lineHeight: 1.6 }}>{note.content}</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  {formatDateTime(note.createdAt)}
                </div>
              </div>
            ))}
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
          `,
        }}
      />
    </div>
  );
}
