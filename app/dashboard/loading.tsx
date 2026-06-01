import { Panel } from "./ui";

export default function Loading() {
  return (
    <div style={{ display: "grid", gap: 18, minWidth: 0, width: "100%" }}>
      <Panel title="Caricamento dashboard">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              style={{
                minHeight: 120,
                borderRadius: 22,
                border: "1px solid rgba(148, 163, 184, 0.18)",
                background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                padding: 18,
                display: "grid",
                gap: 12,
              }}
            >
              <div
                style={{
                  height: 12,
                  width: "42%",
                  borderRadius: 999,
                  background:
                    "linear-gradient(90deg, #eef2f7 0%, #f8fafc 50%, #eef2f7 100%)",
                  backgroundSize: "200% 100%",
                  animation: "dashboardLoadingPulse 1.4s ease-in-out infinite",
                }}
              />
              <div
                style={{
                  height: 34,
                  width: "36%",
                  borderRadius: 16,
                  background:
                    "linear-gradient(90deg, #eef2f7 0%, #f8fafc 50%, #eef2f7 100%)",
                  backgroundSize: "200% 100%",
                  animation: "dashboardLoadingPulse 1.4s ease-in-out infinite",
                }}
              />
            </div>
          ))}
        </div>
      </Panel>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes dashboardLoadingPulse {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `,
        }}
      />
    </div>
  );
}
