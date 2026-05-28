"use client";

import { useEffect, useState } from "react";
import { EmptyState, Panel } from "../ui";
import { SuperAdminOverviewClient } from "./overview-client";
import type { SuperAdminOverviewPayload } from "@/lib/super-admin-overview-types";

type OverviewResponse =
  | { ok: true; data: SuperAdminOverviewPayload }
  | { ok: false; message?: string };

function OverviewSkeleton() {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <Panel title="Panoramica centrale">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              style={{
                padding: 18,
                borderRadius: 22,
                background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                border: "1px solid rgba(148, 163, 184, 0.18)",
                display: "grid",
                gap: 12,
              }}
            >
              <div
                style={{
                  height: 14,
                  width: "40%",
                  borderRadius: 999,
                  background:
                    "linear-gradient(90deg, #eef2f7 0%, #f8fafc 50%, #eef2f7 100%)",
                  backgroundSize: "200% 100%",
                  animation: "dashboardSkeletonPulse 1.4s ease-in-out infinite",
                }}
              />
              <div
                style={{
                  height: 42,
                  width: "35%",
                  borderRadius: 16,
                  background:
                    "linear-gradient(90deg, #eef2f7 0%, #f8fafc 50%, #eef2f7 100%)",
                  backgroundSize: "200% 100%",
                  animation: "dashboardSkeletonPulse 1.4s ease-in-out infinite",
                }}
              />
              <div
                style={{
                  height: 12,
                  width: "78%",
                  borderRadius: 999,
                  background:
                    "linear-gradient(90deg, #eef2f7 0%, #f8fafc 50%, #eef2f7 100%)",
                  backgroundSize: "200% 100%",
                  animation: "dashboardSkeletonPulse 1.4s ease-in-out infinite",
                }}
              />
            </div>
          ))}
        </div>
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

export function SuperAdminOverviewLoader() {
  const [data, setData] = useState<SuperAdminOverviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/api/dashboard/super-admin/overview", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = (await response.json()) as OverviewResponse;

        if (!response.ok || !payload.ok) {
          throw new Error(
            payload.ok
              ? "Impossibile caricare la dashboard super admin."
              : payload.message || "Impossibile caricare la dashboard super admin."
          );
        }

        if (!cancelled) {
          setData(payload.data);
          setError(null);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Impossibile caricare la dashboard super admin."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading && !data) {
    return <OverviewSkeleton />;
  }

  if (error && !data) {
    return (
      <Panel title="Panoramica centrale">
        <EmptyState message={error} />
      </Panel>
    );
  }

  if (!data) {
    return (
      <Panel title="Panoramica centrale">
        <EmptyState message="Nessun dato disponibile." />
      </Panel>
    );
  }

  return (
    <SuperAdminOverviewClient
      summary={data.summary}
      activities={data.activities}
      owners={data.owners}
      staff={data.staff}
    />
  );
}
