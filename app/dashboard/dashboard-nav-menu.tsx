"use client";

import type { MouseEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import type { DashboardNavItem } from "./context";

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

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

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
    window.addEventListener("scroll", syncPosition, true);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("dashboard-menu-close", handleMenuClose);

    return () => {
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
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
          color: "#0f172a",
          border: "1px solid #e2e8f0",
          fontWeight: 700,
          boxShadow: open
            ? "0 10px 24px rgba(15, 23, 42, 0.10)"
            : "0 6px 16px rgba(15, 23, 42, 0.04)",
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
                      from {
                        opacity: 0;
                        transform: translateY(14px) scale(0.98);
                      }
                      to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                      }
                    }
                  `,
                }}
              />

              <div
                onMouseDown={handleOutsidePointerDown}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 9999,
                  overflow: "hidden",
                  background: isCompact ? "rgba(15, 23, 42, 0.22)" : "rgba(15, 23, 42, 0.12)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
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
                    border: "1px solid rgba(226, 232, 240, 0.96)",
                    background: "rgba(255,255,255,0.98)",
                    boxShadow: isCompact
                      ? "0 28px 60px rgba(15, 23, 42, 0.20)"
                      : "0 20px 44px rgba(15, 23, 42, 0.16)",
                    display: "grid",
                    gap: 14,
                    animation: "dashboardMenuEnter 180ms cubic-bezier(0.22, 1, 0.36, 1)",
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
                      borderBottom: "1px solid #e2e8f0",
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
                        border: "1px solid #e2e8f0",
                        background: "#f8fafc",
                        color: "#0f172a",
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
                            background: active ? "#e2e8f0" : "#f8fafc",
                            color: "#0f172a",
                            border: active ? "1px solid #cbd5e1" : "1px solid #e2e8f0",
                            fontWeight: 700,
                            fontSize: 16,
                            lineHeight: 1.35,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                          }}
                        >
                          <span>{item.label}</span>
                          <span style={{ color: active ? "#0f172a" : "#64748b", display: "inline-flex" }}>
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
                        borderTop: "1px solid #e2e8f0",
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
