"use client";

import type { MouseEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import type { DashboardNavItem } from "./context";
import { useOverlayLock } from "./use-overlay-lock";

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NavMenuIcon({ href }: { href: string }) {
  const common = {
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (href === "/dashboard/super-admin") {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="3.5" width="7" height="7" rx="2" {...common} />
        <rect x="13.5" y="3.5" width="7" height="7" rx="2" {...common} />
        <rect x="3.5" y="13.5" width="7" height="7" rx="2" {...common} />
        <rect x="13.5" y="13.5" width="7" height="7" rx="2" {...common} />
      </svg>
    );
  }

  if (href.includes("/super-admin/owners")) {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M15.5 19v-1.1a4.2 4.2 0 0 0-4.2-4.2H8a4.2 4.2 0 0 0-4.2 4.2V19" {...common} />
        <circle cx="9.6" cy="7.5" r="3.3" {...common} />
        <path d="M17 8h4M19 6v4" {...common} />
      </svg>
    );
  }

  if (href.includes("/super-admin/bars")) {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 10h16v10H4V10Z" {...common} />
        <path d="m3 10 2-6h14l2 6M8 20v-6h4v6M16 14h1.5" {...common} />
      </svg>
    );
  }

  if (href.includes("/super-admin/billing")) {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="3" {...common} />
        <path d="M3 10h18M7 15h4" {...common} />
      </svg>
    );
  }

  if (href.includes("/super-admin/gps")) {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" {...common} />
        <circle cx="12" cy="10" r="2.2" {...common} />
      </svg>
    );
  }

  if (href.includes("/super-admin/legal")) {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" {...common} />
        <path d="M14 3.5V8h4M9 12h6M9 15.5h6M9 19h3" {...common} />
      </svg>
    );
  }

  if (href.includes("/super-admin/system")) {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-3" {...common} />
        <path d="M7 5h10a3 3 0 0 1 3 3v8" {...common} />
      </svg>
    );
  }

  if (href.includes("/super-admin/settings")) {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="3.4" {...common} />
        <path d="M19 12a7 7 0 0 0-.12-1.3l2.02-1.54-2-3.46-2.38.96a7.3 7.3 0 0 0-2.24-1.3L14 2.8h-4l-.28 2.56a7.3 7.3 0 0 0-2.24 1.3L5.1 5.7l-2 3.46 2.02 1.54A7 7 0 0 0 5 12c0 .44.04.87.12 1.3L3.1 14.84l2 3.46 2.38-.96a7.3 7.3 0 0 0 2.24 1.3L10 21.2h4l.28-2.56a7.3 7.3 0 0 0 2.24-1.3l2.38.96 2-3.46-2.02-1.54c.08-.43.12-.86.12-1.3Z" {...common} />
      </svg>
    );
  }

  if (href === "/dashboard") {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M16 19v-1.1a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4V19" {...common} />
        <circle cx="10.5" cy="7.5" r="3.5" {...common} />
      </svg>
    );
  }

  if (href.includes("/calendar")) {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 3v3M17 3v3M4 9h16" {...common} />
        <path d="M6.5 5h11A2.5 2.5 0 0 1 20 7.5v10A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5Z" {...common} />
      </svg>
    );
  }

  if (href.includes("/tasks") || href.includes("/board")) {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 7h11M8 12h11M8 17h7" {...common} />
        <path d="m4 7 1 1 2-2M4 12l1 1 2-2M4 17l1 1 2-2" {...common} />
      </svg>
    );
  }

  if (href.includes("/documents")) {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-10Z" {...common} />
        <path d="M8 12h8M8 15h5" {...common} />
      </svg>
    );
  }

  if (href.includes("/timelogs") || href.includes("/export")) {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8" {...common} />
        <path d="M12 8v4l2.5 2.5" {...common} />
      </svg>
    );
  }

  if (href.includes("/requests") || href.includes("/availability")) {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 4h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2Z" {...common} />
        <path d="M8 9h8M8 13h5" {...common} />
      </svg>
    );
  }

  if (href.includes("/people")) {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M16.5 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" {...common} />
        <circle cx="10.2" cy="7.5" r="3.2" {...common} />
        <path d="M17 9.5a2.5 2.5 0 0 1 2 2.4M19.5 19v-1a3.5 3.5 0 0 0-2-3.2" {...common} />
      </svg>
    );
  }

  if (href.includes("/settings")) {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="3.4" {...common} />
        <path d="M19 12a7 7 0 0 0-.12-1.3l2.02-1.54-2-3.46-2.38.96a7.3 7.3 0 0 0-2.24-1.3L14 2.8h-4l-.28 2.56a7.3 7.3 0 0 0-2.24 1.3L5.1 5.7l-2 3.46 2.02 1.54A7 7 0 0 0 5 12c0 .44.04.87.12 1.3L3.1 14.84l2 3.46 2.38-.96a7.3 7.3 0 0 0 2.24 1.3L10 21.2h4l.28-2.56a7.3 7.3 0 0 0 2.24-1.3l2.38.96 2-3.46-2.02-1.54c.08-.43.12-.86.12-1.3Z" {...common} />
      </svg>
    );
  }

  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.8 14.2 9l5.6.45-4.25 3.65 1.3 5.45L12 15.65l-4.85 2.9 1.3-5.45L4.2 9.45 9.8 9 12 3.8Z" {...common} />
    </svg>
  );
}

export function DashboardNavMenu({
  navItems,
  menuLabel,
  menuContent,
  brandHref = "/dashboard",
}: {
  navItems: DashboardNavItem[];
  menuLabel: string;
  menuContent?: ReactNode;
  brandHref?: string;
}) {
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({
    top: 0,
    left: 0,
    width: 320,
  });
  useOverlayLock(open);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function syncViewportMode() {
      setIsCompact(window.innerWidth <= 1180);
    }

    syncViewportMode();
    window.addEventListener("resize", syncViewportMode);

    return () => {
      window.removeEventListener("resize", syncViewportMode);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function syncPosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      const compactMode = window.innerWidth <= 1180;
      setIsCompact(compactMode);

      if (!rect) {
        return;
      }

      const nextWidth = Math.max(304, Math.min(360, rect.width + 116));
      const nextLeft = Math.min(
        window.innerWidth - nextWidth - 18,
        Math.max(18, rect.right - nextWidth)
      );

      setPosition({
        top: rect.bottom + 12,
        left: nextLeft,
        width: nextWidth,
      });
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function handleMenuClose() {
      setOpen(false);
    }

    syncPosition();
    window.addEventListener("resize", syncPosition);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("dashboard-menu-close", handleMenuClose);

    return () => {
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("dashboard-menu-close", handleMenuClose);
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  function handleOutsidePointerDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      closeMenu();
    }
  }

  return (
    <>
      <button
        className="dashboard-menu-button"
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={menuLabel}
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          padding: 0,
          background: open ? "#e2e8f0" : "#f8fafc",
          color: open ? "#4c1d95" : "#0f172a",
          border: "1px solid rgba(124, 58, 237, 0.12)",
          fontWeight: 700,
          boxShadow: open
            ? "0 14px 28px rgba(88, 28, 135, 0.14)"
            : "0 8px 18px rgba(88, 28, 135, 0.07)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {mounted && open
        ? createPortal(
            <>
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                    @keyframes dashboardMenuEnter {
                      from { opacity: 0; }
                      to { opacity: 1; }
                    }
                  `,
                }}
              />

              <div
                className="dashboard-menu-overlay"
                onMouseDown={handleOutsidePointerDown}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 9999,
                  overflow: "hidden",
                  background: isCompact ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.28)",
                  backdropFilter: "none",
                  WebkitBackdropFilter: "none",
                  display: isCompact ? "grid" : "block",
                  placeItems: isCompact ? "center" : undefined,
                  padding: isCompact ? 16 : 0,
                }}
              >
                <nav
                  aria-label="Navigazione dashboard"
                  onMouseDown={(event) => event.stopPropagation()}
                  style={{
                    position: isCompact ? "relative" : "absolute",
                    top: isCompact ? undefined : position.top,
                    left: isCompact ? undefined : position.left,
                    width: isCompact
                      ? "min(100%, 420px)"
                      : `min(${Math.max(320, Math.min(position.width, 360))}px, calc(100vw - 36px))`,
                    maxWidth: isCompact ? "min(420px, calc(100vw - 32px))" : undefined,
                    maxHeight: "calc(100dvh - 32px)",
                    overflowY: "auto",
                    padding: isCompact ? 14 : 16,
                    borderRadius: isCompact ? 28 : 24,
                    border: "1px solid rgba(124, 58, 237, 0.12)",
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,247,255,0.97) 100%)",
                    boxShadow: "0 18px 34px rgba(88, 28, 135, 0.12)",
                    display: "grid",
                    gap: 14,
                    animation: "dashboardMenuEnter 90ms ease-out",
                    touchAction: "pan-y",
                    overscrollBehavior: "contain",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "8px 8px 12px",
                      borderBottom: "1px solid rgba(124, 58, 237, 0.10)",
                    }}
                  >
                    <BrandLogo
                      href={brandHref}
                      size={38}
                      showIcon
                      label="Workbit"
                      style={{ gap: 12 }}
                    />

                    <button
                      type="button"
                      onClick={closeMenu}
                      aria-label="Chiudi menu"
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 999,
                        border: "1px solid rgba(124, 58, 237, 0.12)",
                        background: "linear-gradient(180deg, #ffffff 0%, #f7f2ff 100%)",
                        color: "#4c1d95",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M6 6l12 12M18 6 6 18"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>

                  {navItems.length > 0 ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <span
                      style={{
                        paddingInline: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#64748b",
                      }}
                    >
                      Navigazione
                    </span>

                    {navItems.map((item) => {
                      const active =
                        pathname === item.href ||
                        (item.href !== "/dashboard" && pathname.startsWith(item.href));

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={closeMenu}
                          data-dashboard-menu-close="true"
                          style={{
                            textDecoration: "none",
                            borderRadius: 18,
                            padding: "14px 16px",
                            background: active ? "#f3e8ff" : "#ffffff",
                            color: active ? "#4c1d95" : "#0f172a",
                            border: active
                              ? "1px solid rgba(124, 58, 237, 0.36)"
                              : "1px solid rgba(124, 58, 237, 0.10)",
                            boxShadow: active ? "0 10px 22px rgba(124, 58, 237, 0.10)" : "none",
                            fontWeight: 700,
                            fontSize: 16,
                            lineHeight: 1.35,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                          }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                            <span
                              aria-hidden="true"
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 13,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flex: "0 0 auto",
                                color: active ? "#ffffff" : "#6d28d9",
                                background: active
                                  ? "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)"
                                  : "#f5f3ff",
                                boxShadow: active ? "0 10px 18px rgba(124, 58, 237, 0.20)" : "none",
                              }}
                            >
                              <NavMenuIcon href={item.href} />
                            </span>
                            <span style={{ minWidth: 0 }}>{item.label}</span>
                          </span>
                          <span style={{ color: active ? "#4c1d95" : "#64748b", display: "inline-flex", flex: "0 0 auto" }}>
                            <ArrowIcon />
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                  ) : null}

                  {menuContent ? (
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        paddingTop: 12,
                        borderTop: "1px solid rgba(124, 58, 237, 0.10)",
                      }}
                    >
                      {menuContent}
                    </div>
                  ) : null}
                </nav>
              </div>
            </>,
            document.body
          )
        : null}
    </>
  );
}
