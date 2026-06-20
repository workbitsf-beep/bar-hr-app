import { Panel, Stack } from "../ui";
import { SuperAdminFrame } from "./super-admin-ui";

function SkeletonBlock({ width = "100%", height = 16 }: { width?: string; height?: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 999,
        background:
          "linear-gradient(90deg, #eef2f7 0%, #f8fafc 50%, #eef2f7 100%)",
        backgroundSize: "200% 100%",
        animation: "superAdminSkeletonPulse 1.3s ease-in-out infinite",
      }}
    />
  );
}

export default function Loading() {
  return (
    <SuperAdminFrame
      title="Panoramica"
      description="Caricamento rapido della sezione super admin."
    >
      <div style={{ display: "grid", gap: 18 }}>
        <Stack columns="repeat(auto-fit, minmax(200px, 1fr))">
          {Array.from({ length: 4 }, (_, index) => (
            <Panel key={index} title="Caricamento">
              <div style={{ display: "grid", gap: 10 }}>
                <SkeletonBlock width="22%" />
                <SkeletonBlock width="58%" height={24} />
                <SkeletonBlock width="82%" />
              </div>
            </Panel>
          ))}
        </Stack>

        <div
          style={{
            minHeight: 132,
            padding: 22,
            borderRadius: 28,
            background: "linear-gradient(135deg, #d1fae5, #ecfdf5)",
            display: "grid",
            alignContent: "center",
            gap: 12,
          }}
        >
          <SkeletonBlock width="22%" />
          <SkeletonBlock width="42%" height={30} />
          <SkeletonBlock width="32%" />
        </div>

        <Panel title="Accessi rapidi">
          <div style={{ display: "grid", gap: 12 }}>
            <SkeletonBlock width="40%" height={18} />
            <SkeletonBlock width="100%" height={90} />
          </div>
        </Panel>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes superAdminSkeletonPulse {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `,
        }}
      />
    </SuperAdminFrame>
  );
}
