import type { CSSProperties, ReactNode } from "react";
// The dashboard's responsive sheet, 115,000 characters that used to be an
// inline <style> rebuilt on every request and sent twice per page. Loaded
// before the app-shell styles below, which still override it.
import "./dashboard.css";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ConfirmationToast } from "@/app/components/confirmation-toast";
import { PendingButton } from "@/app/components/pending-button";
import { RevealOnScroll } from "@/app/components/workbit-animations";
import { ActiveBottomNav } from "./bottom-nav";
import {
  formatDateInTimeZone,
  formatDateTimeInTimeZone,
  formatDateTimeLocalInTimeZone,
} from "@/lib/time-zone";
import type { DashboardNavItem } from "./context";
import { BarHeaderSwitcher } from "./bar-logo-switcher";
import { DashboardNavMenu } from "./dashboard-nav-menu";

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function formatDate(value: Date | string): string {
  return formatDateInTimeZone(value);
}

export function formatDateTime(value: Date | string): string {
  return formatDateTimeInTimeZone(value);
}

export function formatDateTimeLocal(value: Date | string): string {
  return formatDateTimeLocalInTimeZone(value);
}

const shellCardStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(60, 60, 67, 0.12)",
  borderRadius: 18,
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
  backdropFilter: "none",
};

const softCardStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(60, 60, 67, 0.12)",
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
};


function resolveUiEmoji(title: string) {
  const normalized = title.toLowerCase();

  if (normalized.includes("riepilog") || normalized.includes("kpi")) return "\uD83D\uDCCA";
  if (normalized.includes("gestir") || normalized.includes("attivit")) return "\uD83D\uDDC2\uFE0F";
  if (normalized.includes("profil")) return "\uD83D\uDC64";
  if (normalized.includes("person") || normalized.includes("team") || normalized.includes("dipendent")) return "\uD83D\uDC65";
  if (normalized.includes("calend")) return "\uD83D\uDCC6";
  if (normalized.includes("turn")) return "\uD83D\uDD52";
  if (normalized.includes("richiest") || normalized.includes("chius") || normalized.includes("permess")) return "\uD83D\uDCDD";
  if (normalized.includes("mansion") || normalized.includes("note")) return "\u2705";
  if (normalized.includes("bacheca") || normalized.includes("messagg")) return "\uD83D\uDCE2";
  if (normalized.includes("cors") || normalized.includes("formaz")) return "\uD83C\uDF93";
  if (normalized.includes("document")) return "\uD83D\uDCC1";
  if (normalized.includes("timbr")) return "\uD83D\uDD58";
  if (normalized.includes("ore")) return "\u23F3";
  if (normalized.includes("impost")) return "\u2699\uFE0F";
  if (normalized.includes("export") || normalized.includes("report") || normalized.includes("pdf")) return "\uD83D\uDCC4";
  if (normalized.includes("sicurezza") || normalized.includes("password")) return "\uD83D\uDD12";
  if (normalized.includes("abbon") || normalized.includes("pagament") || normalized.includes("ricav")) return "\uD83D\uDCB3";
  if (normalized.includes("gps") || normalized.includes("posizion")) return "\uD83D\uDCCD";
  if (normalized.includes("dashboard") || normalized.includes("panoramica")) return "\uD83D\uDCCA";

  return "\uD83D\uDCCB";
}

function getTodayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getBottomNavItems(navItems: DashboardNavItem[]) {
  const preferredHrefs = [
    "/dashboard",
    "/dashboard/calendar",
    "/dashboard/tasks",
    "/dashboard/documents",
    "/dashboard/timelogs",
    "/dashboard/requests",
  ];
  const preferred = preferredHrefs
    .map((href) => navItems.find((item) => item.href === href))
    .filter((item): item is DashboardNavItem => Boolean(item));
  const fill = navItems.filter((item) => !preferred.some((selected) => selected.href === item.href));

  return [...preferred, ...fill].slice(0, 5);
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
  menuFooter,
  belowHeader,
  brandContent,
  headerSwitch,
  children,
}: {
  userName: string;
  role: string;
  barName: string;
  appName: string;
  menuLabel: string;
  navItems: DashboardNavItem[];
  menuContent?: ReactNode;
  /** Sits at the foot of the menu: the way out. */
  menuFooter?: ReactNode;
  headerAction?: ReactNode;
  belowHeader?: ReactNode;
  brandContent?: ReactNode;
  headerSwitch?: {
    activeBarId: string | null;
    bars: Array<{ id: string; name: string }>;
  };
  children: ReactNode;
}) {
  const bottomNavItems = getBottomNavItems(navItems);
  const menuNavItems =
    bottomNavItems.length > 1
      ? navItems.filter(
          (item) => !bottomNavItems.some((bottomItem) => bottomItem.href === item.href)
        )
      : navItems;

  const headerCard = (
    <RevealOnScroll
      as="section"
      className="dashboard-shell-card"
      style={{
        ...shellCardStyle,
        borderRadius: 28,
        padding: "14px 18px",
        boxShadow: "0 6px 16px rgba(61, 42, 153, 0.08)",
      }}
    >
      <div
        className="dashboard-shell-top"
        style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
        }}
      >
        <div
          className="dashboard-shell-header"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
          }}
        >
          <div className="dashboard-shell-brand" style={{ display: "grid", gap: 6, minWidth: 0 }}>
            {brandContent ?? (
              <BrandLogo
                href={navItems[0]?.href ?? "/dashboard"}
                size={34}
                showIcon
                label={appName}
                style={{ gap: 10 }}
              />
            )}
            <div className="dashboard-shell-meta" style={{ display: "grid", gap: 4 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 22,
                  lineHeight: 1.05,
                  color: "var(--workbit-navy)",
                  fontWeight: 800,
                }}
              >
                {barName}
              </h1>
              <p style={{ margin: 0, color: "var(--workbit-muted)", lineHeight: 1.35, fontSize: 13, fontWeight: 600 }}>
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
            navItems={menuNavItems}
            menuLabel={menuLabel}
            menuContent={menuContent}
            logoutAction={menuFooter}
            brandHref={navItems[0]?.href ?? "/dashboard"}
            headerAction={headerAction}
          />
        </div>
      </div>
    </RevealOnScroll>
  );

  return (
    <main
      className="dashboard-shell workbit-animated-page"
      style={{
        position: "fixed",
        inset: 0,
        isolation: "isolate",
        display: "flex",
        flexDirection: "column",
        background: "transparent",
        padding: 0,
      }}
    >
      <div
        className="wb-shell-head dashboard-shell-inner workbit-animated-page__content"
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: 1320,
          margin: "0 auto",
          display: "grid",
          gap: 0,
          width: "100%",
        }}
      >
        {headerSwitch ? (
          <BarHeaderSwitcher activeBarId={headerSwitch.activeBarId} bars={headerSwitch.bars}>
            {headerCard}
          </BarHeaderSwitcher>
        ) : (
          headerCard
        )}

        {belowHeader ? (
          <div
            className="dashboard-shell-below-header"
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: 0,
              marginTop: 16,
              marginBottom: 0,
              pointerEvents: "none",
            }}
          >
            {belowHeader}
          </div>
        ) : null}
      </div>

      {/* The page scrolls inside this band, between the two fixed bars, so
          content is clipped at their edges instead of sliding behind them. */}
      <div className="wb-shell-scroll">
        <div
          className="dashboard-shell-inner"
          style={{ maxWidth: 1320, margin: "0 auto", width: "100%" }}
        >
          <div
            className="dashboard-shell-content"
            style={{ display: "grid", gap: 18, alignItems: "start", minWidth: 0 }}
          >
            {children}
          </div>
        </div>
      </div>

      <ActiveBottomNav navItems={navItems} />
      <DashboardAppShellStyles />
    </main>
  );
}

/**
 * Turns the venue app into a fixed shell: a header that stays put, a scrolling
 * band, and a docked navigation bar. Declared after the responsive sheet so
 * these win over the rules written for the older scrolling page.
 */
function DashboardAppShellStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          .dashboard-shell {
            position: fixed !important;
            inset: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            padding: 0 !important;
            min-height: 0 !important;
          }

          .wb-shell-head {
            flex: 0 0 auto;
            padding: max(env(safe-area-inset-top, 0px), var(--wb-inset-top, 0px)) 10px 0 !important;
          }

          /* The page scrolls here, clipped at the header. The bottom is left
             open on purpose: the navigation bar floats over the content, which
             is the behaviour that was right before. */
          .wb-shell-scroll {
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
            overflow-x: hidden;
            overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch;
            padding: 12px 10px calc(124px + max(env(safe-area-inset-bottom, 0px), var(--wb-inset-bottom, 0px)));
          }

          /* Closer to the edges of the phone than the old narrow column. */
          .dashboard-shell-inner {
            max-width: 760px !important;
            width: 100% !important;
          }

          .dashboard-bottom-nav {
            width: min(430px, calc(100% - 20px)) !important;
            max-width: calc(100% - 20px) !important;
          }
        `,
      }}
    />
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
    <RevealOnScroll
      as="section"
      className="dashboard-page-hero"
      style={{
        ...shellCardStyle,
        padding: "16px 18px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            aria-hidden="true"
            style={{
              width: "auto",
              height: "auto",
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              color: "var(--workbit-purple-dark)",
              fontSize: 25,
            }}
          >
            {resolveUiEmoji(title)}
          </span>
          <p
            style={{
              margin: 0,
              color: "var(--workbit-muted)",
              fontSize: 12,
              textTransform: "uppercase",
              fontWeight: 700,
              letterSpacing: "0.16em",
            }}
          >
            {eyebrow ?? "Workspace"}
          </p>
        </div>
        <h2 style={{ margin: 0, fontSize: 21, color: "#1C1C1E", fontWeight: 850, letterSpacing: "-0.02em" }}>
          {title}
        </h2>
        <p style={{ margin: 0, color: "var(--workbit-muted)", lineHeight: 1.45, fontSize: 13.5, fontWeight: 500 }}>
          {subtitle}
        </p>
      </div>
      {action ? <div>{action}</div> : null}
    </RevealOnScroll>
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
    <RevealOnScroll
      as="section"
      className={joinClassNames("dashboard-panel", className)}
      style={{
        ...shellCardStyle,
        padding: 16,
      }}
    >
      <div
        className="dashboard-panel-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              width: "auto",
              height: "auto",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              color: "inherit",
              fontSize: 21,
              flex: "0 0 auto",
            }}
          >
            {resolveUiEmoji(title)}
          </span>
          <h3 className="dashboard-panel-title" style={{ margin: 0, fontSize: 17, color: "#1C1C1E", fontWeight: 800 }}>
            {title}
          </h3>
        </div>
        {action ? <div style={{ color: "#64748b", fontWeight: 600 }}>{action}</div> : null}
      </div>
      {children}
    </RevealOnScroll>
  );
}

export function Card({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <RevealOnScroll
      as="section"
      className={joinClassNames("dashboard-card", className)}
      style={{
        ...shellCardStyle,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </RevealOnScroll>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className="dashboard-section-header"
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 14,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              width: "auto",
              height: "auto",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              color: "inherit",
              fontSize: 18,
              flex: "0 0 auto",
            }}
          >
            {resolveUiEmoji(title)}
          </span>
          <h3 style={{ margin: 0, color: "#0f172a", fontSize: 20, letterSpacing: "-0.02em" }}>
            {title}
          </h3>
        </div>
        {subtitle ? (
          <div style={{ color: "#64748b", lineHeight: 1.55, fontSize: 14 }}>{subtitle}</div>
        ) : null}
      </div>
      {action ? <div style={{ flex: "0 0 auto" }}>{action}</div> : null}
    </div>
  );
}

export function Modal({
  title,
  children,
  footer,
  onClose,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div
      className="dashboard-modal-wrap"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483646,
        display: "grid",
        placeItems: "center",
        background: "rgba(15, 23, 42, 0.22)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <section
        className="dashboard-modal-panel"
        style={{ ...shellCardStyle, display: "grid", gap: 14, padding: 20, borderRadius: 30 }}
      >
        <div
          className="dashboard-modal-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <SectionHeader title={title} />
          {onClose ? (
            <IconButton type="button" onClick={onClose} aria-label="Chiudi">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6 6 18"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </IconButton>
          ) : null}
        </div>
        <div style={{ display: "grid", gap: 14, minWidth: 0 }}>{children}</div>
        {footer ? <div className="dashboard-modal-actions">{footer}</div> : null}
      </section>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="dashboard-empty-state"
      style={{
        ...softCardStyle,
        borderRadius: 18,
        padding: 14,
        color: "var(--workbit-muted)",
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
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
                  : maxHeight ?? "min(420px, calc(var(--workbit-vh, 100dvh) * 0.6))",
              overflowY: "auto",
              paddingRight: 0,
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
  style,
}: {
  title: string;
  subtitle?: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <RevealOnScroll
      className={joinClassNames("dashboard-item-card", className)}
      style={{
        ...softCardStyle,
        padding: 14,
        borderRadius: 18,
        display: "grid",
        gap: 6,
        ...style,
      }}
    >
      <strong style={{ color: "#1C1C1E", fontSize: 14.5, fontWeight: 700 }}>{title}</strong>
      {subtitle ? <div style={{ color: "#8E8E93", fontSize: 13.5, lineHeight: 1.45 }}>{subtitle}</div> : null}
      {meta ? <div style={{ color: "var(--workbit-muted)", fontSize: 14 }}>{meta}</div> : null}
      {footer ? <div style={{ marginTop: 8 }}>{footer}</div> : null}
    </RevealOnScroll>
  );
}

export function CompactListItem({
  title,
  subtitle,
  meta,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <RevealOnScroll
      className="dashboard-compact-list-item"
      style={{
        ...softCardStyle,
        borderRadius: 18,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
        <strong style={{ color: "#1C1C1E", fontSize: 14.5, fontWeight: 700 }}>{title}</strong>
        {subtitle ? <span style={{ color: "#8E8E93", fontSize: 12.5, lineHeight: 1.35 }}>{subtitle}</span> : null}
        {meta ? <span style={{ color: "var(--workbit-muted)", fontSize: 12, fontWeight: 700 }}>{meta}</span> : null}
      </div>
      {action ? <div style={{ flex: "0 0 auto" }}>{action}</div> : null}
    </RevealOnScroll>
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
      <span style={{ fontWeight: 600, color: "var(--workbit-navy)" }}>{label}</span>
      {children}
      {hint ? <span style={{ color: "var(--workbit-muted)", fontSize: 13 }}>{hint}</span> : null}
    </label>
  );
}

const fieldStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(60, 60, 67, 0.12)",
  padding: "13px 15px",
  fontSize: 15,
  background: "#ffffff",
  width: "100%",
  color: "#1C1C1E",
  boxSizing: "border-box",
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
};

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  if (props.type !== "date") {
    return <input {...props} style={{ ...fieldStyle, ...props.style }} />;
  }

  const today = getTodayInputValue();
  const min = typeof props.min === "string" && props.min > today ? props.min : today;
  const value = typeof props.value === "string" && props.value && props.value < min ? min : props.value;

  return (
    <input
      {...props}
      min={min}
      value={value}
      style={{ ...fieldStyle, ...props.style }}
    />
  );
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
  return (
    <select
      {...props}
      style={{
        ...fieldStyle,
        appearance: "none",
        backgroundImage:
          "linear-gradient(45deg, transparent 50%, var(--workbit-purple-dark) 50%), linear-gradient(135deg, var(--workbit-purple-dark) 50%, transparent 50%)",
        backgroundPosition: "calc(100% - 18px) 52%, calc(100% - 12px) 52%",
        backgroundSize: "6px 6px, 6px 6px",
        backgroundRepeat: "no-repeat",
        paddingRight: 38,
        ...props.style,
      }}
    />
  );
}

export function ResetLink({ href, children = "Reset" }: { href: string; children?: ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        padding: "12px 16px",
        textDecoration: "none",
        background: "#f8fafc",
        color: "#0f172a",
        border: "1px solid #e2e8f0",
        fontWeight: 700,
      }}
    >
      {children}
    </Link>
  );
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
    dark: "var(--workbit-gradient)",
    green: "linear-gradient(135deg, #15803d 0%, #22c55e 58%, #4ade80 100%)",
    red: "linear-gradient(135deg, #b91c1c 0%, #ef4444 58%, #fb7185 100%)",
    sand: "linear-gradient(180deg, var(--workbit-surface-elevated) 0%, var(--workbit-purple-soft) 100%)",
  };

  return (
    <PendingButton
      {...props}
      data-tone={tone}
      pendingLabel={pendingLabel}
      className={joinClassNames("dashboard-button", props.className)}
      style={{
        background: backgrounds[tone],
        color: tone === "sand" ? "var(--workbit-navy)" : "#ffffff",
        border: tone === "sand" ? "1px solid var(--workbit-border)" : tone === "red" ? "1px solid rgba(239, 68, 68, 0.75)" : tone === "green" ? "1px solid rgba(34, 197, 94, 0.75)" : 0,
        borderRadius: 999,
        minHeight: 38,
        padding: "9px 15px",
        fontSize: 13,
        fontWeight: 760,
        letterSpacing: "-0.01em",
        boxShadow: "0 10px 22px rgba(124, 58, 237, 0.13)",
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

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "dark" | "green" | "red" | "sand";
  pendingLabel?: React.ReactNode;
}) {
  return <PrimaryButton {...props} />;
}

export function IconButton({
  children,
  pendingLabel,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: React.ReactNode;
}) {
  const ariaLabel = typeof props["aria-label"] === "string" ? props["aria-label"] : "";
  const intent = /elimina|rimuovi|cancella/i.test(ariaLabel)
    ? "danger"
    : /aggiungi|nuov[oa]/i.test(ariaLabel)
      ? "add"
      : /completa|conferma|salva|approva/i.test(ariaLabel)
        ? "confirm"
        : "neutral";
  const symbol = typeof children === "string" ? children.trim() : "";
  const iconChildren =
    symbol === "+" ? (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ) : symbol === "✓" || symbol === "✔" ? (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="m5.5 12.5 4 4 9-9"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ) : (
      children
    );

  return (
    <PendingButton
      {...props}
      data-intent={intent}
      pendingLabel={pendingLabel}
      className={joinClassNames("dashboard-icon-button", props.className)}
      style={{
        width: 36,
        height: 36,
        borderRadius: 999,
        border: "1px solid var(--workbit-border)",
        background: "linear-gradient(180deg, var(--workbit-surface-elevated) 0%, var(--workbit-purple-soft) 100%)",
        color: "var(--workbit-purple-dark)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 8px 18px rgba(124, 58, 237, 0.08)",
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
      {iconChildren}
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
        width: 32,
        height: 32,
        borderRadius: 999,
        textDecoration: "none",
        background: "linear-gradient(180deg, var(--workbit-surface-elevated) 0%, var(--workbit-purple-soft) 100%)",
        color: "var(--workbit-purple-dark)",
        border: "1px solid var(--workbit-border)",
        fontSize: 16,
        fontWeight: 700,
        boxShadow: "0 8px 18px rgba(124, 58, 237, 0.08)",
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
    neutral: { background: "#f7f3ff", color: "#5b21b6", border: "1px solid rgba(124, 58, 237, 0.16)" },
    success: { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" },
    warning: { background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" },
    danger: { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" },
  };

  return (
    <span
      className="dashboard-status-pill"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: tone === "success" ? 6 : 0,
        borderRadius: 999,
        padding: "6px 10px",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        ...palette[tone],
      }}
    >
      {tone === "success" ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M2.25 6.25 4.75 8.75 9.75 3.75"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
      {label}
    </span>
  );
}

export function Badge(props: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return <StatusPill {...props} />;
}

export function SuccessCallout({
  children,
  style: _style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  void _style;
  return <ConfirmationToast>{children}</ConfirmationToast>;
}

export function StatusBanner({
  kind,
  text,
}: {
  kind: "success" | "warning" | "error";
  text: string;
}) {
  if (kind === "success") {
    return <SuccessCallout style={{ fontSize: 14 }}>{text}</SuccessCallout>;
  }

  const palette =
    kind === "warning"
      ? { background: "#fff7ed", border: "#fed7aa", color: "#c2410c" }
      : { background: "#fef2f2", border: "#fecaca", color: "#b91c1c" };

  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 16,
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.color,
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
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
          Questo locale e attualmente bloccato perche l&apos;abbonamento non e attivo.
        </p>
        <p
          className={canManageBilling ? "wb-web-only" : undefined}
          style={{ margin: 0, color: "#64748b", lineHeight: 1.7 }}
        >
          {canManageBilling
            ? "Attiva o rinnova l’abbonamento per sbloccare turni, timbrature, mansioni, bacheca e report."
            : "Contatta il titolare del locale per riattivare l’abbonamento e sbloccare le funzionalita operative."}
        </p>
        {canManageBilling ? (
          <p className="wb-native-only" style={{ margin: 0, color: "#64748b", lineHeight: 1.7 }}>
            L&apos;abbonamento del locale si gestisce dall&apos;area titolare di Workbit sul web.
          </p>
        ) : null}
        {canManageBilling ? (
          <div className="wb-web-only">
            <Link
              href="/dashboard/settings?billing=1"
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
              Vai all&apos;abbonamento
            </Link>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
