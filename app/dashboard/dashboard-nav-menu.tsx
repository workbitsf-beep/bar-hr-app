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

/** The colour each destination wears in the rest of the app. */
const MENU_DOTS: Record<string, string> = {
  "/dashboard": "#4c1d95",
  "/dashboard/calendar": "#6d5ce7",
  "/dashboard/tasks": "#f59e0b",
  "/dashboard/documents": "#64748b",
  "/dashboard/courses": "#0284c7",
  "/dashboard/timelogs": "#0ea5e9",
  "/dashboard/requests": "#10b981",
  "/dashboard/people": "#a855f7",
  "/dashboard/settings": "#64748b",
  "/dashboard/export": "#7e22ce",
};

export function DashboardNavMenu({
  navItems,
  menuLabel,
  menuContent,
  /** The way out, rendered at the foot of the menu rather than in the bar. */
  logoutAction,
  brandHref,
  headerAction,
}: {
  navItems: DashboardNavItem[];
  menuLabel: string;
  menuContent?: ReactNode;
  logoutAction?: ReactNode;
  brandHref?: string;
  headerAction?: ReactNode;
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
                className="dashboard-menu-overlay workbit-menu-page-overlay"
                onMouseDown={handleOutsidePointerDown}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: isCompact ? 40 : 2147483646,
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
                  className="workbit-menu-panel"
                  aria-label="Navigazione dashboard"
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    if (isCompact && event.target === event.currentTarget) {
                      closeMenu();
                    }
                  }}
                  style={{
                    position: isCompact ? "fixed" : "absolute",
                    inset: isCompact ? 0 : undefined,
                    top: isCompact ? 0 : position.top,
                    left: isCompact ? 0 : position.left,
                    width: isCompact
                      ? "min(100%, 420px)"
                      : `min(${Math.max(320, Math.min(position.width, 360))}px, calc(100vw - 36px))`,
                    maxWidth: isCompact ? "min(420px, calc(100vw - 32px))" : undefined,
                    height: isCompact ? "100dvh" : undefined,
                    maxHeight: isCompact ? "100dvh" : "calc(100dvh - 32px)",
                    overflowY: "auto",
                    padding: isCompact
                      ? "0 20px calc(118px + max(env(safe-area-inset-bottom), var(--wb-inset-bottom, 0px)))"
                      : 16,
                    borderRadius: isCompact ? 0 : 24,
                    border: isCompact ? 0 : "1px solid rgba(124, 58, 237, 0.12)",
                    background:
                      isCompact
                        ? "#efebfa"
                        : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,247,255,0.97) 100%)",
                    boxShadow: isCompact ? "none" : "0 18px 34px rgba(88, 28, 135, 0.12)",
                    display: "grid",
                    gap: 14,
                    animation: "dashboardMenuEnter 90ms ease-out",
                    touchAction: "pan-y",
                    overscrollBehavior: "contain",
                  }}
                >
                  {/* Stays put while the menu scrolls, like the header of the
                      app behind it. Its own background covers the status bar
                      strip, so nothing shows through above it. */}
                  <div
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 2,
                      margin: isCompact ? "0 -20px" : undefined,
                      padding: isCompact
                        ? "calc(max(env(safe-area-inset-top), var(--wb-inset-top, 0px)) + 14px) 20px 10px"
                        : undefined,
                      background: isCompact ? "#efebfa" : undefined,
                    }}
                  >
                    <div className="workbit-menu-header-card">
                      <BrandLogo
                        href={brandHref ?? "/dashboard"}
                        size={34}
                        showIcon
                        label="Workbit"
                        style={{ gap: 10 }}
                      />

                      <div className="workbit-menu-header-actions">
                        {headerAction ? (
                          <div className="workbit-menu-header-logout">{headerAction}</div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div
                    className="workbit-menu-heading"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "0 4px 4px",
                    }}
                  >
                    <div className="workbit-menu-heading-copy">
                      <span>Workbit</span>
                      <strong>Menu</strong>
                    </div>

                    <button
                      className="workbit-menu-close"
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

                  {menuContent ? (
                    <div className="workbit-menu-content" style={{ display: "grid", gap: 12 }}>
                      {menuContent}
                    </div>
                  ) : null}

                  {navItems.length > 0 ? (
                  <div className="workbit-menu-navigation" style={{ display: "grid", gap: 9 }}>
                    {[
                      // Going somewhere, and taking something away with you,
                      // are not the same errand: the report used to sit in the
                      // same list as Corsi and Impostazioni, under a heading
                      // that read "Navigazione".
                      { label: "", items: navItems.filter((item) => item.href !== "/dashboard/export") },
                      { label: "Scarica", items: navItems.filter((item) => item.href === "/dashboard/export") },
                    ]
                      .filter((section) => section.items.length > 0)
                      .map((section) => (
                        <div key={section.label || "vai"} style={{ display: "grid", gap: 6 }}>
                          {section.label ? (
                            <span
                              className="workbit-menu-section-label"
                              style={{
                                paddingLeft: 4,
                                fontSize: 9.5,
                                fontWeight: 830,
                                letterSpacing: "0.12em",
                                textTransform: "uppercase",
                                color: "#a3a0b8",
                              }}
                            >
                              {section.label}
                            </span>
                          ) : null}

                          <div
                            className="workbit-menu-navigation-list"
                            style={{
                              background: "#ffffff",
                              border: "1px solid #e9e6f5",
                              borderRadius: 18,
                              overflow: "hidden",
                            }}
                          >
                            {section.items.map((item, index) => {
                              const active =
                                pathname === item.href ||
                                (item.href !== "/dashboard" && pathname.startsWith(item.href));

                              return (
                                <Link
                                  className="workbit-menu-link"
                                  key={item.href}
                                  href={item.href}
                                  onClick={closeMenu}
                                  data-dashboard-menu-close="true"
                                  data-active={active ? "true" : "false"}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 11,
                                    padding: "13px",
                                    borderTop: index === 0 ? undefined : "1px solid #f4f2fb",
                                    background: active ? "#f6f3ff" : "transparent",
                                    textDecoration: "none",
                                    color: active ? "#4c1d95" : "#17161f",
                                  }}
                                >
                                  <span
                                    className="workbit-menu-link-icon"
                                    aria-hidden="true"
                                    style={{
                                      width: 9,
                                      height: 9,
                                      flex: "0 0 auto",
                                      borderRadius: 999,
                                      background: MENU_DOTS[item.href] ?? "#94a3b8",
                                    }}
                                  />
                                  <span
                                    className="workbit-menu-link-copy"
                                    style={{
                                      flex: 1,
                                      minWidth: 0,
                                      fontSize: 14.5,
                                      fontWeight: active ? 820 : 740,
                                    }}
                                  >
                                    {item.href === "/dashboard/export" ? "Report in PDF" : item.label}
                                  </span>
                                  <span
                                    className="workbit-menu-link-arrow"
                                    aria-hidden="true"
                                    style={{ flex: "0 0 auto", color: "#c8c5d8", fontSize: 15 }}
                                  >
                                    ›
                                  </span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                  ) : null}

                  {/* Leaving used to be a wordless icon in the white bar at
                      the top, nowhere near the menu you were reading. */}
                  {logoutAction ? (
                    <div className="workbit-menu-logout">{logoutAction}</div>
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
