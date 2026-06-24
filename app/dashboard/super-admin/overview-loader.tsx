import { EmptyState, Panel } from "../ui";
import { getSuperAdminOverviewData } from "@/lib/super-admin-overview";
import { SuperAdminOverviewClient } from "./overview-client";

export function OverviewSkeleton() {
  return (
    <div style={{ display: "grid", gap: 18, minWidth: 0, width: "100%" }}>
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
                minWidth: 0,
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

export async function SuperAdminOverviewLoader() {
  let data: Awaited<ReturnType<typeof getSuperAdminOverviewData>>;

  try {
    data = await getSuperAdminOverviewData();
  } catch (error) {
    console.error("[super-admin-overview] load failed", error);

    return (
      <Panel title="Panoramica centrale">
        <EmptyState message="Impossibile caricare la dashboard super admin." />
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
