"use client";

import { useEffect, useMemo, useState } from "react";
import type { ActivityType, Role } from "@prisma/client";
import type { DashboardKpiData } from "@/lib/dashboard-kpi";
import type { FeatureFlags } from "@/lib/features";
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
  tone?: "success" | "warning" | "danger" | "neutral" | "purple";
  footer?: string;
}) {
  const accent =
    tone === "success"
      ? "linear-gradient(135deg, rgba(209,250,229,0.9), rgba(255,255,255,0.98))"
      : tone === "warning"
      ? "linear-gradient(135deg, rgba(254,240,138,0.58), rgba(255,255,255,0.98))"
      : tone === "danger"
        ? "linear-gradient(135deg, rgba(254,226,226,0.86), rgba(255,255,255,0.98))"
        : tone === "purple"
          ? "linear-gradient(135deg, rgba(237,233,254,0.9), rgba(255,255,255,0.98))"
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
            {Array.from({ length: 4 }, (_, index) => (
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

  const summaryCards = [
    features.shifts
      ? {
          key: "today",
          title: "📅 Presenti oggi",
          value: String(data.today.scheduledUsers),
          subtitle:
            data.today.scheduledShifts > 0
              ? `${data.today.scheduledShifts} turni, ${data.today.confirmedShifts} confermati`
              : "Nessun turno oggi",
          footer: `${data.today.pendingShifts} in attesa`,
          tone: "purple" as const,
        }
      : null,
    features.requests
      ? {
          key: "requests",
          title: "📝 Richieste",
          value: String(data.requests.totalPending),
          subtitle:
            data.requests.totalPending === 0
              ? "Tutto aggiornato"
              : "Da controllare",
          footer: `${data.requests.pendingLeaves} ferie, ${data.requests.pendingPermissions} permessi`,
          tone: data.requests.totalPending > 0 ? ("warning" as const) : ("neutral" as const),
        }
      : null,
    features.tasks
      ? {
          key: "tasks",
          title: "✅ Mansioni",
          value: `${data.tasks.completionRate}%`,
          subtitle:
            data.tasks.totalToday === 0
              ? "Nessuna mansione oggi"
              : `${data.tasks.completedToday}/${data.tasks.totalToday} completate`,
          footer: `${data.tasks.openToday} aperte`,
          tone:
            data.tasks.openToday === 0 && data.tasks.totalToday > 0
              ? ("success" as const)
              : ("neutral" as const),
        }
      : null,
    features.noticeBoard || features.courses
      ? {
          key: "team",
          title: "📢 Team",
          value: String(data.board.last7DaysCount + data.training.pending + data.training.expiring),
          subtitle:
            features.noticeBoard && features.courses
              ? "Bacheca e corsi"
              : features.noticeBoard
                ? "Messaggi recenti"
                : "Corsi da seguire",
          footer: `${data.board.last7DaysCount} messaggi, ${data.training.pending} corsi aperti`,
          tone: "purple" as const,
        }
      : null,
  ].filter((card): card is NonNullable<typeof card> => Boolean(card));

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Panel
        title="Panoramica rapida"
        action={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <StatusPill tone="neutral" label={roleLabel} />
            <StatusPill tone="neutral" label={freshnessLabel} />
          </div>
        }
      >
        {summaryCards.length === 0 ? (
          <EmptyState message="Attiva le funzioni che vuoi monitorare dalle impostazioni." />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 12,
            }}
          >
            {summaryCards.map((card) => (
              <KpiMetricCard
                key={card.key}
                title={card.title}
                value={card.value}
                subtitle={card.subtitle}
                footer={card.footer}
                tone={card.tone}
              />
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
