import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import type { DashboardNavItem } from "./context";
import { DashboardNavMenu } from "./dashboard-nav-menu";

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDateTimeLocal(value: Date | string): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

const shellCardStyle: CSSProperties = {
  background: "rgba(255,255,255,0.92)",
  border: "1px solid rgba(15, 23, 42, 0.08)",
  borderRadius: 28,
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.07)",
  backdropFilter: "blur(16px)",
};

function DashboardResponsiveStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
      .dashboard-shell {
        min-width: 0;
      }

      .dashboard-shell *,
      .dashboard-modal-panel *,
      .super-admin-mobile-list * {
        box-sizing: border-box;
      }

      .dashboard-button,
      .dashboard-menu-button,
      .dashboard-icon-button {
        transition: transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease, background 140ms ease;
        touch-action: manipulation;
      }

      .dashboard-button:active,
      .dashboard-menu-button:active,
      .dashboard-icon-button:active {
        transform: scale(0.98);
      }

      @keyframes dashboardModalEnter {
        from {
          opacity: 0;
          transform: translateY(12px) scale(0.98);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .dashboard-form-actions,
      .dashboard-modal-actions,
      .dashboard-inline-actions,
      .dashboard-action-row,
      .dashboard-clock-actions,
      .dashboard-publish-row,
      .dashboard-toolbar {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }

      .dashboard-inline-grid,
      .dashboard-member-grid,
      .dashboard-modal-body-grid,
      .dashboard-modal-members-grid,
      .dashboard-summary-grid {
        display: grid;
        gap: 12px;
      }

      .super-admin-mobile-list {
        display: none;
      }

      .dashboard-mobile-only {
        display: none !important;
      }

      .dashboard-desktop-only {
        display: block;
      }

      .dashboard-week-strip {
        display: flex;
        gap: 16px;
        overflow-x: auto;
        padding-bottom: 6px;
        scroll-snap-type: x proximity;
        overscroll-behavior-x: contain;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      .dashboard-week-strip::-webkit-scrollbar {
        display: none;
      }

      .dashboard-week-card {
        flex: 0 0 min(86vw, 440px);
        width: min(86vw, 440px);
        max-width: calc(100vw - 56px);
        scroll-snap-align: start;
      }

      .dashboard-modal-wrap {
        padding:
          max(16px, env(safe-area-inset-top))
          max(16px, env(safe-area-inset-right))
          max(16px, env(safe-area-inset-bottom))
          max(16px, env(safe-area-inset-left));
        overflow: hidden;
        overscroll-behavior: contain;
      }

      .dashboard-modal-panel {
        width: min(92vw, 820px) !important;
        max-width: min(92vw, 820px) !important;
        max-height: 85vh !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        padding: clamp(18px, 2.8vw, 24px) !important;
        border-radius: 28px !important;
        box-shadow: 0 20px 48px rgba(15, 23, 42, 0.16) !important;
        animation: dashboardModalEnter 180ms cubic-bezier(0.22, 1, 0.36, 1);
        -webkit-overflow-scrolling: touch;
      }

      .dashboard-modal-panel > * {
        min-width: 0;
      }

      .dashboard-stack {
        align-items: start;
      }

      .dashboard-scroll-list {
        max-height: min(420px, 60vh);
        overflow-y: auto;
        padding-right: 4px;
        overscroll-behavior: contain;
      }

      @media (max-width: 900px) {
        .dashboard-shell {
          padding: 12px !important;
          font-size: 16px !important;
          overflow-x: clip;
        }

        .dashboard-shell-card,
        .dashboard-panel {
          padding: 18px !important;
          border-radius: 22px !important;
        }

        .dashboard-shell-top {
          gap: 14px !important;
        }

        .dashboard-modal-header,
        .dashboard-inline-actions,
        .dashboard-action-row,
        .dashboard-form-actions,
        .dashboard-toolbar {
          flex-direction: column !important;
          align-items: stretch !important;
        }

        .dashboard-shell-header {
          align-items: center !important;
        }

        .dashboard-shell-brand {
          gap: 6px !important;
        }

        .dashboard-shell-meta {
          display: none !important;
        }

        .dashboard-panel-title,
        .dashboard-item-card strong,
        .dashboard-list-card strong {
          font-size: 18px !important;
        }

        .dashboard-panel,
        .dashboard-item-card,
        .dashboard-list-card,
        .dashboard-summary-card,
        .dashboard-calendar-day,
        .dashboard-calendar-weekday {
          font-size: 15px !important;
        }

        .dashboard-form-actions .dashboard-button,
        .dashboard-inline-actions .dashboard-button,
        .dashboard-action-row .dashboard-button {
          width: 100% !important;
          min-width: 0 !important;
        }

        .dashboard-inline-actions > *,
        .dashboard-action-row > *,
        .dashboard-modal-actions > * {
          width: 100%;
        }

        .dashboard-top-nav {
          width: auto !important;
          justify-content: flex-end !important;
          align-items: center !important;
          gap: 8px !important;
        }

        .dashboard-header-action,
        .dashboard-top-nav .dashboard-menu-button,
        .dashboard-top-nav .dashboard-icon-button {
          flex: 0 0 auto;
        }

        .dashboard-stack {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 16px !important;
          align-items: start !important;
          overflow: visible !important;
          padding: 0 !important;
          margin: 0 !important;
        }

        .dashboard-inline-grid,
        .dashboard-member-grid,
        .dashboard-stats-grid,
        .dashboard-summary-grid {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
        }

        .dashboard-item-card,
        .dashboard-list-card,
        .dashboard-summary-card {
          padding: 16px !important;
          border-radius: 18px !important;
        }

        .dashboard-calendar-scroll {
          overflow-x: auto;
          margin-inline: -4px;
          padding-bottom: 4px;
        }

        .dashboard-calendar-grid {
          grid-template-columns: repeat(7, minmax(148px, 1fr)) !important;
          min-width: 1040px;
          gap: 10px !important;
        }

        .dashboard-calendar-day {
          min-height: 180px !important;
          padding: 14px !important;
          border-radius: 18px !important;
        }

        .dashboard-modal-wrap {
          padding:
            max(16px, env(safe-area-inset-top))
            max(16px, env(safe-area-inset-right))
            max(16px, env(safe-area-inset-bottom))
            max(16px, env(safe-area-inset-left)) !important;
          place-items: center !important;
        }

        .dashboard-modal-panel {
          width: min(92vw, 560px) !important;
          max-width: min(92vw, 560px) !important;
          max-height: 85vh !important;
          padding: 18px !important;
          border-radius: 24px !important;
          overscroll-behavior: contain;
        }

        .dashboard-modal-body-grid,
        .dashboard-modal-members-grid {
          grid-template-columns: minmax(0, 1fr) !important;
        }

        .dashboard-modal-actions > * {
          width: 100%;
        }

        .dashboard-compact-filters,
        .dashboard-publish-row {
          flex-direction: column !important;
          align-items: stretch !important;
        }

        .dashboard-publish-row > * {
          width: 100%;
        }

        .dashboard-clock-actions {
          flex-direction: column !important;
          align-items: stretch !important;
        }

        .dashboard-clock-actions > * {
          width: 100%;
        }

        .dashboard-list-button {
          flex-direction: column !important;
          align-items: flex-start !important;
        }

        .dashboard-list-button-arrow {
          align-self: flex-end;
        }

        .dashboard-table-desktop {
          display: none !important;
        }

        .dashboard-mobile-only {
          display: grid !important;
        }

        .dashboard-desktop-only {
          display: none !important;
        }

        .dashboard-mobile-only.dashboard-week-strip {
          display: flex !important;
          gap: 14px !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          padding-bottom: 6px;
        }

        .dashboard-week-card {
          flex: 0 0 min(88vw, 420px) !important;
          width: min(88vw, 420px) !important;
          max-width: calc(100vw - 48px) !important;
        }

        .super-admin-mobile-list {
          display: grid;
          gap: 12px;
        }

        .dashboard-scroll-list {
          max-height: 320px !important;
        }
      }
    `,
      }}
    />
  );
}

export function DashboardShell({
  userName,
  role,
  barName,
  appName,
  menuLabel,
  navItems,
  menuContent,
  headerAction,
  children,
}: {
  userName: string;
  role: string;
  barName: string;
  appName: string;
  menuLabel: string;
  navItems: DashboardNavItem[];
  menuContent?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main
      className="dashboard-shell"
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(241,245,249,0.98), rgba(255,255,255,0.95) 45%, rgba(248,250,252,1) 100%)",
        padding: 18,
      }}
    >
      <div
        className="dashboard-shell-inner"
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          display: "grid",
          gap: 18,
        }}
      >
        <section
          className="dashboard-shell-card"
          style={{
            ...shellCardStyle,
            padding: 22,
          }}
        >
          <div
            className="dashboard-shell-top"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
            }}
          >
            <div
              className="dashboard-shell-header"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                minWidth: 0,
              }}
            >
              <div className="dashboard-shell-brand" style={{ display: "grid", gap: 10, minWidth: 0 }}>
                <BrandLogo
                  href={navItems[0]?.href ?? "/dashboard"}
                  size={40}
                  showIcon
                  label={appName}
                  style={{ gap: 12 }}
                />
                <div className="dashboard-shell-meta" style={{ display: "grid", gap: 4 }}>
                  <h1
                    style={{
                      margin: 0,
                      fontSize: 28,
                      lineHeight: 1.05,
                      color: "#0f172a",
                      fontWeight: 700,
                    }}
                  >
                    {barName}
                  </h1>
                  <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
                    {userName} - {role}
                  </p>
                </div>
              </div>
            </div>

            <div
              className="dashboard-top-nav"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                flexShrink: 0,
              }}
            >
              {headerAction ? <div className="dashboard-header-action">{headerAction}</div> : null}
              <DashboardNavMenu
                navItems={navItems}
                menuLabel={menuLabel}
                menuContent={menuContent}
              />
            </div>
          </div>
        </section>

        <div style={{ display: "grid", gap: 18, alignItems: "start" }}>{children}</div>
      </div>
      <DashboardResponsiveStyles />
    </main>
  );
}

export function PageHero({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <section
      style={{
        ...shellCardStyle,
        padding: 28,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "grid", gap: 8 }}>
        <p
          style={{
            margin: 0,
            color: "#64748b",
            fontSize: 12,
            textTransform: "uppercase",
            fontWeight: 700,
            letterSpacing: "0.16em",
          }}
        >
          {eyebrow ?? "Workspace"}
        </p>
        <h2 style={{ margin: 0, fontSize: 30, color: "#0f172a" }}>{title}</h2>
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.7 }}>{subtitle}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </section>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={joinClassNames("dashboard-panel", className)}
      style={{
        ...shellCardStyle,
        padding: 22,
      }}
    >
      <div
        className="dashboard-panel-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <h3 className="dashboard-panel-title" style={{ margin: 0, fontSize: 20, color: "#0f172a" }}>
          {title}
        </h3>
        {action ? <div style={{ color: "#64748b", fontWeight: 600 }}>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p style={{ margin: 0, color: "#64748b", lineHeight: 1.7 }}>{message}</p>;
}

export function Stack({
  children,
  columns = "repeat(auto-fit, minmax(280px, 1fr))",
  className,
}: {
  children: ReactNode;
  columns?: string;
  className?: string;
}) {
  return (
    <div
      className={joinClassNames("dashboard-stack", className)}
      style={{
        display: "grid",
        gridTemplateColumns: columns,
        gap: 18,
        alignItems: "start",
      }}
    >
      {children}
    </div>
  );
}

export function ItemList({
  children,
  scrollable = false,
  maxHeight,
}: {
  children: ReactNode;
  scrollable?: boolean;
  maxHeight?: number | string;
}) {
  return (
    <div
      className={joinClassNames("dashboard-item-list", scrollable ? "dashboard-scroll-list" : undefined)}
      style={{
        display: "grid",
        gap: 12,
        ...(scrollable
          ? {
              maxHeight:
                typeof maxHeight === "number"
                  ? `${maxHeight}px`
                  : maxHeight ?? "min(420px, 60vh)",
              overflowY: "auto",
              paddingRight: 4,
            }
          : {}),
      }}
    >
      {children}
    </div>
  );
}

export function ItemCard({
  title,
  subtitle,
  meta,
  footer,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={joinClassNames("dashboard-item-card", className)}
      style={{
        padding: 16,
        borderRadius: 20,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        display: "grid",
        gap: 6,
      }}
    >
      <strong style={{ color: "#0f172a" }}>{title}</strong>
      {subtitle ? <div style={{ color: "#334155" }}>{subtitle}</div> : null}
      {meta ? <div style={{ color: "#64748b", fontSize: 14 }}>{meta}</div> : null}
      {footer ? <div style={{ marginTop: 8 }}>{footer}</div> : null}
    </div>
  );
}

export function FormField({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={joinClassNames("dashboard-form-field", className)} style={{ display: "grid", gap: 8 }}>
      <span style={{ fontWeight: 600, color: "#1e293b" }}>{label}</span>
      {children}
      {hint ? <span style={{ color: "#64748b", fontSize: 13 }}>{hint}</span> : null}
    </label>
  );
}

const fieldStyle: CSSProperties = {
  borderRadius: 16,
  border: "1px solid #dbe3ee",
  padding: "12px 14px",
  fontSize: 15,
  background: "#ffffff",
  width: "100%",
  color: "#0f172a",
  boxSizing: "border-box",
};

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...fieldStyle, ...props.style }} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        ...fieldStyle,
        minHeight: 110,
        resize: "vertical",
        ...props.style,
      }}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...fieldStyle, ...props.style }} />;
}

export function PrimaryButton({
  children,
  tone = "dark",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "dark" | "green" | "red" | "sand";
}) {
  const backgrounds = {
    dark: "#0f172a",
    green: "#166534",
    red: "#b91c1c",
    sand: "#475569",
  };

  return (
    <button
      {...props}
      className={joinClassNames("dashboard-button", props.className)}
      style={{
        background: backgrounds[tone],
        color: "#fff",
        border: 0,
        borderRadius: 999,
        padding: "12px 18px",
        fontWeight: 700,
        cursor: props.disabled ? "default" : "pointer",
        opacity: props.disabled ? 0.65 : 1,
        boxShadow: "0 10px 20px rgba(15, 23, 42, 0.14)",
        transition: "transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease",
        touchAction: "manipulation",
        ...props.style,
      }}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={joinClassNames("dashboard-icon-button", props.className)}
      style={{
        width: 42,
        height: 42,
        borderRadius: 999,
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
        color: "#0f172a",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: props.disabled ? "default" : "pointer",
        boxShadow: "0 6px 16px rgba(15, 23, 42, 0.04)",
        opacity: props.disabled ? 0.65 : 1,
        touchAction: "manipulation",
        ...props.style,
      }}
    >
      {children}
    </button>
  );
}

export function ArrowLinkButton({
  href,
}: {
  href: string;
}) {
  return (
    <Link
      href={href}
      className="dashboard-arrow-link"
      aria-label="Apri sezione"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: 999,
        textDecoration: "none",
        background: "#f8fafc",
        color: "#0f172a",
        border: "1px solid #e2e8f0",
        fontSize: 18,
        fontWeight: 700,
        boxShadow: "0 6px 16px rgba(15, 23, 42, 0.04)",
      }}
    >
      {">"}
    </Link>
  );
}

export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const palette = {
    neutral: { background: "#e2e8f0", color: "#475569" },
    success: { background: "#dcfce7", color: "#166534" },
    warning: { background: "#fef3c7", color: "#92400e" },
    danger: { background: "#fee2e2", color: "#991b1b" },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "6px 10px",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        ...palette[tone],
      }}
    >
      {label}
    </span>
  );
}

export function BillingRequiredState({
  role,
  showManageButton = true,
}: {
  role: string;
  showManageButton?: boolean;
}) {
  const canManageBilling = role === "OWNER" && showManageButton;

  return (
    <Panel title="Abbonamento richiesto">
      <div style={{ display: "grid", gap: 14 }}>
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.7 }}>
          Questo locale e attualmente bloccato perche l'abbonamento non e attivo.
        </p>
        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.7 }}>
          {canManageBilling
            ? "Attiva o rinnova l'abbonamento per sbloccare turni, timbrature, mansioni, bacheca e report."
            : "Contatta il titolare del locale per riattivare l'abbonamento e sbloccare le funzionalita operative."}
        </p>
        {canManageBilling ? (
          <div>
            <Link
              href="/billing"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#0f172a",
                color: "#ffffff",
                borderRadius: 999,
                padding: "12px 18px",
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 10px 20px rgba(15, 23, 42, 0.14)",
              }}
            >
              Vai al billing
            </Link>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
