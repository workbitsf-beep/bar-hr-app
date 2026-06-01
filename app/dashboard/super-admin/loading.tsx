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
      title="Hub super admin"
      description="Caricamento vista leggera per titolari, attività, abbonamenti e utenti."
    >
      <div style={{ display: "grid", gap: 18 }}>
        <Stack columns="repeat(auto-fit, minmax(220px, 1fr))">
          {Array.from({ length: 4 }, (_, index) => (
            <Panel key={index} title="Caricamento">
              <div style={{ display: "grid", gap: 10 }}>
                <SkeletonBlock width="45%" />
                <SkeletonBlock width="70%" height={24} />
                <SkeletonBlock width="85%" />
              </div>
            </Panel>
          ))}
        </Stack>

        <Panel title="Ricerca rapida">
          <div style={{ display: "grid", gap: 12 }}>
            <SkeletonBlock width="60%" height={18} />
            <SkeletonBlock width="100%" height={42} />
            <SkeletonBlock width="40%" height={18} />
          </div>
        </Panel>

        <Stack columns="minmax(0, 1.1fr) minmax(0, 0.9fr)">
          <Panel title="Strutture">
            <div style={{ display: "grid", gap: 12 }}>
              <SkeletonBlock width="55%" height={18} />
              <SkeletonBlock width="100%" height={80} />
              <SkeletonBlock width="100%" height={80} />
            </div>
          </Panel>
          <Panel title="Utenti">
            <div style={{ display: "grid", gap: 12 }}>
              <SkeletonBlock width="45%" height={18} />
              <SkeletonBlock width="100%" height={72} />
              <SkeletonBlock width="100%" height={72} />
            </div>
          </Panel>
        </Stack>
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
