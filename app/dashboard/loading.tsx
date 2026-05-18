function SkeletonBlock({
  height,
  width = "100%",
  radius = 16,
}: {
  height: number;
  width?: number | string;
  radius?: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: "linear-gradient(90deg, #eef2f7 0%, #f8fafc 50%, #eef2f7 100%)",
        backgroundSize: "200% 100%",
        animation: "dashboardSkeletonPulse 1.4s ease-in-out infinite",
      }}
    />
  );
}

function SkeletonCard({
  lines = 3,
  compact = false,
}: {
  lines?: number;
  compact?: boolean;
}) {
  return (
    <section
      style={{
        background: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(15, 23, 42, 0.08)",
        borderRadius: 24,
        boxShadow: "0 18px 40px rgba(15, 23, 42, 0.07)",
        padding: compact ? 18 : 22,
        display: "grid",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <SkeletonBlock height={20} width="42%" />
        <SkeletonBlock height={14} width={72} radius={999} />
      </div>
      {Array.from({ length: lines }, (_, index) => (
        <SkeletonBlock
          key={index}
          height={index === 0 ? 54 : 16}
          width={index === lines - 1 ? "70%" : "100%"}
          radius={index === 0 ? 18 : 12}
        />
      ))}
    </section>
  );
}

export default function DashboardLoading() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(241,245,249,0.98), rgba(255,255,255,0.95) 45%, rgba(248,250,252,1) 100%)",
        padding: 18,
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes dashboardSkeletonPulse {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }

            @media (max-width: 900px) {
              .dashboard-loading-grid {
                grid-template-columns: minmax(0, 1fr) !important;
              }
            }
          `,
        }}
      />

      <div style={{ maxWidth: 1320, margin: "0 auto", display: "grid", gap: 18 }}>
        <section
          style={{
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            borderRadius: 28,
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.07)",
            padding: 24,
            display: "grid",
            gap: 18,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 10, minWidth: 240 }}>
              <SkeletonBlock height={18} width={180} />
              <SkeletonBlock height={34} width={280} />
              <SkeletonBlock height={16} width={220} />
            </div>
            <div style={{ display: "grid", gap: 10, minWidth: 220 }}>
              <SkeletonBlock height={44} width="100%" radius={18} />
              <SkeletonBlock height={44} width="100%" radius={18} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <SkeletonBlock height={44} width={120} radius={999} />
          </div>
        </section>

        <div
          className="dashboard-loading-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 18,
          }}
        >
          <SkeletonCard lines={4} />
          <SkeletonCard lines={5} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} compact />
          <SkeletonCard lines={5} />
          <SkeletonCard lines={4} compact />
        </div>
      </div>
    </main>
  );
}
