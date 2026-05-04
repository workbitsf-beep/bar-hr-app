export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "linear-gradient(180deg, #f8f2e6 0%, #efe5d3 45%, #f7f4ec 100%)",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fffdf8",
          border: "1px solid #eadfc9",
          borderRadius: 24,
          padding: 28,
          boxShadow: "0 14px 36px rgba(74, 58, 27, 0.08)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 12,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#8a6f48",
          }}
        >
          Bar management
        </p>
        <h1 style={{ margin: "10px 0 8px", fontSize: 32 }}>Login</h1>
        <p style={{ margin: 0, color: "#6b7280", lineHeight: 1.6 }}>
          Sign in to access your dashboard.
        </p>

        <form style={{ display: "grid", gap: 16, marginTop: 24 }}>
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600 }}>Email</span>
            <input
              type="email"
              name="email"
              placeholder="you@example.com"
              style={{
                borderRadius: 14,
                border: "1px solid #d9cdb8",
                padding: "12px 14px",
                fontSize: 15,
                background: "#fff",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600 }}>Password</span>
            <input
              type="password"
              name="password"
              placeholder="Enter your password"
              style={{
                borderRadius: 14,
                border: "1px solid #d9cdb8",
                padding: "12px 14px",
                fontSize: 15,
                background: "#fff",
              }}
            />
          </label>

          <button
            type="submit"
            style={{
              background: "#1f2937",
              color: "#fff",
              border: 0,
              borderRadius: 999,
              padding: "12px 18px",
              fontWeight: 700,
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
