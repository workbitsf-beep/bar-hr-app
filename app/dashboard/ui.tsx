import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { PendingButton } from "@/app/components/pending-button";
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

function getBottomNavItems(navItems: DashboardNavItem[]) {
  const preferredHrefs = [
    "/dashboard/calendar",
    "/dashboard",
    "/dashboard/tasks",
  ];
  const preferred = preferredHrefs
    .map((href) => navItems.find((item) => item.href === href))
    .filter((item): item is DashboardNavItem => Boolean(item));
  const fill = navItems.filter((item) => !preferred.some((selected) => selected.href === item.href));

  return [...preferred, ...fill].slice(0, 3);
}

function BottomNavIcon({ href }: { href: string }) {
  const common = {
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (href.includes("/calendar")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 3v3M17 3v3M4 9h16" {...common} />
        <path d="M6.5 5h11A2.5 2.5 0 0 1 20 7.5v10A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5Z" {...common} />
      </svg>
    );
  }

  if (href.includes("/tasks")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 7h11M8 12h11M8 17h7" {...common} />
        <path d="m4 7 1 1 2-2M4 12l1 1 2-2M4 17l1 1 2-2" {...common} />
      </svg>
    );
  }

  if (href.includes("/requests")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 4h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2Z" {...common} />
        <path d="M8 9h8M8 13h5" {...common} />
      </svg>
    );
  }

  if (href.includes("/super-admin/owners")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" {...common} />
        <path d="M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" {...common} />
        <path d="M19 8a3 3 0 0 1 0 6" {...common} />
        <path d="M21 19v-1a4 4 0 0 0-3-3.87" {...common} />
      </svg>
    );
  }

  if (href.includes("/super-admin/bars")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 10h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V10Z" {...common} />
        <path d="M3 10 5 4h14l2 6" {...common} />
        <path d="M9 21v-6h6v6" {...common} />
      </svg>
    );
  }

  if (href.includes("/super-admin/billing")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 7h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" {...common} />
        <path d="M3 10h18" {...common} />
        <path d="M7 15h4" {...common} />
      </svg>
    );
  }

  if (href.includes("/super-admin/gps")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 21s6-5.33 6-11a6 6 0 1 0-12 0c0 5.67 6 11 6 11Z" {...common} />
        <path d="M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" {...common} />
      </svg>
    );
  }

  if (href.includes("/super-admin")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" {...common} />
      </svg>
    );
  }

  if (href.includes("/courses")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z" {...common} />
        <path d="M8 4v13a3 3 0 0 0 3 3M9 8h6M9 12h5" {...common} />
      </svg>
    );
  }

  if (href.includes("/settings")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" {...common} />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.38a1.7 1.7 0 0 0-1 .92l-.03.08a2 2 0 0 1-3.78 0l-.03-.08A1.7 1.7 0 0 0 9.2 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.62 15a1.7 1.7 0 0 0-.92-1l-.08-.03a2 2 0 0 1 0-3.78l.08-.03A1.7 1.7 0 0 0 4.6 9.2a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.62a1.7 1.7 0 0 0 1-.92l.03-.08a2 2 0 0 1 3.78 0l.03.08a1.7 1.7 0 0 0 .96.9 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.38 9c.15.42.48.75.9.92l.08.03a2 2 0 0 1 0 3.78l-.08.03c-.42.17-.75.5-.92.92Z" {...common} />
      </svg>
    );
  }

  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.5Z" {...common} />
    </svg>
  );
}

function BottomNav({ navItems }: { navItems: DashboardNavItem[] }) {
  const bottomNavItems = getBottomNavItems(navItems);

  if (bottomNavItems.length <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Navigazione principale"
      className="dashboard-bottom-nav"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "max(12px, env(safe-area-inset-bottom))",
        transform: "translateX(-50%)",
        zIndex: 200,
        display: "flex",
        gap: 8,
        padding: 10,
        borderRadius: 999,
        border: "1px solid rgba(226, 232, 240, 0.96)",
        background: "rgba(255,255,255,0.94)",
        boxShadow: "0 18px 44px rgba(15, 23, 42, 0.16)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }}
    >
      {bottomNavItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-label={item.label}
          title={item.label}
          style={{
            width: 46,
            height: 46,
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#0f172a",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            textDecoration: "none",
          }}
        >
          <BottomNavIcon href={item.href} />
        </Link>
      ))}
    </nav>
  );
}

function DashboardResponsiveStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
      .dashboard-shell {
        min-width: 0;
        width: 100%;
        max-width: 100%;
        overflow-x: hidden;
        padding-bottom: 100px !important;
      }

      .dashboard-shell-inner,
      .dashboard-shell-card,
      .dashboard-panel,
      .dashboard-panel-header,
      .dashboard-shell-top,
      .dashboard-shell-header,
      .dashboard-shell-brand,
      .dashboard-top-nav,
      .dashboard-calendar-scroll,
      .dashboard-calendar-grid,
      .dashboard-week-strip,
      .dashboard-week-card,
      .dashboard-calendar-day,
      .dashboard-calendar-weekday,
      .dashboard-modal-wrap,
      .dashboard-modal-panel {
        min-width: 0;
        max-width: 100%;
      }

      .dashboard-shell *,
      .dashboard-modal-panel *,
      .super-admin-mobile-list * {
        box-sizing: border-box;
      }

      .dashboard-shell * {
        max-width: 100%;
      }

      .dashboard-button,
      .dashboard-menu-button,
      .dashboard-icon-button,
      .dashboard-bottom-nav a {
        transition: transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease, background 140ms ease;
        touch-action: manipulation;
      }

      .dashboard-button:active,
      .dashboard-menu-button:active,
      .dashboard-icon-button:active,
      .dashboard-bottom-nav a:active {
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
        align-items: flex-start;
        gap: 16px;
        width: 100%;
        max-width: 100%;
        overflow-x: auto;
        overflow-y: hidden;
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
        flex: 0 0 min(360px, 100%);
        align-self: flex-start;
        width: min(360px, 100%);
        max-width: 100%;
        box-sizing: border-box;
        scroll-snap-align: start;
      }

      .dashboard-week-card,
      .dashboard-week-card > *,
      .dashboard-calendar-day,
      .dashboard-calendar-day > * {
        min-width: 0;
        max-width: 100%;
      }

      .dashboard-modal-wrap {
        padding:
          max(16px, env(safe-area-inset-top))
          max(16px, env(safe-area-inset-right))
          max(16px, env(safe-area-inset-bottom))
          max(16px, env(safe-area-inset-left)) !important;
        overflow: hidden;
        overscroll-behavior: contain;
      }

      .dashboard-modal-panel {
        width: 100% !important;
        max-width: min(92vw, 820px) !important;
        max-height: calc(100dvh - 32px) !important;
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
          padding-bottom: 100px !important;
          font-size: 16px !important;
          overflow-x: hidden;
        }

        .dashboard-shell-card,
        .dashboard-panel {
          padding: 18px !important;
          border-radius: 22px !important;
          width: 100% !important;
          max-width: 100% !important;
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
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          margin-inline: 0;
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
          width: 100% !important;
          max-width: min(420px, calc(100vw - 32px)) !important;
          max-height: calc(100dvh - 32px) !important;
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
          align-items: flex-start !important;
          gap: 12px !important;
          width: 100% !important;
          max-width: 100% !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          padding-inline: 0 !important;
          margin: 0 !important;
          padding-bottom: 6px;
          scroll-snap-type: x mandatory !important;
          scroll-padding-inline: 0 !important;
        }

        .dashboard-week-card {
          flex: 0 0 100% !important;
          align-self: flex-start !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          scroll-snap-align: start !important;
          scroll-snap-stop: always !important;
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
      <BottomNav navItems={navItems} />
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
  pendingLabel,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "dark" | "green" | "red" | "sand";
  pendingLabel?: React.ReactNode;
}) {
  const backgrounds = {
    dark: "#0f172a",
    green: "#166534",
    red: "#b91c1c",
    sand: "#475569",
  };

  return (
    <PendingButton
      {...props}
      pendingLabel={pendingLabel}
      className={joinClassNames("dashboard-button", props.className)}
      style={{
        background: backgrounds[tone],
        color: "#fff",
        border: 0,
        borderRadius: 999,
        padding: "12px 18px",
        fontWeight: 700,
        boxShadow: "0 10px 20px rgba(15, 23, 42, 0.14)",
        transition: "transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease",
        touchAction: "manipulation",
        ...props.style,
      }}
      idleStyle={{
        cursor: "pointer",
        opacity: 1,
      }}
      pendingStyle={{
        cursor: "default",
        opacity: 0.65,
      }}
    >
      {children}
    </PendingButton>
  );
}

export function IconButton({
  children,
  pendingLabel,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: React.ReactNode;
}) {
  return (
    <PendingButton
      {...props}
      pendingLabel={pendingLabel}
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
        boxShadow: "0 6px 16px rgba(15, 23, 42, 0.04)",
        touchAction: "manipulation",
        ...props.style,
      }}
      idleStyle={{
        cursor: "pointer",
        opacity: 1,
      }}
      pendingStyle={{
        cursor: "default",
        opacity: 0.65,
      }}
    >
      {children}
    </PendingButton>
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
              href="/dashboard/settings"
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
              Vai all'abbonamento
            </Link>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
